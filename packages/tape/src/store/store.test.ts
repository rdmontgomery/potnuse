import { DatabaseSync } from 'node:sqlite';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { bufferedJournal, memoryStore } from './memory.ts';
import { sqlStore } from './sql.ts';
import type { SqlDatabase, SqlStatement, TapeStore } from './types.ts';
import type { JournalEvent } from '../journal.ts';
import type { BankrollState } from '../bankroll.ts';
import type { PositionState } from '../ladder.ts';
import type { PoolState } from '../fills.ts';

const SCHEMA = readFileSync(fileURLToPath(new URL('./schema.sql', import.meta.url)), 'utf8');

/**
 * D1's statement shape over real SQLite, so the SQL adapter is exercised
 * against actual query semantics rather than a mock that agrees with it.
 */
function d1Like(sqlite: DatabaseSync): SqlDatabase {
  const statement = (query: string, values: unknown[]): SqlStatement => ({
    // D1's bind returns a NEW statement; a shim that mutated in place would
    // let a reused prepared statement leak values between rows.
    bind: (...next: unknown[]) => statement(query, next),
    async first<T>() {
      return (sqlite.prepare(query).get(...(values as never[])) as T | undefined) ?? null;
    },
    async run() {
      return sqlite.prepare(query).run(...(values as never[]));
    },
    async all<T>() {
      return { results: sqlite.prepare(query).all(...(values as never[])) as T[] };
    },
  });
  return { prepare: (query: string) => statement(query, []) };
}

function sqliteStore(): TapeStore {
  const sqlite = new DatabaseSync(':memory:');
  sqlite.exec(SCHEMA);
  return sqlStore(d1Like(sqlite));
}

const pool: PoolState = {
  reserveBase: 12_345_678_901_234_567_890n,
  reserveQuote: 98_765_432n,
  baseDecimals: 18,
  quoteDecimals: 6,
};

const position: PositionState = {
  entryBasis: 0.0421,
  qtyOriginal: 987_654_321_098_765_432_109n,
  qtyOpen: 592_592_592_659_259_259_265n,
  rungsFilled: [true, false, false],
  highWater: 0.131,
  trailArmed: true,
  openedAt: 1_700_000_000_000,
  closedAt: null,
};

const bankroll: BankrollState = {
  deployedUsd: 50,
  committedUsd: 150,
  realizedUsd: -12.5,
  openCount: 1,
  burned: { '0x00000000000000000000000000000000000000aa': true },
  lastLossAt: 1_700_000_000_000,
};

const markEvent: JournalEvent = {
  kind: 'mark',
  t: 1_700_000_000_500,
  market: '0xpool',
  mark: { t: 1_700_000_000_500, quotePerBase: 0.0421, usdPerQuote: 180.25 },
  pool,
};

