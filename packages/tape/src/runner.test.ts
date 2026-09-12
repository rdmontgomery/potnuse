import { describe, expect, it } from 'vitest';
import { runOnce, type MarketConfig, type RunnerDeps } from './runner.ts';
import { memoryStore } from './store/memory.ts';
import { SYNC_TOPIC } from './feed/sync.ts';
import { pegged } from './price.ts';
import { makePlan } from './ladder.ts';
import type { LogEntry, RpcClient } from './feed/types.ts';
import type { TapeStore } from './store/types.ts';
import type { Address, Market } from './types.ts';

const E18 = 10n ** 18n;
const E6 = 10n ** 6n;

function marketAt(pool: Address, symbol: string): Market {
  return {
    base: { chainId: 4663, address: '0x00000000000000000000000000000000000000aa', symbol, decimals: 18 },
    quote: { chainId: 4663, address: '0x00000000000000000000000000000000000000bb', symbol: 'USDC', decimals: 6 },
    pool,
    venue: 'uniswap-v2',
  };
}

function config(pool: Address, symbol = 'MEME'): MarketConfig {
  return {
    rpcUrl: 'https://example.invalid',
    market: marketAt(pool, symbol),
    usdRef: { kind: 'pegged' },
    fees: { buyBps: 100, sellBps: 100 },
    baseIsToken0: true,
    plan: makePlan({
      denom: 'usd',
      rungs: [{ atMultiple: 2, sellBps: 4000 }, { atMultiple: 3, sellBps: 3000 }],
      stopMultiple: 0.5,
    }),
    bankroll: { programBudgetUsd: 500, slots: 10 },
    feed: { kind: 'sync', startBlock: 0, confirmations: 0 },
  };
}

const word = (value: bigint) => value.toString(16).padStart(64, '0');

/** Reserve prints at given blocks: [block, quotePerBase]. */
function chain(pool: Address, prints: [bigint, number][], head: bigint) {
  const logs: LogEntry[] = prints.map(([block, price]) => ({
    address: pool,
    topics: [SYNC_TOPIC],
    data: `0x${word(1_000_000n * E18)}${word(BigInt(Math.round(1_000_000 * price)) * E6)}`,
    blockNumber: block,
    logIndex: 0,
    transactionHash: `0x${block.toString(16).padStart(64, '0')}`,
  }));
  const calls = { getLogs: 0 };
  const rpc: RpcClient = {
    call: async () => '0x',
    async getLogs(filter) {
      calls.getLogs += 1;
      return logs.filter(
        (log) => log.blockNumber >= filter.fromBlock && log.blockNumber <= filter.toBlock,
      );
    },
    blockNumber: async () => head,
    blockTimestamps: async (blocks) => new Map(blocks.map((b) => [b, Number(b) * 1000])),
  };
  return { rpc, calls };
}

function deps(store: TapeStore, rpcs: Record<string, RpcClient>): RunnerDeps {
  return {
    store,
    rpcFor: (c) => rpcs[c.market.pool]!,
    usdRefFor: () => pegged(),
    now: () => 1_700_000_000_000,
  };
}

const POOL_A: Address = '0x00000000000000000000000000000000000000c1';
const POOL_B: Address = '0x00000000000000000000000000000000000000c2';

describe('a firing', () => {
  it('does nothing when no market is active', async () => {
    const store = memoryStore();
    const summary = await runOnce(deps(store, {}));
    expect(summary.markets).toEqual([]);
    expect(store.runs).toHaveLength(1);
  });

  it('scans an active market and advances its cursor', async () => {
    const store = memoryStore();
    await store.putMarket({ id: POOL_A, config: config(POOL_A), active: true });
    const { rpc } = chain(POOL_A, [[10n, 0.1], [11n, 0.12]], 100n);

    const summary = await runOnce(deps(store, { [POOL_A]: rpc }));
    expect(summary.observations).toBe(2);
    expect(await store.getCursor(POOL_A)).toBe(101n);
    expect((await store.readJournal(POOL_A)).length).toBeGreaterThan(0);
  });

  it('skips a market that is not active', async () => {
    const store = memoryStore();
    await store.putMarket({ id: POOL_A, config: config(POOL_A), active: false });
    expect((await runOnce(deps(store, {}))).markets).toEqual([]);
  });
});

