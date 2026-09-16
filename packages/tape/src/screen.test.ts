import { describe, expect, it } from 'vitest';
import { screen, type ScreenFacts, type ScreenPolicy } from './screen.ts';
import type { PoolState } from './fills.ts';
import type { Market } from './types.ts';

const E18 = 1_000_000_000_000_000_000n;
const E6 = 1_000_000n;

const market: Market = {
  base: { chainId: 4663, address: '0xaa', symbol: 'BASE', decimals: 18 },
  quote: { chainId: 4663, address: '0xbb', symbol: 'QUOTE', decimals: 6 },
  pool: '0xcc',
  venue: 'test',
};

const deep: PoolState = {
  reserveBase: 10_000_000n * E18,
  reserveQuote: 1_000_000n * E6,
  baseDecimals: 18,
  quoteDecimals: 6,
};

/** A token that passes everything, quoted in a stablecoin. */
const clean: ScreenFacts = {
  market,
  pool: deep,
  fees: { buyBps: 30, sellBps: 30 },
  usdPerQuote: 1,
  quoteKind: 'stable',
  quoteVolatilityPct: 0,
  sourceVerified: true,
  ownerRenounced: true,
  canMint: false,
  canFreeze: false,
  topHolderPct: 4,
  holders: 9_000,
  lpLockedPct: 100,
  ageMs: 90 * 24 * 3_600_000,
};

const policy: ScreenPolicy = { intendedSizeUsd: 50 };

const codes = (facts: ScreenFacts, p: ScreenPolicy = policy) =>
  screen(facts, p).findings.map((f) => f.code);

describe('exit capacity', () => {
  it('passes a small ticket in a deep pool', () => {
    const verdict = screen(clean, policy);
    expect(verdict.outcome).toBe('note');
    expect(verdict.maxSizeUsd).toBeGreaterThan(10_000);
  });

  it('blocks a ticket larger than the pool can return', () => {
    const thin: ScreenFacts = {
      ...clean,
      pool: { ...deep, reserveBase: 100_000n * E18, reserveQuote: 10_000n * E6 },
    };
    expect(codes(thin, { intendedSizeUsd: 8_000 })).toContain('size-exceeds-exit-capacity');
  });

  it('blocks a pool too thin to bother with at any size', () => {
    const dust: ScreenFacts = {
      ...clean,
      pool: { ...deep, reserveBase: 1_000n * E18, reserveQuote: 900n * E6 },
    };
    expect(codes(dust)).toContain('pool-too-thin');
  });

  it('blocks confiscatory round-trip fees', () => {
    expect(codes({ ...clean, fees: { buyBps: 600, sellBps: 600 } })).toContain('fees-confiscatory');
  });
});

describe('unknowns are not passes', () => {
  it('warns rather than clears when a fact could not be established', () => {
    const dark: ScreenFacts = {
      ...clean,
      fees: null,
      sourceVerified: null,
      ownerRenounced: null,
      canMint: null,
      canFreeze: null,
      topHolderPct: null,
    };
    const verdict = screen(dark, policy);
    expect(verdict.outcome).toBe('warn');
    expect(verdict.findings.filter((f) => f.message.includes('unknown')).length).toBe(6);
  });

  it('never reports clear while anything is unknown', () => {
    expect(screen({ ...clean, canMint: null }, policy).outcome).not.toBe('clear');
  });
});

