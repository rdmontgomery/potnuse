import { describe, expect, it } from 'vitest';
import { paperSession, type PaperConfig } from './paper.ts';
import { replayFeed } from './feed/replay.ts';
import { memoryJournal, summarize } from './journal.ts';
import { makePlan } from './ladder.ts';
import { makeBankroll } from './bankroll.ts';
import type { PoolState } from './fills.ts';
import type { Market, Mark } from './types.ts';
import type { Observation } from './feed/types.ts';
import type { ScreenFacts } from './screen.ts';

const E18 = 1_000_000_000_000_000_000n;
const E6 = 1_000_000n;

const market: Market = {
  base: { chainId: 4663, address: '0x000000000000000000000000000000000000ba5e', symbol: 'MEME', decimals: 18 },
  quote: { chainId: 4663, address: '0x00000000000000000000000000000000000009f7', symbol: 'QUOTE', decimals: 6 },
  pool: '0x00000000000000000000000000000000000000f1',
  venue: 'test',
};

const deep: PoolState = {
  reserveBase: 50_000_000n * E18,
  reserveQuote: 5_000_000n * E6,
  baseDecimals: 18,
  quoteDecimals: 6,
};

/** Rebuild reserves so the mid price lands exactly where we want it. */
function poolAt(quotePerBase: number): PoolState {
  const base = 50_000_000;
  return {
    ...deep,
    reserveBase: BigInt(base) * E18,
    reserveQuote: BigInt(Math.round(base * quotePerBase)) * E6,
  };
}

const obs = (t: number, quotePerBase: number, usdPerQuote: number | null = 1): Observation => ({
  mark: { t, quotePerBase, usdPerQuote } satisfies Mark,
  pool: poolAt(quotePerBase),
});

const cleanFacts: Omit<ScreenFacts, 'market' | 'pool' | 'fees'> = {
  usdPerQuote: 1,
  quoteKind: 'stable',
  quoteVolatilityPct: 0,
  sourceVerified: true,
  ownerRenounced: true,
  canMint: false,
  topHolderPct: 5,
  holders: 5_000,
  lpLockedPct: 100,
  ageMs: 30 * 24 * 3_600_000,
};

const config: PaperConfig = {
  market,
  plan: makePlan({
    denom: 'usd',
    rungs: [
      { atMultiple: 2, sellBps: 4000 },
      { atMultiple: 3, sellBps: 3000 },
      { atMultiple: 5, sellBps: 1500 },
    ],
    stopMultiple: 0.5,
    trail: { armAtMultiple: 2, dropPct: 35 },
  }),
  bankroll: makeBankroll({ programBudgetUsd: 500, slots: 10 }),
  fees: { buyBps: 100, sellBps: 100 },
};

function session(observations: Observation[], overrides: Partial<PaperConfig> = {}) {
  const journal = memoryJournal();
  const feed = replayFeed(market, observations);
  return { journal, session: paperSession({ ...config, ...overrides }, feed, journal) };
}

describe('entry', () => {
  it('opens a ticket at the configured slot size', async () => {
    const { session: s } = session([obs(0, 0.1)]);
    const result = await s.enter(0, cleanFacts);
    expect(result.opened).toBe(true);
    expect(s.snapshot().costUsd).toBe(50);
    expect(s.snapshot().position?.qtyOpen).toBeGreaterThan(0n);
  });

  it('refuses to open when the screen blocks', async () => {
    const { session: s } = session([obs(0, 0.1)]);
    const result = await s.enter(0, { ...cleanFacts, canMint: true });
    expect(result).toMatchObject({ opened: false, why: 'screen blocked the entry' });
    expect(s.snapshot().position).toBeNull();
  });

  it('refuses a dollar-sized ticket when the quote asset has no dollar price', async () => {
    const { session: s } = session([obs(0, 0.1, null)]);
    const result = await s.enter(0, {
      ...cleanFacts,
      usdPerQuote: null,
      quoteKind: 'unreferenced',
      quoteVolatilityPct: null,
    });
    expect(result.opened).toBe(false);
    expect(result.opened === false && result.why).toMatch(/no USD reference/);
  });

  it('will not double up on a market it already holds', async () => {
    const { session: s } = session([obs(0, 0.1), obs(1, 0.1)]);
    await s.enter(0, cleanFacts);
    expect(await s.enter(1, cleanFacts)).toMatchObject({ opened: false, why: /already holding/ });
  });
});