describe('statelessness', () => {
  it('resumes from the stored cursor instead of replaying the tape', async () => {
    const store = memoryStore();
    await store.putMarket({ id: POOL_A, config: config(POOL_A), active: true });

    const first = chain(POOL_A, [[10n, 0.1]], 20n);
    await runOnce(deps(store, { [POOL_A]: first.rpc }));
    const cursor = await store.getCursor(POOL_A);

    // Same logs, later head: the old print must not be consumed twice.
    const second = chain(POOL_A, [[10n, 0.1], [30n, 0.2]], 40n);
    const summary = await runOnce(deps(store, { [POOL_A]: second.rpc }));

    expect(cursor).toBe(21n);
    expect(summary.observations).toBe(1);
    expect(summary.markets[0]?.fromBlock).toBe('21');
  });

  it('carries an open position across firings and ladders it out on a later one', async () => {
    const store = memoryStore();
    await store.putMarket({ id: POOL_A, config: config(POOL_A), active: true });

    // Firing one: open by hand at 0.1, then let the runner see a flat print.
    const one = chain(POOL_A, [[10n, 0.1]], 20n);
    await runOnce(deps(store, { [POOL_A]: one.rpc }));

    await store.setPosition(POOL_A, {
      position: {
        entryBasis: 0.1,
        qtyOriginal: 100n * E18,
        qtyOpen: 100n * E18,
        rungsFilled: [false, false],
        highWater: 0.1,
        trailArmed: false,
        openedAt: 0,
        closedAt: null,
      },
      costUsd: 50,
      proceedsUsd: 0,
    });

    // Firing two, in a fresh process with nothing in memory: price doubles.
    const two = chain(POOL_A, [[30n, 0.21]], 40n);
    const summary = await runOnce(deps(store, { [POOL_A]: two.rpc }));

    expect(summary.markets[0]?.intents).toBe(1);
    const after = await store.getPosition(POOL_A);
    expect(after?.position?.qtyOpen).toBe(60n * E18);
    expect(after?.proceedsUsd).toBeGreaterThan(0);
  });

  it('shares one bankroll across every market', async () => {
    // A cooldown or budget that applied per market would be no limit at all.
    const store = memoryStore();
    await store.putMarket({ id: POOL_A, config: config(POOL_A, 'AAA'), active: true });
    await store.putMarket({ id: POOL_B, config: config(POOL_B, 'BBB'), active: true });
    await store.setBankroll('paper', {
      deployedUsd: 50,
      committedUsd: 450,
      realizedUsd: -20,
      openCount: 1,
      burned: {},
      lastLossAt: 1,
    });

    const a = chain(POOL_A, [[10n, 0.1]], 20n);
    const b = chain(POOL_B, [[10n, 0.1]], 20n);
    await runOnce(deps(store, { [POOL_A]: a.rpc, [POOL_B]: b.rpc }));

    expect((await store.getBankroll('paper'))?.committedUsd).toBe(450);
  });
});

describe('failure isolation', () => {
  it('records one market failing without costing the others their minute', async () => {
    const store = memoryStore();
    await store.putMarket({ id: POOL_A, config: config(POOL_A, 'AAA'), active: true });
    await store.putMarket({ id: POOL_B, config: config(POOL_B, 'BBB'), active: true });

    const broken: RpcClient = {
      call: async () => '0x',
      getLogs: async () => {
        throw new Error('rpc timeout');
      },
      blockNumber: async () => 100n,
      blockTimestamps: async () => new Map(),
    };
    const healthy = chain(POOL_B, [[10n, 0.1], [11n, 0.2]], 100n);

    const summary = await runOnce(deps(store, { [POOL_A]: broken, [POOL_B]: healthy.rpc }));

    expect(summary.errors).toBe(1);
    expect(summary.markets.find((m) => m.marketId === POOL_A)?.error).toMatch(/rpc timeout/);
    expect(summary.markets.find((m) => m.marketId === POOL_B)?.observations).toBe(2);
    expect(await store.getCursor(POOL_B)).toBe(101n);
  });

  it('leaves the cursor where it was when the market failed', async () => {
    const store = memoryStore();
    await store.putMarket({ id: POOL_A, config: config(POOL_A), active: true });
    await store.setCursor(POOL_A, 7n);

    const broken: RpcClient = {
      call: async () => '0x',
      getLogs: async () => {
        throw new Error('nope');
      },
      blockNumber: async () => 100n,
      blockTimestamps: async () => new Map(),
    };
    await runOnce(deps(store, { [POOL_A]: broken }));
    expect(await store.getCursor(POOL_A)).toBe(7n);
  });

  it('does not advance the cursor past events the journal failed to keep', async () => {
    // Repeat rather than skip: duplicated marks are the same observations,
    // a cursor past unwritten events loses them for good.
    const store = memoryStore();
    await store.putMarket({ id: POOL_A, config: config(POOL_A), active: true });
    const failing: TapeStore = {
      ...store,
      append: async () => {
        throw new Error('d1 unavailable');
      },
    };
    const { rpc } = chain(POOL_A, [[10n, 0.1]], 100n);

    const summary = await runOnce({ ...deps(store, { [POOL_A]: rpc }), store: failing });
    expect(summary.errors).toBe(1);
    expect(await store.getCursor(POOL_A)).toBeNull();
  });

  it('logs every firing, successful or not', async () => {
    const store = memoryStore();
    await store.putMarket({ id: POOL_A, config: config(POOL_A), active: true });
    const broken: RpcClient = {
      call: async () => '0x',
      getLogs: async () => {
        throw new Error('nope');
      },
      blockNumber: async () => 100n,
      blockTimestamps: async () => new Map(),
    };
    await runOnce(deps(store, { [POOL_A]: broken }));
    expect(store.runs[0]?.error).toMatch(/1 of 1 markets failed/);
  });
});

describe('bounded work', () => {
  it('stops at the per-market ceiling and resumes from there next time', async () => {
    const store = memoryStore();
    await store.putMarket({ id: POOL_A, config: config(POOL_A), active: true });
    const prints = Array.from({ length: 12 }, (_, i): [bigint, number] => [
      BigInt(10 + i),
      0.1 + i * 0.001,
    ]);
    const { rpc } = chain(POOL_A, prints, 100n);

    const summary = await runOnce({ ...deps(store, { [POOL_A]: rpc }), maxPerMarket: 5 });
    expect(summary.observations).toBe(5);
    // A firing that hit the ceiling must leave the rest for the next one.
    expect(await store.getCursor(POOL_A)).toBeLessThan(101n);
  });
});
