import { describe, expect, it } from 'vitest';
import { SYNC_TOPIC, decodeSync, scanSync, syncFeed } from './sync.ts';
import type { LogEntry, LogFilter, RpcClient } from './types.ts';
import { pegged, unreferenced } from '../price.ts';
import type { Address, Market } from '../types.ts';

const BASE: Address = '0x00000000000000000000000000000000000000aa';
const QUOTE: Address = '0x00000000000000000000000000000000000000bb';
const POOL: Address = '0x00000000000000000000000000000000000000cc';

const market: Market = {
  base: { chainId: 4663, address: BASE, symbol: 'MEME', decimals: 18 },
  quote: { chainId: 4663, address: QUOTE, symbol: 'QUOTE', decimals: 6 },
  pool: POOL,
  venue: 'uniswap-v2',
};

const E18 = 10n ** 18n;
const E6 = 10n ** 6n;
const word = (value: bigint) => value.toString(16).padStart(64, '0');

function syncLog(block: bigint, reserve0: bigint, reserve1: bigint, logIndex = 0): LogEntry {
  return {
    address: POOL,
    topics: [SYNC_TOPIC],
    data: `0x${word(reserve0)}${word(reserve1)}`,
    blockNumber: block,
    logIndex,
    transactionHash: `0x${block.toString(16).padStart(64, '0')}`,
  };
}

/** A node holding a fixed set of logs, recording how it was queried. */
function fakeRpc(logs: LogEntry[], head: bigint) {
  const ranges: { from: bigint; to: bigint }[] = [];
  let timestampCalls = 0;

  const rpc: RpcClient = {
    call: async () => '0x',
    async getLogs(filter: LogFilter) {
      ranges.push({ from: filter.fromBlock, to: filter.toBlock });
      return logs.filter(
        (log) => log.blockNumber >= filter.fromBlock && log.blockNumber <= filter.toBlock,
      );
    },
    async blockNumber() {
      return head;
    },
    async blockTimestamps(blocks) {
      timestampCalls += 1;
      return new Map(blocks.map((block) => [block, Number(block) * 100]));
    },
  };
  return { rpc, ranges, timestamps: () => timestampCalls };
}

describe('decoding', () => {
  it('reads both reserves out of the log data', () => {
    expect(decodeSync(syncLog(1n, 1_000n * E18, 100n * E6))).toEqual({
      reserve0: 1_000n * E18,
      reserve1: 100n * E6,
    });
  });

  it('refuses a log that is not a Sync', () => {
    const wrong = { ...syncLog(1n, 1n, 1n), topics: ['0xdeadbeef' as const] };
    expect(() => decodeSync(wrong)).toThrow(/not a Sync/);
  });

  it('refuses truncated data rather than decoding garbage', () => {
    expect(() => decodeSync({ ...syncLog(1n, 1n, 1n), data: `0x${word(1n)}` })).toThrow(
      /too short/,
    );
  });
});

describe('the tape becomes a path', () => {
  it('returns one observation per reserve change, in order', async () => {
    const logs = [
      syncLog(10n, 1_000n * E18, 100n * E6),
      syncLog(11n, 1_000n * E18, 130n * E6),
      syncLog(12n, 1_000n * E18, 90n * E6),
    ];
    const { rpc } = fakeRpc(logs, 100n);
    const scan = await scanSync(rpc, market, pegged(), true, 0n);

    expect(scan.observations.map((o) => o.mark.quotePerBase)).toEqual([0.1, 0.13, 0.09]);
    expect(scan.observations.map((o) => o.mark.t)).toEqual([1000, 1100, 1200]);
  });

  it('surfaces an excursion a polled feed would have missed entirely', async () => {
    // Polling at blocks 10 and 13 sees a flat price. The pool went to 0.04 in
    // between, through any stop set under it.
    const logs = [
      syncLog(10n, 1_000n * E18, 100n * E6),
      syncLog(11n, 1_000n * E18, 40n * E6),
      syncLog(12n, 1_000n * E18, 98n * E6),
      syncLog(13n, 1_000n * E18, 100n * E6),
    ];
    const { rpc } = fakeRpc(logs, 100n);
    const scan = await scanSync(rpc, market, pegged(), true, 0n);
    const low = Math.min(...scan.observations.map((o) => o.mark.quotePerBase));
    expect(low).toBeCloseTo(0.04, 12);
  });

  it('orders several events inside one block by log index', async () => {
    const logs = [
      syncLog(10n, 1_000n * E18, 120n * E6, 4),
      syncLog(10n, 1_000n * E18, 100n * E6, 1),
      syncLog(10n, 1_000n * E18, 110n * E6, 2),
    ];
    const { rpc } = fakeRpc(logs, 100n);
    const scan = await scanSync(rpc, market, pegged(), true, 0n);
    expect(scan.observations.map((o) => o.mark.quotePerBase)).toEqual([0.1, 0.11, 0.12]);
  });

  it('swaps reserve order when the base token is token1', async () => {
    const { rpc } = fakeRpc([syncLog(10n, 100n * E6, 1_000n * E18)], 100n);
    const scan = await scanSync(rpc, market, pegged(), false, 0n);
    expect(scan.observations[0]?.pool.reserveBase).toBe(1_000n * E18);
    expect(scan.observations[0]?.mark.quotePerBase).toBeCloseTo(0.1, 12);
  });

  it('records liquidity leaving, because for an exit that is a price move', async () => {
    const logs = [
      syncLog(10n, 1_000n * E18, 100n * E6),
      syncLog(11n, 500n * E18, 50n * E6), // half the pool burned; price unchanged
    ];
    const { rpc } = fakeRpc(logs, 100n);
    const scan = await scanSync(rpc, market, pegged(), true, 0n);
    expect(scan.observations[1]?.mark.quotePerBase).toBeCloseTo(0.1, 12);
    expect(scan.observations[1]?.pool.reserveQuote).toBe(50n * E6);
  });

  it('skips an emptied pool instead of dividing by zero', async () => {
    const { rpc } = fakeRpc([syncLog(10n, 1_000n * E18, 0n)], 100n);
    const scan = await scanSync(rpc, market, pegged(), true, 0n);
    expect(scan.observations).toHaveLength(0);
  });
});

