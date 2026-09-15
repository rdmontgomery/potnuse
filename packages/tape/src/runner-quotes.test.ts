import { describe, expect, it } from 'vitest';
import { isQuoteMarket, runQuotes, type QuoteMarketConfig } from './runner-quotes.ts';
import { memoryStore } from './store/memory.ts';
import { makeBankroll } from './bankroll.ts';
import { makePlan } from './ladder.ts';
import type { Bar, PairQuote, QuoteSource } from './quotes/types.ts';
import type { TapeStore } from './store/types.ts';

const MINUTE = 60_000;
const bar = (n: number, open: number, high: number, low: number, close: number): Bar => ({
  t: n * MINUTE,
  open,
  high,
  low,
  close,
  volume: null,
});

const pair: PairQuote = {
  chain: 'solana',
  pairId: 'pool-1',
  dex: 'raydium',
  baseSymbol: 'PENGU',
  baseAddress: 'B4Vw',
  quoteSymbol: 'SOL',
  quoteAddress: 'So111',
  priceUsd: 1,
  priceNative: null,
  liquidityUsd: 2_000_000,
  volume24hUsd: 1_000_000,
};

const config = (overrides: Partial<QuoteMarketConfig> = {}): QuoteMarketConfig => ({
  kind: 'quotes',
  pair,
  barMinutes: 5,
  plan: makePlan({
    denom: 'usd',
    rungs: [{ atMultiple: 2, sellBps: 5000 }],
    stopMultiple: 0.5,
  }),
  bankroll: makeBankroll({ programBudgetUsd: 500, slots: 10 }),
  fees: { buyBps: 30, sellBps: 30 },
  ...overrides,
});

function source(bars: Bar[], pairs: PairQuote[] = [pair]): QuoteSource & { calls: string[] } {
  const calls: string[] = [];
  return {
    calls,
    name: 'fake',
    async pairsFor(token) {
      calls.push(`pairs:${token}`);
      return pairs;
    },
    async bars() {
      calls.push('bars');
      return bars;
    },
  };
}

async function withMarket(cfg: QuoteMarketConfig = config()) {
  const store = memoryStore();
  await store.putMarket({ id: cfg.pair.pairId, config: cfg, active: true });
  return store;
}

describe('recognising a quote market', () => {
  it('spots one by its kind', () => {
    expect(isQuoteMarket(config())).toBe(true);
    expect(isQuoteMarket({ kind: 'chain' })).toBe(false);
    expect(isQuoteMarket(null)).toBe(false);
  });

  it('leaves chain-driven markets to the other runner', async () => {
    const store = memoryStore();
    await store.putMarket({ id: 'evm', config: { feed: { kind: 'sync' } }, active: true });
    const summary = await runQuotes({ store, source: source([]) });
    expect(summary.markets).toEqual([]);
  });
});

describe('a firing', () => {
  it('consumes bars and advances the cursor to the last one', async () => {
    const store = await withMarket();
    const summary = await runQuotes({
      store,
      source: source([bar(1, 1, 1, 1, 1), bar(2, 1, 1, 1, 1)]),
    });
    expect(summary.bars).toBe(2);
    expect(await store.getCursor('pool-1')).toBe(BigInt(2 * MINUTE));
  });

  it('does not re-consume bars it has already seen', async () => {
    const store = await withMarket();
    const bars = [bar(1, 1, 1, 1, 1), bar(2, 1, 1, 1, 1)];
    await runQuotes({ store, source: source(bars) });
    const second = await runQuotes({ store, source: source([...bars, bar(3, 1, 1, 1, 1)]) });
    expect(second.bars).toBe(1);
  });

  it('does nothing and keeps its cursor when no bars are new', async () => {
    const store = await withMarket();
    const bars = [bar(1, 1, 1, 1, 1)];
    await runQuotes({ store, source: source(bars) });
    const second = await runQuotes({ store, source: source(bars) });
    expect(second.bars).toBe(0);
    expect(await store.getCursor('pool-1')).toBe(BigInt(MINUTE));
  });

  it('records every firing, quiet ones included', async () => {
    const store = await withMarket();
    await runQuotes({ store, source: source([]) });
    expect(store.runs).toHaveLength(1);
  });
});