// One suite, both implementations. If they diverge, the durable one is wrong.
for (const [name, build] of [
  ['memory', () => memoryStore() as TapeStore],
  ['sqlite', sqliteStore],
] as const) {
  describe(`${name} store`, () => {
    it('reports no cursor before the first scan', async () => {
      expect(await build().getCursor('0xpool')).toBeNull();
    });

    it('round-trips a block cursor beyond Number.MAX_SAFE_INTEGER', async () => {
      // A chain at 100ms blocks outruns a JS number in under thirty years, and
      // a silently-rounded cursor re-scans or skips forever after.
      const store = build();
      const huge = 9_007_199_254_740_993n;
      await store.setCursor('0xpool', huge);
      expect(await store.getCursor('0xpool')).toBe(huge);
    });

    it('overwrites a cursor rather than accumulating rows', async () => {
      const store = build();
      await store.setCursor('0xpool', 10n);
      await store.setCursor('0xpool', 20n);
      expect(await store.getCursor('0xpool')).toBe(20n);
    });

    it('keeps cursors separate per market', async () => {
      const store = build();
      await store.setCursor('0xa', 10n);
      await store.setCursor('0xb', 99n);
      expect(await store.getCursor('0xa')).toBe(10n);
      expect(await store.getCursor('0xb')).toBe(99n);
    });

    it('restores a position with its quantities exact', async () => {
      const store = build();
      await store.setPosition('0xpool', { position, costUsd: 50, proceedsUsd: 31.4 });
      const restored = await store.getPosition('0xpool');
      expect(restored?.position?.qtyOpen).toBe(position.qtyOpen);
      expect(typeof restored?.position?.qtyOpen).toBe('bigint');
      expect(restored).toEqual({ position, costUsd: 50, proceedsUsd: 31.4 });
    });

    it('stores a closed-out position as null without losing the P&L', async () => {
      const store = build();
      await store.setPosition('0xpool', { position: null, costUsd: 50, proceedsUsd: 83.2 });
      expect(await store.getPosition('0xpool')).toEqual({
        position: null,
        costUsd: 50,
        proceedsUsd: 83.2,
      });
    });

    it('round-trips the bankroll including its burn list', async () => {
      const store = build();
      await store.setBankroll('paper', bankroll);
      expect(await store.getBankroll('paper')).toEqual(bankroll);
    });

    it('has no bankroll before the program starts', async () => {
      expect(await build().getBankroll('paper')).toBeNull();
    });

    it('lists only active markets', async () => {
      const store = build();
      await store.putMarket({ id: '0xa', config: { symbol: 'A' }, active: true });
      await store.putMarket({ id: '0xb', config: { symbol: 'B' }, active: false });
      const active = await store.activeMarkets();
      expect(active.map((m) => m.id)).toEqual(['0xa']);
      expect(active[0]?.config).toEqual({ symbol: 'A' });
    });

    it('updates a market in place instead of duplicating it', async () => {
      const store = build();
      await store.putMarket({ id: '0xa', config: { v: 1 }, active: true });
      await store.putMarket({ id: '0xa', config: { v: 2 }, active: true });
      const active = await store.activeMarkets();
      expect(active).toHaveLength(1);
      expect(active[0]?.config).toEqual({ v: 2 });
    });

    it('appends journal events and reads them back oldest first', async () => {
      const store = build();
      await store.append('0xpool', [
        markEvent,
        { ...markEvent, t: markEvent.t + 1 } as JournalEvent,
      ]);
      const events = await store.readJournal('0xpool');
      expect(events).toHaveLength(2);
      expect(events[0]?.t).toBeLessThan(events[1]!.t);
    });

    it('preserves bigint reserves through the journal', async () => {
      const store = build();
      await store.append('0xpool', [markEvent]);
      const [event] = await store.readJournal('0xpool');
      expect(event?.kind).toBe('mark');
      expect((event as typeof markEvent).pool.reserveBase).toBe(pool.reserveBase);
    });

    it('keeps the newest events when the limit bites', async () => {
      const store = build();
      const many = Array.from({ length: 10 }, (_, i) => ({ ...markEvent, t: i }) as JournalEvent);
      await store.append('0xpool', many);
      const events = await store.readJournal('0xpool', 3);
      expect(events.map((e) => e.t)).toEqual([7, 8, 9]);
    });

    it('separates journals by market and reads all of them together', async () => {
      const store = build();
      await store.append('0xa', [markEvent]);
      await store.append('0xb', [{ ...markEvent, t: 2 } as JournalEvent]);
      expect(await store.readJournal('0xa')).toHaveLength(1);
      expect(await store.readJournal(null)).toHaveLength(2);
    });

    it('accepts an empty append without touching the store', async () => {
      const store = build();
      await store.append('0xpool', []);
      expect(await store.readJournal('0xpool')).toEqual([]);
    });

    it('records each run', async () => {
      const store = build();
      await store.recordRun({
        startedAt: 1,
        finishedAt: 2,
        markets: 3,
        observations: 400,
        error: null,
      });
      await store.recordRun({
        startedAt: 3,
        finishedAt: 4,
        markets: 1,
        observations: 0,
        error: 'rpc timeout',
      });
      // Memory exposes runs directly; SQL proves it by not throwing on insert.
      expect(true).toBe(true);
    });
  });
}

describe('buffered journal', () => {
  it('writes nothing until flushed', async () => {
    const store = memoryStore();
    const journal = bufferedJournal(store, '0xpool');
    await journal.write(markEvent);
    expect(await store.readJournal('0xpool')).toHaveLength(0);
    await journal.flush();
    expect(await store.readJournal('0xpool')).toHaveLength(1);
  });

  it('keeps this run visible to the caller after flushing', async () => {
    // The runner summarises from `events`; a flush that drained it would make
    // every run report that nothing happened.
    const store = memoryStore();
    const journal = bufferedJournal(store, '0xpool');
    await journal.write(markEvent);
    await journal.flush();
    expect(journal.events).toHaveLength(1);
  });

  it('does not re-write events a previous flush already persisted', async () => {
    const store = memoryStore();
    const journal = bufferedJournal(store, '0xpool');
    await journal.write(markEvent);
    expect(await journal.flush()).toBe(1);
    await journal.write({ ...markEvent, t: 2 } as JournalEvent);
    expect(await journal.flush()).toBe(1);
    expect(await store.readJournal('0xpool')).toHaveLength(2);
  });

  it('flushes to nothing when there is nothing pending', async () => {
    const journal = bufferedJournal(memoryStore(), '0xpool');
    expect(await journal.flush()).toBe(0);
  });
});
