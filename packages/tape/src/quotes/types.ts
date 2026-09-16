/**
 * Chain-agnostic market identity.
 *
 * `pairId` is a string, deliberately. An EVM V2 pair is a 20-byte address, a
 * Uniswap V4 pool is a 32-byte id, a Raydium pool is base58, and a future
 * venue will be something else again. Typing this as an EVM address is the
 * assumption that cost this project a week — the identifier is opaque, and
 * only the source that issued it needs to understand it.
 */
export interface PairQuote {
  /** The aggregator's own chain slug: "solana", "ethereum", "base", … */
  chain: string;
  pairId: string;
  dex: string | null;
  baseSymbol: string | null;
  baseAddress: string | null;
  quoteSymbol: string | null;
  quoteAddress: string | null;
  priceUsd: number | null;
  /** Price in the quote asset, when the source gives one. */
  priceNative: number | null;
  liquidityUsd: number | null;
  volume24hUsd: number | null;
  /**
   * Base-side reserve in whole tokens, when the source reports it.
   *
   * Worth more than it looks. Without it the two sides have to be assumed to
   * hold equal value, and real pools drift a long way from that — which
   * understates what an exit costs, the wrong direction to be wrong in.
   */
  reserveBase?: number | null;
  reserveQuote?: number | null;
  /** Pool creation time, epoch milliseconds. The age the screen asks for. */
  createdAt?: number | null;
  /** Trade counts over the last day: whether anyone is actually trading it. */
  buys24h?: number | null;
  sells24h?: number | null;
  priceChange24hPct?: number | null;
  fdvUsd?: number | null;
}

/** One OHLCV bar. The high and low are the point of it. */
export interface Bar {
  /** Bar open time, epoch milliseconds. */
  t: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number | null;
}

/**
 * Where prices come from, for any chain and any venue.
 *
 * Narrow on purpose. Everything the ladder needs is a series of bars and a
 * current mark; everything the screen needs is depth and volume. Nothing here
 * knows what a reserve is, which is what lets one implementation serve
 * Solana, an EVM pair and a singleton pool alike.
 */
export interface QuoteSource {
  readonly name: string;
  /** Every pair holding this token, across every chain the source covers. */
  pairsFor(token: string): Promise<PairQuote[]>;
  /** Bars for one pair, oldest first. */
  bars(pair: PairQuote, opts?: { limit?: number; minutes?: number }): Promise<Bar[]>;
}
