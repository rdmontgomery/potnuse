import { TapeError, type Address } from './types.ts';

/**
 * Position sizing and the refusals around it.
 *
 * Nothing here is clever, and that is the point. On a fat-tailed payoff whose
 * win probability cannot be estimated from any sample you will ever have, the
 * Kelly fraction is not merely unknown, it is unknowable: the estimator's
 * variance swamps the estimate. What survives is crude and robust — a budget
 * you have already written off, equal tickets, and a small number of hard
 * refusals at the moments judgement is worst.
 */
export type Sizing =
  /**
   * Every ticket is the same dollar amount, set from the ORIGINAL budget and
   * never revised. Wins do not enlarge the next bet. This is the default
   * because the usual way a good strategy dies is not a bad thesis, it is a
   * winner followed by a ticket four times the size.
   */
  | 'fixed-notional'
  /**
   * Tickets scale with current equity. Compounds up, and also compounds a
   * drawdown into smaller bets exactly when the tail finally pays.
   */
  | 'fixed-fractional';

export interface BankrollConfig {
  /** Hard ceiling on cumulative deployment. Treat it as already spent. */
  programBudgetUsd: number;
  /** How many tickets the budget is cut into. */
  slots: number;
  sizing?: Sizing;
  /** Most positions open at once. Defaults to `slots`. */
  maxConcurrent?: number;
  /**
   * Enforced pause after a realised loss. Tilt is the largest single line item
   * in the historical P&L of everyone who has ever done this, and it is the
   * cheapest thing on this list to prevent.
   */
  cooldownAfterLossMs?: number;
}

export interface BankrollState {
  /** Cost basis of everything currently open. */
  deployedUsd: number;
  /** Cumulative deployment, which never decreases. Measured against the budget. */
  committedUsd: number;
  realizedUsd: number;
  openCount: number;
  /** Assets closed at a loss. Keyed lowercase so casing can never let one back in. */
  burned: Record<string, true>;
  lastLossAt: number | null;
}

export type EntryDecision =
  | { allowed: true; sizeUsd: number }
  | { allowed: false; reason: DenyReason; detail: string };

export type DenyReason =
  | 'budget-exhausted'
  | 'slots-full'
  | 'already-lost-here'
  | 'cooling-off'
  | 'size-below-dust';

export function makeBankroll(config: BankrollConfig): BankrollConfig {
  if (!(config.programBudgetUsd > 0)) throw new TapeError('programBudgetUsd must be positive');
  if (!Number.isInteger(config.slots) || config.slots < 1) {
    throw new TapeError('slots must be a positive integer');
  }
  if (config.maxConcurrent !== undefined && config.maxConcurrent < 1) {
    throw new TapeError('maxConcurrent must be at least 1');
  }
  return config;
}

export function openBankroll(): BankrollState {
  return {
    deployedUsd: 0,
    committedUsd: 0,
    realizedUsd: 0,
    openCount: 0,
    burned: {},
    lastLossAt: null,
  };
}

const key = (asset: Address) => asset.toLowerCase();

/** Ticket size before any of the refusals are applied. */
export function slotSize(config: BankrollConfig, state: BankrollState): number {
  if ((config.sizing ?? 'fixed-notional') === 'fixed-notional') {
    return config.programBudgetUsd / config.slots;
  }
  const equity = config.programBudgetUsd + state.realizedUsd;
  return Math.max(equity, 0) / config.slots;
}

/**
 * Decide whether to open, and how large.
 *
 * Every refusal here fires precisely when the trader is least able to supply
 * it themselves: budget gone, hands full, staring at a chart that already took
 * money, or fresh off a loss.
 */
export function proposeEntry(
  config: BankrollConfig,
  state: BankrollState,
  request: { asset: Address; t: number },
): EntryDecision {
  if (state.burned[key(request.asset)]) {
    return {
      allowed: false,
      reason: 'already-lost-here',
      detail: 'this asset has already taken money once; a second ticket is revenge, not a thesis',
    };
  }

  const cooldown = config.cooldownAfterLossMs ?? 0;
  if (cooldown > 0 && state.lastLossAt !== null && request.t - state.lastLossAt < cooldown) {
    const remaining = cooldown - (request.t - state.lastLossAt);
    return {
      allowed: false,
      reason: 'cooling-off',
      detail: `${Math.ceil(remaining / 60_000)} minutes left on the post-loss cooldown`,
    };
  }

  const concurrent = config.maxConcurrent ?? config.slots;
  if (state.openCount >= concurrent) {
    return {
      allowed: false,
      reason: 'slots-full',
      detail: `${state.openCount} of ${concurrent} slots already open`,
    };
  }

  const headroom = config.programBudgetUsd - state.committedUsd;
  if (headroom <= 0) {
    return {
      allowed: false,
      reason: 'budget-exhausted',
      detail: `the full ${config.programBudgetUsd} has been committed; the program is over`,
    };
  }

  const sizeUsd = Math.min(slotSize(config, state), headroom);
  if (sizeUsd < 1) {
    return { allowed: false, reason: 'size-below-dust', detail: `remaining ticket is ${sizeUsd}` };
  }
  return { allowed: true, sizeUsd };
}

export function recordEntry(state: BankrollState, sizeUsd: number): BankrollState {
  return {
    ...state,
    deployedUsd: state.deployedUsd + sizeUsd,
    committedUsd: state.committedUsd + sizeUsd,
    openCount: state.openCount + 1,
  };
}

/**
 * Close a position out. A loss burns the asset permanently — the one rule that
 * would have changed the most historical outcomes.
 */
export function recordExit(
  state: BankrollState,
  exit: { asset: Address; costUsd: number; proceedsUsd: number; t: number },
): BankrollState {
  const pnl = exit.proceedsUsd - exit.costUsd;
  const lost = pnl < 0;
  return {
    ...state,
    deployedUsd: Math.max(state.deployedUsd - exit.costUsd, 0),
    realizedUsd: state.realizedUsd + pnl,
    openCount: Math.max(state.openCount - 1, 0),
    burned: lost ? { ...state.burned, [key(exit.asset)]: true } : state.burned,
    lastLossAt: lost ? exit.t : state.lastLossAt,
  };
}

/** Worst case from here: everything open goes to zero. */
export function maxDrawdownUsd(state: BankrollState): number {
  return state.deployedUsd - state.realizedUsd;
}
