import { describe, expect, it } from 'vitest';
import { basis, floating, markFrom, pegged, unreferenced } from './price.ts';
import type { Mark } from './types.ts';

const mark = (quotePerBase: number, usdPerQuote: number | null): Mark => ({
  t: 0,
  quotePerBase,
  usdPerQuote,
});

describe('basis', () => {
  it('reads the pair ratio directly in quote terms', () => {
    expect(basis(mark(0.25, 180), 'quote')).toBe(0.25);
  });

  it('multiplies through the quote asset for a dollar basis', () => {
    expect(basis(mark(0.25, 180), 'usd')).toBe(45);
  });

  it('returns null rather than assuming a dollar for an unreferenced quote', () => {
    // The failure mode this prevents: silently substituting 1 and reporting a
    // memecoin-denominated price as dollars.
    expect(basis(mark(0.25, null), 'usd')).toBeNull();
    expect(basis(mark(0.25, null), 'quote')).toBe(0.25);
  });
});

describe('references', () => {
  it('answers a constant for a peg', async () => {
    expect(await pegged().usdPerUnit(0)).toBe(1);
    expect(await pegged('eur-ish', 1.08).usdPerUnit(0)).toBe(1.08);
  });

  it('answers null for an unreferenced asset', async () => {
    expect(await unreferenced.usdPerUnit(0)).toBeNull();
  });

  it('caches a floating price inside the staleness window', async () => {
    let calls = 0;
    const ref = floating('nvda', async () => (calls += 1) && 180, { maxStaleMs: 1_000 });
    await ref.usdPerUnit(0);
    await ref.usdPerUnit(500);
    expect(calls).toBe(1);
    await ref.usdPerUnit(5_000);
    expect(calls).toBe(2);
  });

  it('serves a stale print through a fetch failure, inside the window', async () => {
    let fail = false;
    const ref = floating(
      'nvda',
      async () => {
        if (fail) throw new Error('oracle down');
        return 180;
      },
      { maxStaleMs: 10_000 },
    );
    await ref.usdPerUnit(0);
    fail = true;
    expect(await ref.usdPerUnit(5_000)).toBe(180);
  });

  it('gives up rather than serving a print older than the window', async () => {
    let fail = false;
    const ref = floating(
      'nvda',
      async () => {
        if (fail) throw new Error('oracle down');
        return 180;
      },
      { maxStaleMs: 1_000 },
    );
    await ref.usdPerUnit(0);
    fail = true;
    expect(await ref.usdPerUnit(60_000)).toBeNull();
  });

  it('rejects a nonsensical print instead of passing it through', async () => {
    const ref = floating('broken', async () => 0);
    expect(await ref.usdPerUnit(0)).toBeNull();
    expect(await floating('nan', async () => Number.NaN).usdPerUnit(0)).toBeNull();
  });

  it('assembles a mark from a pool price and a reference', async () => {
    expect(await markFrom(7, 0.5, pegged())).toEqual({ t: 7, quotePerBase: 0.5, usdPerQuote: 1 });
  });
});