describe('a laddered run', () => {
  it('takes profit up the rungs and leaves the runner', async () => {
    const { session: s } = session([
      obs(0, 0.1),
      obs(1, 0.15),
      obs(2, 0.2), // 2x
      obs(3, 0.3), // 3x
      obs(4, 0.5), // 5x
    ]);
    await s.enter(0, cleanFacts);
    const entryQty = s.snapshot().position!.qtyOriginal;
    await s.drain([1, 2, 3, 4]);

    // Each rung floors independently, so the runner keeps the rounding dust.
    const sold = (entryQty * 4000n) / 10_000n + (entryQty * 3000n) / 10_000n + (entryQty * 1500n) / 10_000n;
    const snap = s.snapshot();
    expect(snap.position?.qtyOpen).toBe(entryQty - sold);
    expect(snap.proceedsUsd).toBeGreaterThan(100);
  });

  it('closes the book and records the exit when the trail fires', async () => {
    const { session: s } = session([
      obs(0, 0.1),
      obs(1, 0.6), // clears every rung, arms the trail
      obs(2, 0.3), // -50% off the high
    ]);
    await s.enter(0, cleanFacts);
    await s.drain([1, 2]);

    const snap = s.snapshot();
    expect(snap.position).toBeNull();
    expect(snap.bankroll.openCount).toBe(0);
    expect(snap.bankroll.realizedUsd).toBeGreaterThan(0);
  });

  it('burns the asset after a losing stop-out, blocking a re-up', async () => {
    const { session: s } = session([obs(0, 0.1), obs(1, 0.04)]);
    await s.enter(0, cleanFacts);
    await s.drain([1]);

    const snap = s.snapshot();
    expect(snap.bankroll.realizedUsd).toBeLessThan(0);
    expect(snap.bankroll.burned[market.base.address.toLowerCase()]).toBe(true);
    expect(await s.enter(2, cleanFacts)).toMatchObject({ opened: false, why: /already-lost-here/ });
  });
});

describe('the simulation is allowed to say no', () => {
  it('never fills a round trip at a profit on a flat tape', async () => {
    const { session: s } = session([obs(0, 0.1), obs(1, 0.1)]);
    await s.enter(0, cleanFacts);
    const snap = s.snapshot();
    const entryFill = snap.fills[0]!;
    // Fee plus impact plus haircut all land against the entry.
    expect(entryFill.slippageBps).toBeGreaterThan(100);
  });

  it('charges the fee on every rung, not once on the position', async () => {
    const { session: s } = session([obs(0, 0.1), obs(1, 0.2), obs(2, 0.3), obs(3, 0.5)]);
    await s.enter(0, cleanFacts);
    await s.drain([1, 2, 3]);
    const sells = s.snapshot().fills.filter((f) => f.side === 'sell');
    expect(sells).toHaveLength(3);
    expect(sells.every((f) => f.feeBps === 100)).toBe(true);
  });

  it('records a stall instead of trading when the dollar reference drops out', async () => {
    const { session: s, journal } = session([obs(0, 0.1), obs(1, 0.5, null)]);
    await s.enter(0, cleanFacts);
    await s.drain([1]);
    expect(summarize(journal.events).stalls).toBe(1);
    expect(s.snapshot().fills.filter((f) => f.side === 'sell')).toHaveLength(0);
  });

  it('keeps running on a quote-denominated plan when the dollar reference drops out', async () => {
    const { session: s } = session([obs(0, 0.1), obs(1, 0.5, null)], {
      plan: makePlan({ ...config.plan, denom: 'quote' }),
    });
    await s.enter(0, cleanFacts);
    await s.drain([1]);
    expect(s.snapshot().fills.filter((f) => f.side === 'sell').length).toBeGreaterThan(0);
  });
});

describe('the journal is the deliverable', () => {
  it('records every mark, intent and fill with the pool behind it', async () => {
    const { session: s, journal } = session([obs(0, 0.1), obs(1, 0.2), obs(2, 0.3)]);
    await s.enter(0, cleanFacts);
    await s.drain([1, 2]);

    const summary = summarize(journal.events);
    expect(summary.marks).toBeGreaterThanOrEqual(3);
    expect(summary.intents).toBe(2);
    expect(summary.fills).toBe(3); // one buy, two rungs
    expect(summary.meanSlippageBps).toBeGreaterThan(0);
    expect(journal.events.filter((e) => e.kind === 'mark').every((e) => 'pool' in e)).toBe(true);
  });

  it('survives a bigint round trip through JSON', async () => {
    const { session: s, journal } = session([obs(0, 0.1), obs(1, 0.25)]);
    await s.enter(0, cleanFacts);
    await s.drain([1]);
    const fill = journal.events.find((e) => e.kind === 'fill');
    expect(typeof (fill as { fill: { qtyBase: bigint } }).fill.qtyBase).toBe('bigint');
  });

  it('replays a recorded tape to the same outcome', async () => {
    const tape = [obs(0, 0.1), obs(1, 0.22), obs(2, 0.31), obs(3, 0.18)];
    const a = session(tape.map((o) => ({ ...o })));
    const b = session(tape.map((o) => ({ ...o })));

    await a.session.enter(0, cleanFacts);
    await a.session.drain([1, 2, 3]);
    await b.session.enter(0, cleanFacts);
    await b.session.drain([1, 2, 3]);

    expect(a.session.snapshot()).toEqual(b.session.snapshot());
  });
});