describe('resumability', () => {
  it('leaves unconfirmed blocks at the head alone', async () => {
    const logs = [syncLog(95n, 1_000n * E18, 100n * E6), syncLog(99n, 1_000n * E18, 200n * E6)];
    const { rpc } = fakeRpc(logs, 100n);
    const scan = await scanSync(rpc, market, pegged(), true, 0n, { confirmations: 5n });
    // Block 99 sits inside the reorg window and is not in the tape yet.
    expect(scan.observations).toHaveLength(1);
    expect(scan.scanned.to).toBe(95n);
    expect(scan.nextBlock).toBe(96n);
  });

  it('does nothing when the cursor is already past the confirmed head', async () => {
    const { rpc } = fakeRpc([], 100n);
    const scan = await scanSync(rpc, market, pegged(), true, 200n);
    expect(scan.observations).toHaveLength(0);
    expect(scan.nextBlock).toBe(200n);
  });

  it('chunks a long catch-up into ranges the provider will accept', async () => {
    const { rpc, ranges } = fakeRpc([], 9_999n);
    await scanSync(rpc, market, pegged(), true, 0n, { maxRange: 1_000n, confirmations: 0n });

    // Ranges are inclusive on both ends and must tile the span with no gaps.
    expect(ranges).toHaveLength(10);
    expect(ranges[0]).toEqual({ from: 0n, to: 999n });
    expect(ranges.at(-1)).toEqual({ from: 9_000n, to: 9_999n });
    for (let i = 1; i < ranges.length; i += 1) {
      expect(ranges[i]!.from).toBe(ranges[i - 1]!.to + 1n);
    }
  });

  it('clamps the final chunk to the confirmed head rather than overshooting', () => {
    // A provider that caps ranges will reject a toBlock past the head, and a
    // silently clamped request leaves a gap the cursor thinks it covered.
    return (async () => {
      const { rpc, ranges } = fakeRpc([], 1_500n);
      await scanSync(rpc, market, pegged(), true, 0n, { maxRange: 1_000n, confirmations: 0n });
      expect(ranges.at(-1)).toEqual({ from: 1_000n, to: 1_500n });
    })();
  });

  it('resumes after the last log it consumed when the scan is capped', async () => {
    // A capped catch-up that resumed after the scanned RANGE would silently
    // drop every event it did not get to.
    const logs = [10n, 11n, 12n, 13n, 14n].map((block) =>
      syncLog(block, 1_000n * E18, 100n * E6),
    );
    const { rpc } = fakeRpc(logs, 100n);
    const scan = await scanSync(rpc, market, pegged(), true, 0n, { maxObservations: 3 });
    expect(scan.observations).toHaveLength(3);
    expect(scan.nextBlock).toBe(13n);
  });

  it('picks up exactly where the previous scan stopped', async () => {
    const logs = [10n, 20n, 30n].map((block, i) =>
      syncLog(block, 1_000n * E18, BigInt(100 + i * 10) * E6),
    );
    const { rpc } = fakeRpc(logs, 100n);
    const first = await scanSync(rpc, market, pegged(), true, 0n, { maxObservations: 2 });
    const second = await scanSync(rpc, market, pegged(), true, first.nextBlock);
    expect(first.observations).toHaveLength(2);
    expect(second.observations).toHaveLength(1);
    expect(second.observations[0]?.mark.quotePerBase).toBeCloseTo(0.12, 12);
  });

  it('fetches block timestamps in one batched round, not one call per log', async () => {
    const logs = [10n, 10n, 11n].map((block, i) => syncLog(block, 1_000n * E18, 100n * E6, i));
    const { rpc, timestamps } = fakeRpc(logs, 100n);
    await scanSync(rpc, market, pegged(), true, 0n);
    expect(timestamps()).toBe(1);
  });
});

describe('as a feed', () => {
  it('drains buffered observations one poll at a time and then reports empty', async () => {
    const logs = [10n, 11n].map((block, i) =>
      syncLog(block, 1_000n * E18, BigInt(100 + i * 50) * E6),
    );
    const { rpc } = fakeRpc(logs, 100n);
    const feed = syncFeed(rpc, market, pegged(), true, 0n);

    expect((await feed.poll(0))?.mark.quotePerBase).toBeCloseTo(0.1, 12);
    expect((await feed.poll(0))?.mark.quotePerBase).toBeCloseTo(0.15, 12);
    expect(await feed.poll(0)).toBeNull();
  });

  it('advances its cursor so a restart does not replay the tape', async () => {
    const { rpc } = fakeRpc([syncLog(10n, 1_000n * E18, 100n * E6)], 100n);
    const feed = syncFeed(rpc, market, pegged(), true, 0n);
    expect(feed.cursor()).toBe(0n);
    await feed.poll(0);
    expect(feed.cursor()).toBe(96n);
  });

  it('still produces marks when the quote asset has no dollar reference', async () => {
    const { rpc } = fakeRpc([syncLog(10n, 1_000n * E18, 100n * E6)], 100n);
    const feed = syncFeed(rpc, market, unreferenced, true, 0n);
    const observation = await feed.poll(0);
    expect(observation?.mark.usdPerQuote).toBeNull();
    expect(observation?.mark.quotePerBase).toBeCloseTo(0.1, 12);
  });
});
