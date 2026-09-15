import { describe, expect, it } from 'vitest';
import { barSession, type BarPaperConfig } from './barpaper.ts';
import { makeBankroll } from './bankroll.ts';
import { makePlan } from './ladder.ts';
import { memoryJournal, summarize } from './journal.ts';
import type { Bar, PairQuote } from './quotes/types.ts';
import type { ScreenFacts } from './screen.ts';

const MINUTE = 60_000;

const bar = (n: number, open: number, high: number, low: number, close: number): Bar => ({
  t: n * MINUTE,
  open,
  high,
  low,
  close,
  volume: 1000,
});

const pengu: PairQuote = {
  chain: 'solana',
  pairId: '8sLbNZoA1cfnvMJLPfp98ZLAnFSYCFApfJKMbiXNLwxj',
  dex: 'raydium',
  baseSymbol: 'PENGU',
  baseAddress: 'B4Vwozy1FGtp8SELXSXydWSzavPUGnJ77DURV2k4MhUV',
  quoteSymbol: 'SOL',
  quoteAddress: 'So111',
  priceUsd: 1,
  priceNative: null,
  liquidityUsd: 2_000_000,
  volume24hUsd: 5_000_000,
};

const config: BarPaperConfig = {
  pair: pengu,
  plan: makePlan({
    denom: 'usd',
    rungs: [
      { atMultiple: 2, sellBps: 4000 },
      { atMultiple: 3, sellBps: 3000 },
    ],
    stopMultiple: 0.5,
    trail: { armAtMultiple: 2, dropPct: 35 },
  }),
  bankroll: makeBankroll({ programBudgetUsd: 500, slots: 10 }),
  fees: { buyBps: 30, sellBps: 30 },
};

const clean: Omit<ScreenFacts, 'market' | 'pool' | 'fees'> = {
  usdPerQuote: 1,
  quoteKind: 'stable',
  quoteVolatilityPct: 0,
  sourceVerified: true,
  ownerRenounced: true,
  canMint: false,
  topHolderPct: 5,
  holders: 9000,
  lpLockedPct: 100,
  ageMs: 90 * 24 * 3_600_000,
};

const session = (overrides: Partial<BarPaperConfig> = {}) => {
  const journal = memoryJournal();
  return { journal, s: barSession({ ...config, ...overrides }, journal) };
};

describe('entry', () => {
  it('opens a ticket at the slot size from a pair quote alone', async () => {
    const { s } = session();
    const result = await s.enter(0, clean);
    expect(result.opened).toBe(true);
    expect(s.state().costUsd).toBe(50);
    expect(s.state().position?.qtyOpen).toBeGreaterThan(0n);
  });

  it('works for a venue it knows nothing about', async () => {
    // A base58 Solana pool id with no chain semantics attached.
    const { s } = session();
    await s.enter(0, clean);
    expect(s.market.pool).toBe(pengu.pairId);
    expect(s.market.venue).toBe('raydium');
  });

  it('refuses without a dollar price', async () => {
    const { s } = session({ pair: { ...pengu, priceUsd: null } });
    expect(await s.enter(0, clean)).toMatchObject({ opened: false, why: /no dollar price/ });
  });

  it('refuses without a liquidity figure, since size cannot be checked', async () => {
    const { s } = session({ pair: { ...pengu, liquidityUsd: null } });
    expect(await s.enter(0, clean)).toMatchObject({ opened: false, why: /no liquidity figure/ });
  });

  it('refuses when the screen blocks', async () => {
    const { s } = session();
    expect(await s.enter(0, { ...clean, canMint: true })).toMatchObject({
      opened: false,
      why: 'screen blocked the entry',
    });
  });

  it('blocks a ticket the pool cannot return', async () => {
    const { s } = session({
      pair: { ...pengu, liquidityUsd: 900 },
      bankroll: makeBankroll({ programBudgetUsd: 5_000, slots: 1 }),
    });
    expect((await s.enter(0, clean)).opened).toBe(false);
  });
});

describe('running the ladder over candles', () => {
  it('takes profit up the rungs and leaves the runner', async () => {
    const { s } = session();
    await s.enter(0, clean);
    const original = s.state().position!.qtyOriginal;
    await s.advance([bar(1, 1, 1.5, 0.9, 1.4), bar(2, 1.4, 3.2, 1.4, 3.1)]);

    const sold = (original * 4000n) / 10_000n + (original * 3000n) / 10_000n;
    expect(s.state().position?.qtyOpen).toBe(original - sold);
    expect(s.state().proceedsUsd).toBeGreaterThan(0);
  });

  it('stops out on a wick inside a bar', async () => {
    const { s } = session();
    await s.enter(0, clean);
    await s.advance([bar(1, 1, 1.2, 0.3, 1.1)]);
    expect(s.state().position).toBeNull();
    expect(s.state().bankroll.realizedUsd).toBeLessThan(0);
  });

  it('burns the pair after a loss so it cannot be re-upped', async () => {
    const { s } = session();
    await s.enter(0, clean);
    await s.advance([bar(1, 1, 1, 0.2, 0.25)]);
    expect(await s.enter(2 * MINUTE, clean)).toMatchObject({ why: /already-lost-here/ });
  });

  it('charges fee and impact on every rung, not once on the position', async () => {
    const { s } = session();
    await s.enter(0, clean);
    await s.advance([bar(1, 1, 3.5, 1, 3.4)]);
    const sells = s.fills().filter((f) => f.side === 'sell');
    expect(sells).toHaveLength(2);
    expect(sells.every((f) => f.slippageBps > 0)).toBe(true);
  });

  it('never turns a flat tape into a profit', async () => {
    const { s } = session();
    await s.enter(0, clean);
    await s.advance([bar(1, 1, 1.01, 0.99, 1), bar(2, 1, 1.01, 0.99, 1)]);
    expect(s.state().proceedsUsd).toBe(0);
    expect(s.fills()[0]?.slippageBps).toBeGreaterThan(0);
  });

  it('records a mark for every bar, whether or not anything is held', async () => {
    const { s, journal } = session();
    await s.advance([bar(1, 1, 1, 1, 1), bar(2, 1, 1, 1, 1)]);
    expect(summarize(journal.events).marks).toBe(2);
    expect(summarize(journal.events).fills).toBe(0);
  });

  it('reports how many bars it consumed, so a cursor can advance', async () => {
    const { s } = session();
    expect(await s.advance([bar(1, 1, 1, 1, 1), bar(2, 1, 1, 1, 1)])).toBe(2);
  });

  it('resumes from restored state across a restart', async () => {
    const first = session();
    await first.s.enter(0, clean);
    const saved = first.s.state();

    const journal = memoryJournal();
    const resumed = barSession(config, journal, saved);
    await resumed.advance([bar(5, 1, 3.2, 1, 3.1)]);
    expect(resumed.state().proceedsUsd).toBeGreaterThan(0);
    expect(resumed.state().position?.qtyOpen).toBeLessThan(saved.position!.qtyOpen);
  });
});
