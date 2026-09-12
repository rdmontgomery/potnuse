/**
 * Core domain types.
 *
 * Two numeric conventions, deliberately different:
 *
 *   - Quantities are `bigint` in base units. Position sizing and ladder
 *     fractions must not drift, so every split is integer math in basis
 *     points. A rounding error here is a real unsold tail.
 *   - Prices are `number`. They are ratios derived from reserves or an
 *     oracle and are already approximate at the source; pretending
 *     otherwise would be false precision.
 */

export type Address = `0x${string}`;

export interface Asset {
  chainId: number;
  address: Address;
  symbol: string;
  decimals: number;
}

/**
 * A market is always base-against-quote. The quote asset is a parameter,
 * never an assumption: a stablecoin, a tokenized equity, wrapped ETH and a
 * governance token are all the same shape here. What separates them is
 * only whether their USD reference is constant (see price.ts).
 */
export interface Market {
  base: Asset;
  quote: Asset;
  /** Pool/pair address the price is read from. */
  pool: Address;
  venue: string;
}

/**
 * One observation of the market.
 *
 * `usdPerQuote` is nullable on purpose. A pool priced against an illiquid
 * or unreferenced quote asset has a perfectly good quote-denominated price
 * and no honest USD price, and the engine must be able to say so rather
 * than silently substituting 1.
 */
export interface Mark {
  /** Epoch milliseconds. */
  t: number;
  /** Units of quote per one unit of base. */
  quotePerBase: number;
  /** USD per one unit of quote, or null when no reference is available. */
  usdPerQuote: number | null;
}

/**
 * Which unit the ladder measures multiples in.
 *
 * 'quote' asks "how many times more of the quote asset is one base worth
 * than when I entered". 'usd' asks the same question in dollars. They agree
 * only when the quote asset is a stablecoin. Against a tokenized equity or
 * wrapped ETH they can diverge hard: the pair ratio can be flat while the
 * dollar value halves, or vice versa. Choosing is a strategy decision, so
 * it is explicit on the plan and never inferred.
 */
export type Denom = 'quote' | 'usd';

export type Side = 'buy' | 'sell';

/** Why the engine wants to trade. Carried through to the journal verbatim. */
export type IntentReason =
  | { kind: 'entry' }
  | { kind: 'rung'; index: number; atMultiple: number }
  | { kind: 'stop'; atMultiple: number }
  | { kind: 'trail'; dropPct: number; highWater: number }
  | { kind: 'time-stop'; heldMs: number };

export interface Intent {
  side: Side;
  /** Base-asset quantity in base units. */
  qty: bigint;
  reason: IntentReason;
  /** The mark that triggered this intent. */
  mark: Mark;
}

export interface Fill {
  side: Side;
  /** Base units of the base asset that actually moved. */
  qtyBase: bigint;
  /** Base units of the quote asset that actually moved. */
  qtyQuote: bigint;
  /** Realised quote-per-base after impact and fees. */
  effectivePrice: number;
  /** Difference between mark price and effective price, in basis points. */
  slippageBps: number;
  feeBps: number;
  t: number;
}

export class TapeError extends Error {}
