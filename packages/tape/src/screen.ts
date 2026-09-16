import { exitCostBps, maxExitableSize, poolDepthUsd, type FeeSchedule, type PoolState } from './fills.ts';
import type { Market } from './types.ts';

/**
 * Facts about a token, gathered before any capital moves.
 *
 * Every field is nullable, and null means "could not be established", never
 * "fine". The scorer below treats an unknown as a warning rather than a pass,
 * because the failure mode this whole layer exists to prevent is exactly the
 * one where nobody checked.
 */
export interface ScreenFacts {
  market: Market;
  pool: PoolState;
  fees: FeeSchedule | null;
  /** USD per unit of the quote asset, and how that reference behaves. */
  usdPerQuote: number | null;
  quoteKind: 'stable' | 'floating' | 'unreferenced';
  /** Annualised volatility of the quote asset itself, percent. Zero for a peg. */
  quoteVolatilityPct: number | null;
  sourceVerified: boolean | null;
  ownerRenounced: boolean | null;
  canMint: boolean | null;
  /** Whether accounts can be frozen, stranding a holder who cannot then sell. */
  canFreeze?: boolean | null;
  /** Largest non-pool, non-burn holder as a percent of supply. */
  topHolderPct: number | null;
  holders: number | null;
  lpLockedPct: number | null;
  ageMs: number | null;
  /** Distance from an even value split, in points. Non-zero means not constant-product. */
  valueSkewPct?: number | null;
  /** Trades in the last day. Exit depends on someone being on the other side. */
  trades24h?: number | null;
}

export type Severity = 'block' | 'warn' | 'note';

export interface Finding {
  severity: Severity;
  code: string;
  message: string;
}

export interface Verdict {
  findings: Finding[];
  /** Worst severity present. */
  outcome: Severity | 'clear';
  /** Largest position, in USD, that clears the exit-impact budget. */
  maxSizeUsd: number | null;
}

export interface ScreenPolicy {
  intendedSizeUsd: number;
  /** Impact budget for getting the whole position back out. */
  maxExitImpactBps?: number;
  minPoolDepthUsd?: number;
  maxTopHolderPct?: number;
  minAgeMs?: number;
  maxRoundTripFeeBps?: number;
  /** Below this many trades a day, getting out depends on luck. */
  minTrades24h?: number;
}

const unknown = (code: string, what: string): Finding => ({
  severity: 'warn',
  code,
  message: `${what} could not be established; treat as unknown, not as clear`,
});

/**
 * Score a token against a policy.
 *
 * Pure, so a verdict can be recomputed from a journal months later and
 * disagreed with on the evidence rather than from memory.
 */
