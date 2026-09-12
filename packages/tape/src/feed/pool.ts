import type { PoolState } from '../fills.ts';
import { TapeError, type Mark, type Market } from '../types.ts';
import { encodeCall, wordToAddress, wordToBigInt, words } from './rpc.ts';
import type { EthCall, MarkFeed, Observation } from './types.ts';
import type { UsdReference } from '../price.ts';

/** getReserves() */
const GET_RESERVES = '0x0902f1ac';
/** token0() */
const TOKEN0 = '0x0dfe1683';

/**
 * Read a Uniswap-V2 style pair.
 *
 * Reserves come back in token0/token1 order, which has nothing to do with
 * which side you think of as the base. Getting this backwards inverts every
 * price in the system and the mistake is invisible until the first trade, so
 * token0 is resolved once and asserted against the market definition.
 */
export async function readPool(
  call: EthCall,
  market: Market,
  cache: { token0?: string } = {},
): Promise<PoolState> {
  if (cache.token0 === undefined) {
    cache.token0 = wordToAddress(words(await call(market.pool, encodeCall(TOKEN0)))[0]).toLowerCase();
  }

  const raw = words(await call(market.pool, encodeCall(GET_RESERVES)));
  const reserve0 = wordToBigInt(raw[0]);
  const reserve1 = wordToBigInt(raw[1]);

  const baseIsToken0 = cache.token0 === market.base.address.toLowerCase();
  if (!baseIsToken0 && cache.token0 !== market.quote.address.toLowerCase()) {
    throw new TapeError(
      `pool ${market.pool} holds neither ${market.base.symbol} nor ${market.quote.symbol} as token0`,
    );
  }

  return {
    reserveBase: baseIsToken0 ? reserve0 : reserve1,
    reserveQuote: baseIsToken0 ? reserve1 : reserve0,
    baseDecimals: market.base.decimals,
    quoteDecimals: market.quote.decimals,
  };
}

/**
 * A live feed over a constant-product pair.
 *
 * The USD reference is injected rather than assumed. A stablecoin pair gets
 * `pegged()`, an equity or ETH pair gets `floating()`, and a pair with no
 * outside reference gets `unreferenced` and still produces perfectly usable
 * quote-denominated marks.
 */
export function poolFeed(call: EthCall, market: Market, usdRef: UsdReference): MarkFeed {
  const cache: { token0?: string } = {};

  return {
    market,
    async poll(t: number): Promise<Observation | null> {
      const pool = await readPool(call, market, cache);
      if (pool.reserveBase <= 0n || pool.reserveQuote <= 0n) return null;

      const quotePerBase =
        Number(pool.reserveQuote) / 10 ** pool.quoteDecimals /
        (Number(pool.reserveBase) / 10 ** pool.baseDecimals);

      const mark: Mark = { t, quotePerBase, usdPerQuote: await usdRef.usdPerUnit(t) };
      return { mark, pool };
    },
  };
}
