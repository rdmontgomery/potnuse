import { TapeError, type Fill, type Side } from './types.ts';

const BPS = 10_000n;

/**
 * Constant-product reserves for the pair. Held in base units so the
 * arithmetic stays exact; decimals are carried alongside purely to render a
 * human-readable price.
 */
export interface PoolState {
  reserveBase: bigint;
  reserveQuote: bigint;
  baseDecimals: number;
  quoteDecimals: number;
}

/**
 * Everything skimmed off a round trip, expressed per side.
 *
 * Venue fee and token transfer tax are summed into one number deliberately:
 * the position does not care which contract took the cut. Note that many
 * tokens tax the two sides asymmetrically and in different assets — buy fees
 * paid in the quote, sell fees paid in the base, burns and vault routing.
 * From the seller's chair that is all the same haircut.
 */
export interface FeeSchedule {
  buyBps: number;
  sellBps: number;
}

export interface FillOptions {
  /**
   * Adverse selection. You are never filled at the price you observed: the
   * mark is stale by a poll interval and anyone faster has already taken the
   * good side of it. Paper trading without this is a fairy tale, so it
   * defaults to a real penalty rather than zero.
   */
  latencyHaircutBps?: number;
}

export interface FillResult {
  fill: Fill;
  /**
   * Reserves after the trade. Feeding this forward is what makes laddering
   * out of a thin pool cost what it actually costs: each rung sells into a
   * book the previous rung already pushed down.
   */
  pool: PoolState;
}

const scale = (n: bigint, decimals: number): number => Number(n) / 10 ** decimals;

/** Quote per base at the current reserves, ignoring size. */
export function midPrice(pool: PoolState): number {
  if (pool.reserveBase === 0n) return 0;
  return scale(pool.reserveQuote, pool.quoteDecimals) / scale(pool.reserveBase, pool.baseDecimals);
}

/** Total value of the pool's quote side, given a USD reference for it. */
export function poolDepthUsd(pool: PoolState, usdPerQuote: number): number {
  return scale(pool.reserveQuote, pool.quoteDecimals) * usdPerQuote;
}

function assertPool(pool: PoolState): void {
  if (pool.reserveBase <= 0n || pool.reserveQuote <= 0n) {
    throw new TapeError('pool has no reserves on one side');
  }
}

/** Uniswap-V2 style output for a given input, with the fee taken off the input. */
function amountOut(amountIn: bigint, reserveIn: bigint, reserveOut: bigint, feeBps: number): bigint {
  const afterFee = (amountIn * (BPS - BigInt(feeBps))) / BPS;
  return (reserveOut * afterFee) / (reserveIn + afterFee);
}

function priceOf(
  qtyBase: bigint,
  qtyQuote: bigint,
  pool: PoolState,
): number {
  const base = scale(qtyBase, pool.baseDecimals);
  if (base === 0) return 0;
  return scale(qtyQuote, pool.quoteDecimals) / base;
}

function settle(
  side: Side,
  qtyBase: bigint,
  qtyQuote: bigint,
  pool: PoolState,
  next: PoolState,
  feeBps: number,
  t: number,
): FillResult {
  const reference = midPrice(pool);
  const effectivePrice = priceOf(qtyBase, qtyQuote, pool);
  // Signed so the sign always means the same thing: positive is money lost.
  const raw = side === 'sell' ? reference - effectivePrice : effectivePrice - reference;
  const slippageBps = reference === 0 ? 0 : Math.round((raw / reference) * 10_000);

  return {
    fill: { side, qtyBase, qtyQuote, effectivePrice, slippageBps, feeBps, t },
    pool: next,
  };
}

/** Sell base into the pool. Returns the quote received and the moved reserves. */
export function sell(
  pool: PoolState,
  qtyBase: bigint,
  fees: FeeSchedule,
  t: number,
  opts: FillOptions = {},
): FillResult {
  assertPool(pool);
  if (qtyBase <= 0n) throw new TapeError('sell qty must be positive');

  const haircut = BigInt(opts.latencyHaircutBps ?? 30);
  const gross = amountOut(qtyBase, pool.reserveBase, pool.reserveQuote, fees.sellBps);
  const received = (gross * (BPS - haircut)) / BPS;

  const next: PoolState = {
    ...pool,
    reserveBase: pool.reserveBase + qtyBase,
    reserveQuote: pool.reserveQuote - gross,
  };
  return settle('sell', qtyBase, received, pool, next, fees.sellBps, t);
}

/** Spend quote to acquire base. */
export function buy(
  pool: PoolState,
  qtyQuote: bigint,
  fees: FeeSchedule,
  t: number,
  opts: FillOptions = {},
): FillResult {
  assertPool(pool);
  if (qtyQuote <= 0n) throw new TapeError('buy qty must be positive');

  const haircut = BigInt(opts.latencyHaircutBps ?? 30);
  const gross = amountOut(qtyQuote, pool.reserveQuote, pool.reserveBase, fees.buyBps);
  const received = (gross * (BPS - haircut)) / BPS;

  const next: PoolState = {
    ...pool,
    reserveQuote: pool.reserveQuote + qtyQuote,
    reserveBase: pool.reserveBase - gross,
  };
  return settle('buy', received, qtyQuote, pool, next, fees.buyBps, t);
}

/**
 * What it would cost to get the whole position out right now, in basis points
 * against the mid.
 *
 * This is the number that matters and the one nobody looks at before buying.
 * A position you cannot exit without paying 900bps is not a position, it is a
 * donation with a delay.
 */
export function exitCostBps(pool: PoolState, qtyBase: bigint, fees: FeeSchedule): number {
  const { fill } = sell(pool, qtyBase, fees, 0, { latencyHaircutBps: 0 });
  return fill.slippageBps;
}

/**
 * Largest position, in base units, that can still be exited inside a given
 * impact budget. Binary search — the closed form exists but this cannot drift
 * out of agreement with the fill path above, which is the property that
 * matters.
 */
export function maxExitableSize(
  pool: PoolState,
  fees: FeeSchedule,
  maxImpactBps: number,
): bigint {
  assertPool(pool);
  if (exitCostBps(pool, pool.reserveBase, fees) <= maxImpactBps) return pool.reserveBase;

  let lo = 0n;
  let hi = pool.reserveBase;
  while (hi - lo > 1n) {
    const mid = (lo + hi) / 2n;
    if (mid === 0n) break;
    if (exitCostBps(pool, mid, fees) <= maxImpactBps) lo = mid;
    else hi = mid;
  }
  return lo;
}
