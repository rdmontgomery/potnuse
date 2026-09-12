import { describe, expect, it } from 'vitest';
import {
  buy,
  exitCostBps,
  maxExitableSize,
  midPrice,
  poolDepthUsd,
  sell,
  type FeeSchedule,
  type PoolState,
} from './fills.ts';

const E18 = 1_000_000_000_000_000_000n;
const E6 = 1_000_000n;

/** Deep pool: 10M base against 1M quote, so mid sits at 0.1 quote per base. */
const deep: PoolState = {
  reserveBase: 10_000_000n * E18,
  reserveQuote: 1_000_000n * E6,
  baseDecimals: 18,
  quoteDecimals: 6,
};

/** The same price on a hundredth of the depth. */
const thin: PoolState = {
  reserveBase: 100_000n * E18,
  reserveQuote: 10_000n * E6,
  baseDecimals: 18,
  quoteDecimals: 6,
};

const noFee: FeeSchedule = { buyBps: 0, sellBps: 0 };
const typical: FeeSchedule = { buyBps: 100, sellBps: 100 };

describe('pool arithmetic', () => {
  it('reads mid price across mismatched decimals', () => {
    expect(midPrice(deep)).toBeCloseTo(0.1, 12);
  });

  it('values the pool through the quote asset reference', () => {
    // A quote asset worth $180 makes this a far bigger pool than a stablecoin would.
    expect(poolDepthUsd(deep, 1)).toBeCloseTo(1_000_000, 0);
    expect(poolDepthUsd(deep, 180)).toBeCloseTo(180_000_000, 0);
  });

  it('refuses a pool with an empty side', () => {
    expect(() => sell({ ...deep, reserveQuote: 0n }, E18, noFee, 0)).toThrow(/no reserves/);
  });
});

describe('price impact', () => {
  it('charges almost nothing for a trade that is small against depth', () => {
    expect(exitCostBps(deep, 100n * E18, noFee)).toBeLessThan(5);
  });

  it('charges far more for the same trade in a thin pool', () => {
    const small = exitCostBps(deep, 10_000n * E18, noFee);
    const large = exitCostBps(thin, 10_000n * E18, noFee);
    expect(large).toBeGreaterThan(small * 50);
  });

  it('grows impact monotonically with size', () => {
    const costs = [100n, 1_000n, 10_000n, 50_000n].map((q) => exitCostBps(thin, q * E18, noFee));
    for (let i = 1; i < costs.length; i += 1) {
      expect(costs[i]!).toBeGreaterThan(costs[i - 1]!);
    }
  });

  it('adds the fee on top of the impact', () => {
    expect(exitCostBps(deep, 1_000n * E18, typical)).toBeGreaterThan(
      exitCostBps(deep, 1_000n * E18, noFee) + 90,
    );
  });
});

describe('fills move the pool', () => {
  it('pushes the price down as base is sold in', () => {
    const before = midPrice(thin);
    const { pool } = sell(thin, 5_000n * E18, noFee, 0);
    expect(midPrice(pool)).toBeLessThan(before);
  });

  it('makes a laddered exit cost more than the same size sold at once would suggest', () => {
    // Each rung sells into the book the previous rung already pushed down.
    // Feeding reserves forward is the only way paper reflects that.
    let pool = thin;
    let received = 0n;
    for (let i = 0; i < 4; i += 1) {
      const result = sell(pool, 2_500n * E18, noFee, i);
      pool = result.pool;
      received += result.fill.qtyQuote;
    }
    const naive = sell(thin, 2_500n * E18, noFee, 0).fill.qtyQuote * 4n;
    expect(received).toBeLessThan(naive);
  });

  it('conserves the constant product up to fees', () => {
    const k0 = thin.reserveBase * thin.reserveQuote;
    const { pool } = sell(thin, 1_000n * E18, noFee, 0);
    const k1 = pool.reserveBase * pool.reserveQuote;
    const driftBps = Number(((k1 - k0) * 10_000n) / k0);
    expect(Math.abs(driftBps)).toBeLessThanOrEqual(1);
  });

  it('round-trips at a loss even with no fee, because impact is paid twice', () => {
    const spend = 1_000n * E6;
    const bought = buy(thin, spend, noFee, 0, { latencyHaircutBps: 0 });
    const sold = sell(bought.pool, bought.fill.qtyBase, noFee, 1, { latencyHaircutBps: 0 });
    expect(sold.fill.qtyQuote).toBeLessThan(spend);
  });
});

describe('latency haircut', () => {
  it('is charged by default, so paper never fills at the observed mark', () => {
    const withDefault = sell(deep, 100n * E18, noFee, 0);
    const withNone = sell(deep, 100n * E18, noFee, 0, { latencyHaircutBps: 0 });
    expect(withDefault.fill.qtyQuote).toBeLessThan(withNone.fill.qtyQuote);
  });

  it('leaves the pool where it was regardless of the haircut', () => {
    // The haircut models who captured the difference, not a change in reserves.
    const a = sell(deep, 100n * E18, noFee, 0, { latencyHaircutBps: 0 });
    const b = sell(deep, 100n * E18, noFee, 0, { latencyHaircutBps: 500 });
    expect(a.pool).toEqual(b.pool);
  });
});

describe('exit capacity', () => {
  it('finds a size that clears the impact budget and one step past it does not', () => {
    const size = maxExitableSize(thin, typical, 200);
    expect(size).toBeGreaterThan(0n);
    expect(exitCostBps(thin, size, typical)).toBeLessThanOrEqual(200);
    expect(exitCostBps(thin, size + size / 100n, typical)).toBeGreaterThan(200);
  });

  it('scales exit capacity with depth at identical price', () => {
    expect(maxExitableSize(deep, typical, 200)).toBeGreaterThan(
      maxExitableSize(thin, typical, 200) * 50n,
    );
  });

  it('returns nothing exitable when the fee alone blows the budget', () => {
    expect(maxExitableSize(deep, { buyBps: 500, sellBps: 500 }, 100)).toBe(0n);
  });
});
