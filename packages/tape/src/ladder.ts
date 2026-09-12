import { basis } from './price.ts';
import { type Denom, type Intent, type Mark, TapeError } from './types.ts';

const BPS = 10_000n;

/**
 * Relative tolerance on multiple comparisons.
 *
 * Prices are float ratios, so a rung struck exactly on the nose can compare
 * as a miss: 0.3 / 0.1 is 2.9999999999999996, and a 3x rung would sit there
 * unfilled until the next tick happened to print higher. This is nine orders
 * of magnitude below any price move worth reacting to and several above the
 * representation error, so it resolves the artefact without loosening the
 * strategy by anything observable.
 */
const EPSILON = 1e-9;

const atLeast = (value: number, target: number) => value >= target * (1 - EPSILON);
const atMost = (value: number, target: number) => value <= target * (1 + EPSILON);

export interface Rung {
  /** Fires once the position is worth this multiple of its entry basis. */
  atMultiple: number;
  /** Portion of the ORIGINAL position to sell, in basis points. */
  sellBps: number;
}

export interface LadderPlan {
  denom: Denom;
  /** Take-profit rungs. Sorted ascending on construction; must not sum past 100%. */
  rungs: Rung[];
  /** Hard exit for the whole position at this multiple, e.g. 0.5 for -50%. */
  stopMultiple: number;
  /**
   * Trailing stop on whatever survives the rungs — the runner. Disarmed until
   * the position has actually run, so it never fires on entry chop.
   */
  trail?: { armAtMultiple: number; dropPct: number };
  /** Exit if the position has gone nowhere for this long. Optional. */
  timeStopMs?: number;
}

export interface PositionState {
  entryBasis: number;
  qtyOriginal: bigint;
  qtyOpen: bigint;
  /** Parallel to plan.rungs. */
  rungsFilled: boolean[];
  highWater: number;
  trailArmed: boolean;
  openedAt: number;
  closedAt: number | null;
}

export interface StepResult {
  state: PositionState;
  intents: Intent[];
  /**
   * True when this tick could not be evaluated — a USD-denominated plan and
   * no USD reference for the quote asset. The caller should surface this, not
   * swallow it: a plan that stalls every tick is a plan that is not running.
   */
  stalled: boolean;
}

/** Validate and normalise a plan. Throws rather than silently repairing. */
export function makePlan(plan: LadderPlan): LadderPlan {
  const rungs = [...plan.rungs].sort((a, b) => a.atMultiple - b.atMultiple);

  for (const rung of rungs) {
    if (!(rung.atMultiple > 0)) throw new TapeError('rung multiple must be positive');
    if (rung.sellBps <= 0 || rung.sellBps > 10_000) {
      throw new TapeError(`rung sellBps out of range: ${rung.sellBps}`);
    }
  }
  const total = rungs.reduce((sum, r) => sum + r.sellBps, 0);
  if (total > 10_000) {
    throw new TapeError(`rungs sell ${total}bps of the position, more than all of it`);
  }
  if (!(plan.stopMultiple > 0) || plan.stopMultiple >= 1) {
    throw new TapeError('stopMultiple must be in (0, 1)');
  }
  if (rungs[0] && rungs[0].atMultiple <= plan.stopMultiple) {
    throw new TapeError('first rung sits at or below the stop');
  }
  if (plan.trail) {
    if (plan.trail.dropPct <= 0 || plan.trail.dropPct >= 100) {
      throw new TapeError('trail dropPct must be in (0, 100)');
    }
    if (!(plan.trail.armAtMultiple > 0)) throw new TapeError('trail armAtMultiple must be positive');
  }
  if (plan.timeStopMs !== undefined && plan.timeStopMs <= 0) {
    throw new TapeError('timeStopMs must be positive');
  }
  return { ...plan, rungs };
}

export function openPosition(
  plan: LadderPlan,
  entry: { basis: number; qty: bigint; t: number },
): PositionState {
  if (!(entry.basis > 0)) throw new TapeError('entry basis must be positive');
  if (entry.qty <= 0n) throw new TapeError('entry qty must be positive');
  return {
    entryBasis: entry.basis,
    qtyOriginal: entry.qty,
    qtyOpen: entry.qty,
    rungsFilled: plan.rungs.map(() => false),
    highWater: entry.basis,
    trailArmed: false,
    openedAt: entry.t,
    closedAt: null,
  };
}

/**
 * Advance the ladder by one observation.
 *
 * Pure: no clock, no network, no randomness. Time arrives inside the mark.
 * That is what makes a week of paper trading replayable against a changed
 * plan, which is the only reason the paper week is worth running.
 *
 * Ordering matters and is deliberate. Exits are evaluated before take-profit
 * rungs, so a tick that gapped through both a rung and the stop resolves as
 * the stop. We only observe points, never the path between them, and the
 * pessimistic reading is the one that does not flatter the backtest. The
 * corollary is that poll interval is a risk parameter: wide marks hide real
 * excursions in both directions.
 */
export function step(plan: LadderPlan, state: PositionState, mark: Mark): StepResult {
  if (state.qtyOpen === 0n || state.closedAt !== null) {
    return { state, intents: [], stalled: false };
  }

  const b = basis(mark, plan.denom);
  if (b === null) return { state, intents: [], stalled: true };

  const multiple = b / state.entryBasis;
  const next: PositionState = {
    ...state,
    rungsFilled: [...state.rungsFilled],
    highWater: Math.max(state.highWater, b),
    trailArmed:
      state.trailArmed ||
      (plan.trail !== undefined && atLeast(multiple, plan.trail.armAtMultiple)),
  };

  const exitAll = (reason: Intent['reason']): StepResult => ({
    state: { ...next, qtyOpen: 0n, closedAt: mark.t },
    intents: [{ side: 'sell', qty: state.qtyOpen, reason, mark }],
    stalled: false,
  });

  if (atMost(multiple, plan.stopMultiple)) {
    return exitAll({ kind: 'stop', atMultiple: multiple });
  }

  if (plan.trail && next.trailArmed) {
    const floor = next.highWater * (1 - plan.trail.dropPct / 100);
    if (atMost(b, floor)) {
      return exitAll({
        kind: 'trail',
        dropPct: plan.trail.dropPct,
        highWater: next.highWater,
      });
    }
  }

  if (plan.timeStopMs !== undefined && mark.t - state.openedAt >= plan.timeStopMs) {
    return exitAll({ kind: 'time-stop', heldMs: mark.t - state.openedAt });
  }

  // Take-profit. A gap can clear several rungs at once; fire all of them
  // rather than one per tick, or a vertical move leaves the ladder behind.
  const intents: Intent[] = [];
  let remaining = state.qtyOpen;

  for (const [index, rung] of plan.rungs.entries()) {
    if (next.rungsFilled[index]) continue;
    if (!atLeast(multiple, rung.atMultiple)) continue;

    next.rungsFilled[index] = true;
    // Fractions are always of the ORIGINAL size. Taking them off the
    // remainder instead would compound: 40% then 30% of what is left is 58%
    // sold, not 70%, and the runner silently grows.
    const want = (state.qtyOriginal * BigInt(rung.sellBps)) / BPS;
    const qty = want > remaining ? remaining : want;
    if (qty <= 0n) continue;

    remaining -= qty;
    intents.push({
      side: 'sell',
      qty,
      reason: { kind: 'rung', index, atMultiple: rung.atMultiple },
      mark,
    });
  }

  next.qtyOpen = remaining;
  if (remaining === 0n) next.closedAt = mark.t;

  return { state: next, intents, stalled: false };
}
