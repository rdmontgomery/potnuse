import { describe, expect, it } from 'vitest';
import { poolFor, poolFromLiquidity, valueSkewPct } from './synthetic.ts';
import { exitCostBps, maxExitableSize, midPrice, poolDepthUsd } from '../fills.ts';
import type { PairQuote } from './types.ts';

const pair = (
  liquidityUsd: number | null,
  priceUsd: number | null,
  reserveBase: number | null = null,
): PairQuote => ({
  reserveBase,
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

describe('what the reported reserves actually tell us', () => {
  // A live Orca Whirlpool: $2.48M of liquidity with 222.4M PENGU on the base
  // side at $0.006788. That is 61/39 — and for a constant-product pool it
  // could not be, because both sides hold equal value at the mid by
  // construction. The skew is the tell that this is concentrated liquidity.
  const liquidityUsd = 2_481_974.69;
  const priceUsd = 0.006788;
  const reserveBase = 222_448_202;

  it('measures how far a pool sits from the shape the model assumes', () => {
    const skew = valueSkewPct(pair(liquidityUsd, priceUsd, reserveBase))!;
    expect(skew).toBeGreaterThan(10);
    expect(skew).toBeLessThan(15);
  });

  it('reports no skew for a pool that really is evenly split', () => {
    // 1,000,000 base at $1 against $2M of liquidity is exactly half.
    expect(valueSkewPct(pair(2_000_000, 1, 1_000_000))).toBeCloseTo(0, 6);
  });

  it('says nothing rather than claiming evenness when reserves are absent', () => {
    // Null is not zero, and reporting it as zero would assert something the
    // source never said.
    expect(valueSkewPct(pair(2_000_000, 1, null))).toBeNull();
  });

  it('declines when the figures contradict each other', () => {
    expect(valueSkewPct(pair(1_000, 1, 5_000))).toBeNull();
  });

  it('keeps the pool itself an even split, because that is what the model is', () => {
    const pool = poolFor(pair(liquidityUsd, priceUsd, reserveBase))!;
    expect(midPrice(pool)).toBeCloseTo(priceUsd, 8);
    expect(poolDepthUsd(pool, 1)).toBeCloseTo(liquidityUsd / 2, 0);
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