export function screen(facts: ScreenFacts, policy: ScreenPolicy): Verdict {
  const findings: Finding[] = [];
  const maxExitImpactBps = policy.maxExitImpactBps ?? 300;
  const minPoolDepthUsd = policy.minPoolDepthUsd ?? 50_000;
  const maxTopHolderPct = policy.maxTopHolderPct ?? 15;
  const maxRoundTripFeeBps = policy.maxRoundTripFeeBps ?? 1_000;

  // --- Can the position be exited at all? The first question, and the one
  // --- that gets asked last in practice.
  const fees = facts.fees ?? { buyBps: 0, sellBps: 0 };
  if (facts.fees === null) findings.push(unknown('fees-unknown', 'transfer fees'));

  let maxSizeUsd: number | null = null;
  const price = facts.usdPerQuote;

  if (price === null) {
    findings.push({
      severity: 'warn',
      code: 'no-usd-reference',
      message:
        'the quote asset has no dollar reference, so position size and stops can only be expressed against the quote asset itself',
    });
  } else {
    const depthUsd = poolDepthUsd(facts.pool, price);
    if (depthUsd < minPoolDepthUsd) {
      findings.push({
        severity: 'block',
        code: 'pool-too-thin',
        message: `pool holds about $${Math.round(depthUsd).toLocaleString()} on the quote side, under the $${minPoolDepthUsd.toLocaleString()} floor`,
      });
    }

    const exitable = maxExitableSize(facts.pool, fees, maxExitImpactBps);
    const midQuotePerBase =
      Number(facts.pool.reserveQuote) / 10 ** facts.pool.quoteDecimals /
      (Number(facts.pool.reserveBase) / 10 ** facts.pool.baseDecimals);
    maxSizeUsd = (Number(exitable) / 10 ** facts.pool.baseDecimals) * midQuotePerBase * price;

    if (policy.intendedSizeUsd > maxSizeUsd) {
      findings.push({
        severity: 'block',
        code: 'size-exceeds-exit-capacity',
        message: `getting $${policy.intendedSizeUsd} back out costs more than ${maxExitImpactBps}bps; this pool supports about $${Math.round(maxSizeUsd)}`,
      });
    }

    const intendedBase = BigInt(
      Math.floor((policy.intendedSizeUsd / (midQuotePerBase * price)) * 10 ** facts.pool.baseDecimals),
    );
    if (intendedBase > 0n) {
      const cost = exitCostBps(facts.pool, intendedBase, fees);
      findings.push({
        severity: cost > maxExitImpactBps ? 'warn' : 'note',
        code: 'exit-cost',
        message: `round-trip exit of the intended size costs about ${cost}bps at current depth`,
      });
    }
  }

  const roundTrip = fees.buyBps + fees.sellBps;
  if (roundTrip > maxRoundTripFeeBps) {
    findings.push({
      severity: 'block',
      code: 'fees-confiscatory',
      message: `${roundTrip}bps round trip; a laddered exit pays it on every rung`,
    });
  } else if (roundTrip > 0) {
    findings.push({
      severity: 'note',
      code: 'fees',
      message: `${roundTrip}bps round trip, charged again at each rung`,
    });
  }

  // --- Can the supply be changed under you?
  if (facts.canMint === null) findings.push(unknown('mint-unknown', 'mint authority'));
  else if (facts.canMint) {
    findings.push({
      severity: 'block',
      code: 'mintable',
      message: 'supply can still be minted; your percentage of it is not a fixed quantity',
    });
  }

  if (facts.canFreeze === true) {
    findings.push({
      severity: 'block',
      code: 'freezable',
      message:
        'accounts can be frozen by the issuer; a frozen position is held and unsellable, which is a honeypot with extra steps',
    });
  } else if (facts.canFreeze === null) {
    findings.push(unknown('freeze-unknown', 'freeze authority'));
  }

  if (facts.sourceVerified === null) findings.push(unknown('source-unknown', 'source verification'));
  else if (!facts.sourceVerified) {
    findings.push({
      severity: 'block',
      code: 'unverified-source',
      message: 'contract source is not verified, so nothing above was read from code you can see',
    });
  }

  if (facts.ownerRenounced === false) {
    findings.push({
      severity: 'warn',
      code: 'owner-retained',
      message: 'owner keys are live; fees, limits and transfer rules can change after you buy',
    });
  } else if (facts.ownerRenounced === null) {
    findings.push(unknown('owner-unknown', 'ownership status'));
  }

  // --- Who else is holding, and what happens when they leave?
  if (facts.topHolderPct === null) findings.push(unknown('holders-unknown', 'holder concentration'));
  else if (facts.topHolderPct > maxTopHolderPct) {
    findings.push({
      severity: 'warn',
      code: 'concentrated',
      message: `largest holder has ${facts.topHolderPct.toFixed(1)}% of supply, above the ${maxTopHolderPct}% line; your exit is downstream of theirs`,
    });
  }

  if (facts.lpLockedPct !== null && facts.lpLockedPct < 50) {
    findings.push({
      severity: 'block',
      code: 'lp-unlocked',
      message: `only ${facts.lpLockedPct.toFixed(0)}% of liquidity is locked; the pool can be withdrawn`,
    });
  }

  if (policy.minAgeMs !== undefined && facts.ageMs !== null && facts.ageMs < policy.minAgeMs) {
    findings.push({
      severity: 'warn',
      code: 'young',
      message: `market is ${Math.round(facts.ageMs / 3_600_000)}h old; almost nothing about it has been tested yet`,
    });
  }

  if (facts.valueSkewPct !== null && facts.valueSkewPct !== undefined && facts.valueSkewPct > 10) {
    findings.push({
      severity: 'warn',
      code: 'not-constant-product',
      message:
        `reported reserves sit ${facts.valueSkewPct.toFixed(0)} points off an even split, so this is concentrated liquidity — ` +
        'the impact figures above are a constant-product approximation, optimistic near the mid and badly optimistic on a large move',
    });
  }

  if (facts.trades24h !== null && facts.trades24h !== undefined) {
    const floor = policy.minTrades24h ?? 50;
    if (facts.trades24h < floor) {
      findings.push({
        severity: 'warn',
        code: 'barely-traded',
        message: `${facts.trades24h} trades in the last day; an exit needs someone on the other side, and there may not be one`,
      });
    }
  }

  // --- The quote asset is a position too.
  if (facts.quoteKind === 'floating') {
    const vol = facts.quoteVolatilityPct;
    findings.push({
      severity: vol !== null && vol > 40 ? 'warn' : 'note',
      code: 'quote-has-beta',
      message:
        `the quote asset floats${vol !== null ? ` at about ${vol.toFixed(0)}% annualised vol` : ''}` +
        '; dollar P&L is the product of two moves, and a flat pair can still lose money',
    });
  } else if (facts.quoteKind === 'unreferenced') {
    findings.push({
      severity: 'warn',
      code: 'quote-unreferenced',
      message: 'the quote asset has no independent price; the pair ratio is the only truth available',
    });
  }

  const outcome: Verdict['outcome'] = findings.some((f) => f.severity === 'block')
    ? 'block'
    : findings.some((f) => f.severity === 'warn')
      ? 'warn'
      : findings.length > 0
        ? 'note'
        : 'clear';

  return { findings, outcome, maxSizeUsd };
}

export function formatVerdict(verdict: Verdict): string {
  const glyph: Record<Severity, string> = { block: '✗', warn: '!', note: '·' };
  const lines = verdict.findings.map((f) => `  ${glyph[f.severity]} ${f.code}: ${f.message}`);
  const cap =
    verdict.maxSizeUsd === null
      ? 'exit capacity: unknown'
      : `exit capacity: about $${Math.round(verdict.maxSizeUsd).toLocaleString()}`;
  return [`verdict: ${verdict.outcome}  (${cap})`, ...lines].join('\n');
}
