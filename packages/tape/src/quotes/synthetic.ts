import type { PoolState } from '../fills.ts';
import type { PairQuote } from './types.ts';

/**
 * Reconstruct reserves from a liquidity figure and a price.
 *
 * The fill model needs reserves; aggregators report a dollar liquidity number.
 * For a constant-product pool the two sides hold equal value, so the quote side
 * is half the reported liquidity and the base side is that divided by price.
 * That recovers everything `fills.ts` needs without knowing the venue.
 *
 * It is an estimate, and it is wrong in a knowable direction. Concentrated
 * liquidity (V3, V4) concentrates the same dollars into a band, so real impact
 * near the current price is LOWER than this predicts while impact outside the
 * band is far higher. Treating a V3 pool as constant-product therefore
 * overstates the cost of ordinary fills and understates the cost of the exact
 * move that matters — a violent one. Do not read the resulting slippage as
 * precision; read it as a floor on how much size the pool can take.
 */
export function poolFromLiquidity(
  liquidityUsd: number,
  priceUsd: number,
  opts: { baseDecimals?: number; quoteDecimals?: number } = {},
): PoolState | null {
  if (!(liquidityUsd > 0) || !(priceUsd > 0)) return null;

  const baseDecimals = opts.baseDecimals ?? 18;
  const quoteDecimals = opts.quoteDecimals ?? 6;

  // Both sides hold half the value; the quote side is priced at one dollar so
  // its unit count is its dollar count.
  const quoteUnits = liquidityUsd / 2;
  const baseUnits = quoteUnits / priceUsd;

  const scale = (units: number, decimals: number): bigint => {
    if (!Number.isFinite(units) || units <= 0) return 0n;
    // Via string to survive magnitudes that overflow a float's integer range.
    return BigInt(Math.round(units * 10 ** Math.min(decimals, 9))) *
      10n ** BigInt(Math.max(decimals - 9, 0));
  };

  const reserveBase = scale(baseUnits, baseDecimals);
  const reserveQuote = scale(quoteUnits, quoteDecimals);
  if (reserveBase <= 0n || reserveQuote <= 0n) return null;

  return { reserveBase, reserveQuote, baseDecimals, quoteDecimals };
}

/** Reserves for a pair, when it reported enough to build them. */
export function poolFor(pair: PairQuote): PoolState | null {
  if (pair.liquidityUsd === null || pair.priceUsd === null) return null;
  return poolFromLiquidity(pair.liquidityUsd, pair.priceUsd);
}
