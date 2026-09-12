import { describe, expect, it } from 'vitest';
import { poolFeed, readPool } from './pool.ts';
import { encodeCall, words, wordToAddress, wordToBigInt } from './rpc.ts';
import type { EthCall } from './types.ts';
import { pegged, unreferenced } from '../price.ts';
import type { Address, Market } from '../types.ts';

const BASE: Address = '0x00000000000000000000000000000000000000aa';
const QUOTE: Address = '0x00000000000000000000000000000000000000bb';
const POOL: Address = '0x00000000000000000000000000000000000000cc';

const market: Market = {
  base: { chainId: 4663, address: BASE, symbol: 'MEME', decimals: 18 },
  quote: { chainId: 4663, address: QUOTE, symbol: 'QUOTE', decimals: 6 },
  pool: POOL,
  venue: 'test',
};

const word = (value: bigint | string) =>
  (typeof value === 'bigint' ? value.toString(16) : value.replace(/^0x/, '')).padStart(64, '0');

/** A pair contract that answers token0() and getReserves(). */
function fakePair(token0: Address, reserve0: bigint, reserve1: bigint) {
  const calls: string[] = [];
  const call: EthCall = async (to, data) => {
    expect(to).toBe(POOL);
    calls.push(data);
    if (data === '0x0dfe1683') return `0x${word(token0)}`;
    if (data === '0x0902f1ac') {
      return `0x${word(reserve0)}${word(reserve1)}${word(1_700_000_000n)}`;
    }
    throw new Error(`unexpected selector ${data}`);
  };
  return { call, calls };
}

const E18 = 1_000_000_000_000_000_000n;
const E6 = 1_000_000n;

describe('abi helpers', () => {
  it('encodes a bare selector and decodes words back out', () => {
    expect(encodeCall('0x0902f1ac')).toBe('0x0902f1ac');
    expect(words(`0x${word(7n)}${word(9n)}`)).toHaveLength(2);
    expect(wordToBigInt(word(12345n))).toBe(12345n);
    expect(wordToAddress(word(BASE))).toBe(BASE);
  });

  it('throws on truncated returndata rather than reading undefined', () => {
    expect(() => wordToBigInt(undefined)).toThrow(/too short/);
  });
});

describe('reserve ordering', () => {
  it('maps reserves correctly when the base token is token0', async () => {
    const { call } = fakePair(BASE, 1_000n * E18, 100n * E6);
    const pool = await readPool(call, market);
    expect(pool.reserveBase).toBe(1_000n * E18);
    expect(pool.reserveQuote).toBe(100n * E6);
  });

  it('swaps reserves when the base token is token1', async () => {
    // Getting this backwards inverts every price in the system and stays
    // invisible until the first trade.
    const { call } = fakePair(QUOTE, 100n * E6, 1_000n * E18);
    const pool = await readPool(call, market);
    expect(pool.reserveBase).toBe(1_000n * E18);
    expect(pool.reserveQuote).toBe(100n * E6);
  });

  it('refuses a pool that holds neither side of the market', async () => {
    const { call } = fakePair('0x00000000000000000000000000000000000000dd', 1n, 1n);
    await expect(readPool(call, market)).rejects.toThrow(/neither/);
  });

  it('resolves token0 once and reuses it across polls', async () => {
    const { call, calls } = fakePair(BASE, 1_000n * E18, 100n * E6);
    const cache = {};
    await readPool(call, market, cache);
    await readPool(call, market, cache);
    expect(calls.filter((d) => d === '0x0dfe1683')).toHaveLength(1);
  });
});

describe('pool feed', () => {
  it('prices the pair from reserves across mismatched decimals', async () => {
    const { call } = fakePair(BASE, 1_000n * E18, 100n * E6);
    const observation = await poolFeed(call, market, pegged()).poll(42);
    expect(observation?.mark.quotePerBase).toBeCloseTo(0.1, 12);
    expect(observation?.mark.t).toBe(42);
    expect(observation?.mark.usdPerQuote).toBe(1);
  });

  it('still produces a usable mark when the quote asset has no dollar price', async () => {
    const { call } = fakePair(BASE, 1_000n * E18, 100n * E6);
    const observation = await poolFeed(call, market, unreferenced).poll(1);
    expect(observation?.mark.quotePerBase).toBeCloseTo(0.1, 12);
    expect(observation?.mark.usdPerQuote).toBeNull();
  });

  it('returns nothing when the pool has been drained', async () => {
    const { call } = fakePair(BASE, 0n, 0n);
    expect(await poolFeed(call, market, pegged()).poll(1)).toBeNull();
  });
});
