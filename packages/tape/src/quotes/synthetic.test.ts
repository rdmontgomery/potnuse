import { describe, expect, it } from 'vitest';
import { poolFor, poolFromLiquidity } from './synthetic.ts';
import { exitCostBps, maxExitableSize, midPrice, poolDepthUsd } from '../fills.ts';
import type { PairQuote } from './types.ts';

const pair = (liquidityUsd: number | null, priceUsd: number | null): PairQuote => ({
  chain: 'solana',
  pairId: 'abc',
  dex: 'raydium',
  baseSymbol: 'MEME',
  baseAddress: null,
  quoteSymbol: 'SOL',
  quoteAddress: null,
  priceUsd,
  priceNative: null,
  liquidityUsd,
  volume24hUsd: null,
});

describe('reserves from a liquidity figure', () => {
  it('splits the reported liquidity evenly across the two sides', () => {
    const pool = poolFromLiquidity(1_000_000, 0.5)!;
    expect(poolDepthUsd(pool, 1)).toBeCloseTo(500_000, 0);
  });

  it('recovers the price it was built from', () => {
    for (const price of [0.000_001, 0.5, 42, 1800]) {
      const pool = poolFromLiquidity(2_000_000, price)!;
      expect(midPrice(pool)).toBeCloseTo(price, 6);
    }
  });

  it('feeds the existing fill model without it knowing the difference', () => {
    const pool = poolFromLiquidity(1_000_000, 0.1)!;
    const size = maxExitableSize(pool, { buyBps: 30, sellBps: 30 }, 300);
    expect(size).toBeGreaterThan(0n);
    expect(exitCostBps(pool, size, { buyBps: 30, sellBps: 30 })).toBeLessThanOrEqual(300);
  });

  it('makes a thin pool cost more than a deep one for the same trade', () => {
    const deep = poolFromLiquidity(5_000_000, 1)!;
    const thin = poolFromLiquidity(50_000, 1)!;
    const size = 10_000n * 10n ** 18n;
    const fees = { buyBps: 0, sellBps: 0 };
    expect(exitCostBps(thin, size, fees)).toBeGreaterThan(exitCostBps(deep, size, fees) * 10);
  });

  it('survives a microcap price without collapsing to zero reserves', () => {
    const pool = poolFromLiquidity(25_000, 0.000_000_042)!;
    expect(pool.reserveBase).toBeGreaterThan(0n);
    expect(midPrice(pool)).toBeCloseTo(0.000_000_042, 12);
  });

  it('refuses nonsense rather than returning a pool that lies', () => {
    expect(poolFromLiquidity(0, 1)).toBeNull();
    expect(poolFromLiquidity(-5, 1)).toBeNull();
    expect(poolFromLiquidity(1000, 0)).toBeNull();
    expect(poolFromLiquidity(Number.NaN, 1)).toBeNull();
  });

  it('honours decimals it is given', () => {
    const pool = poolFromLiquidity(1_000_000, 1, { baseDecimals: 9, quoteDecimals: 9 });
    expect(pool?.baseDecimals).toBe(9);
    expect(midPrice(pool!)).toBeCloseTo(1, 6);
  });
});

describe('from a pair quote', () => {
  it('builds reserves when the pair reported both figures', () => {
    expect(poolFor(pair(500_000, 0.25))).not.toBeNull();
  });

  it('declines when either figure is missing', () => {
    expect(poolFor(pair(null, 0.25))).toBeNull();
    expect(poolFor(pair(500_000, null))).toBeNull();
  });
});