describe('carrying a position across firings', () => {
  it('ladders a stored position out on a later bar', async () => {
    const store = await withMarket();
    await store.setPosition('pool-1', {
      position: {
        entryBasis: 1,
        qtyOriginal: 100n * 10n ** 18n,
        qtyOpen: 100n * 10n ** 18n,
        rungsFilled: [false],
        highWater: 1,
        trailArmed: false,
        openedAt: 0,
        closedAt: null,
      },
      costUsd: 50,
      proceedsUsd: 0,
    });

    const summary = await runQuotes({ store, source: source([bar(1, 1, 2.2, 1, 2.1)]) });
    expect(summary.markets[0]?.intents).toBe(1);
    const after = await store.getPosition('pool-1');
    expect(after?.position?.qtyOpen).toBe(50n * 10n ** 18n);
    expect(after?.proceedsUsd).toBeGreaterThan(0);
  });
});

describe('keeping depth current', () => {
  it('refreshes the pair before running, so the fill model is not stale', async () => {
    const store = await withMarket();
    const thinner = { ...pair, liquidityUsd: 100_000 };
    const src = source([bar(1, 1, 1, 1, 1)], [thinner]);
    await runQuotes({ store, source: src });

    expect(src.calls).toContain('pairs:B4Vw');
    const saved = (await store.activeMarkets())[0]!.config as QuoteMarketConfig;
    expect(saved.pair.liquidityUsd).toBe(100_000);
  });

  it('keeps the old figure when the refresh fails', async () => {
    const store = await withMarket();
    const src: QuoteSource = {
      name: 'flaky',
      pairsFor: async () => {
        throw new Error('rate limited');
      },
      bars: async () => [bar(1, 1, 1, 1, 1)],
    };
    const summary = await runQuotes({ store, source: src });
    expect(summary.errors).toBe(0);
    const saved = (await store.activeMarkets())[0]!.config as QuoteMarketConfig;
    expect(saved.pair.liquidityUsd).toBe(2_000_000);
  });

  it('can be told not to refresh at all', async () => {
    const store = await withMarket();
    const src = source([bar(1, 1, 1, 1, 1)]);
    await runQuotes({ store, source: src, refreshPair: false });
    expect(src.calls).not.toContain('pairs:B4Vw');
  });
});

describe('failure isolation', () => {
  it('records a source failure against that market and keeps its cursor', async () => {
    const store = await withMarket();
    await store.setCursor('pool-1', 7n);
    const src: QuoteSource = {
      name: 'down',
      pairsFor: async () => [pair],
      bars: async () => {
        throw new Error('502 from upstream');
      },
    };
    const summary = await runQuotes({ store, source: src });
    expect(summary.errors).toBe(1);
    expect(summary.markets[0]?.error).toMatch(/502/);
    expect(await store.getCursor('pool-1')).toBe(7n);
  });

  it('does not advance the cursor past bars the journal failed to keep', async () => {
    const store = await withMarket();
    const failing: TapeStore = {
      ...store,
      append: async () => {
        throw new Error('d1 unavailable');
      },
    };
    const summary = await runQuotes({ store: failing, source: source([bar(1, 1, 1, 1, 1)]) });
    expect(summary.errors).toBe(1);
    expect(await store.getCursor('pool-1')).toBeNull();
  });

  it('bounds how many bars one firing will take', async () => {
    const store = await withMarket();
    const many = Array.from({ length: 40 }, (_, i) => bar(i + 1, 1, 1, 1, 1));
    const summary = await runQuotes({ store, source: source(many), maxBarsPerMarket: 10 });
    expect(summary.bars).toBe(10);
    expect(await store.getCursor('pool-1')).toBe(BigInt(10 * MINUTE));
  });
});