describe('contract risk', () => {
  it('blocks a mintable supply', () => {
    expect(codes({ ...clean, canMint: true })).toContain('mintable');
  });

  it('blocks a token whose accounts can be frozen', () => {
    // Holding something you cannot sell is the same loss as being rugged,
    // arrived at differently.
    const verdict = screen({ ...clean, canFreeze: true }, policy);
    expect(verdict.outcome).toBe('block');
    expect(verdict.findings.find((f) => f.code === 'freezable')?.message).toMatch(/unsellable/);
  });

  it('warns rather than clears when freeze authority could not be read', () => {
    expect(codes({ ...clean, canFreeze: null })).toContain('freeze-unknown');
  });

  it('blocks unverified source', () => {
    expect(codes({ ...clean, sourceVerified: false })).toContain('unverified-source');
  });

  it('blocks withdrawable liquidity', () => {
    expect(codes({ ...clean, lpLockedPct: 10 })).toContain('lp-unlocked');
  });

  it('warns on live owner keys', () => {
    expect(codes({ ...clean, ownerRenounced: false })).toContain('owner-retained');
  });

  it('warns on a holder large enough to exit ahead of you', () => {
    expect(codes({ ...clean, topHolderPct: 38 })).toContain('concentrated');
  });
});

describe('pool shape and activity', () => {
  it('warns that a skewed pool is not the shape the impact model assumes', () => {
    const verdict = screen({ ...clean, valueSkewPct: 11.6 }, policy);
    const finding = verdict.findings.find((f) => f.code === 'not-constant-product');
    expect(finding?.severity).toBe('warn');
    expect(finding?.message).toMatch(/concentrated liquidity/);
    expect(finding?.message).toMatch(/optimistic/);
  });

  it('says nothing about shape for a pool that is evenly split', () => {
    expect(codes({ ...clean, valueSkewPct: 0.4 })).not.toContain('not-constant-product');
  });

  it('says nothing about shape when the reserves were never reported', () => {
    // Absent is not even; claiming otherwise asserts something unsaid.
    expect(codes({ ...clean, valueSkewPct: null })).not.toContain('not-constant-product');
  });

  it('warns about a pool almost nobody traded', () => {
    const finding = screen({ ...clean, trades24h: 7 }, policy).findings.find(
      (f) => f.code === 'barely-traded',
    );
    expect(finding?.message).toMatch(/someone on the other side/);
  });

  it('accepts a busy pool without comment', () => {
    expect(codes({ ...clean, trades24h: 1_910 })).not.toContain('barely-traded');
  });

  it('takes the activity floor from the policy', () => {
    expect(codes({ ...clean, trades24h: 200 }, { ...policy, minTrades24h: 500 })).toContain(
      'barely-traded',
    );
  });
});

describe('the quote asset is itself a position', () => {
  it('says nothing special about a stablecoin quote', () => {
    expect(codes(clean)).not.toContain('quote-has-beta');
  });

  it('flags a floating quote asset and escalates on its volatility', () => {
    const equity: ScreenFacts = { ...clean, quoteKind: 'floating', quoteVolatilityPct: 55 };
    const verdict = screen(equity, policy);
    const beta = verdict.findings.find((f) => f.code === 'quote-has-beta');
    expect(beta?.severity).toBe('warn');
    expect(beta?.message).toMatch(/product of two moves/);
  });

  it('treats a calm floating quote as worth noting, not warning', () => {
    const calm: ScreenFacts = { ...clean, quoteKind: 'floating', quoteVolatilityPct: 12 };
    expect(screen(calm, policy).findings.find((f) => f.code === 'quote-has-beta')?.severity).toBe(
      'note',
    );
  });

  it('degrades to pair-only analysis when no dollar reference exists', () => {
    const dark: ScreenFacts = {
      ...clean,
      usdPerQuote: null,
      quoteKind: 'unreferenced',
      quoteVolatilityPct: null,
    };
    const verdict = screen(dark, policy);
    expect(verdict.maxSizeUsd).toBeNull();
    expect(verdict.findings.map((f) => f.code)).toEqual(
      expect.arrayContaining(['no-usd-reference', 'quote-unreferenced']),
    );
  });
});

describe('outcome ranking', () => {
  it('reports the worst severity present', () => {
    expect(screen({ ...clean, canMint: true, topHolderPct: 40 }, policy).outcome).toBe('block');
    expect(screen({ ...clean, topHolderPct: 40 }, policy).outcome).toBe('warn');
  });

  it('is a pure function of its inputs', () => {
    expect(screen(clean, policy)).toEqual(screen(clean, policy));
  });
});
