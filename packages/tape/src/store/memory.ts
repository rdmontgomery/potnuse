import type { BankrollState } from '../bankroll.ts';
import { decodeJson, encodeJson, type JournalEvent } from '../journal.ts';
import type { RunRecord, StoredMarket, StoredPosition, TapeStore } from './types.ts';

/**
 * In-memory store, for tests and dry runs.
 *
 * Values round-trip through the same codec the durable stores use, so a
 * serialisation bug surfaces here rather than on the first cron firing that
 * tries to resume a real position.
 */
export function memoryStore(): TapeStore & { runs: RunRecord[] } {
  const markets = new Map<string, StoredMarket>();
  const cursors = new Map<string, bigint>();
  const bankrolls = new Map<string, string>();
  const positions = new Map<string, string>();
  const journal: { marketId: string | null; event: string }[] = [];
  const runs: RunRecord[] = [];

  return {
    runs,
    async activeMarkets() {
      return [...markets.values()].filter((market) => market.active);
    },
    async putMarket(market) {
      markets.set(market.id, market);
    },
    async getCursor(marketId) {
      return cursors.get(marketId) ?? null;
    },
    async setCursor(marketId, block) {
      cursors.set(marketId, block);
    },
    async getBankroll(programId) {
      const raw = bankrolls.get(programId);
      return raw === undefined ? null : decodeJson<BankrollState>(raw);
    },
    async setBankroll(programId, state) {
      bankrolls.set(programId, encodeJson(state));
    },
    async getPosition(marketId) {
      const raw = positions.get(marketId);
      return raw === undefined ? null : decodeJson<StoredPosition>(raw);
    },
    async setPosition(marketId, state) {
      positions.set(marketId, encodeJson(state));
    },
    async append(marketId, events) {
      for (const event of events) journal.push({ marketId, event: encodeJson(event) });
    },
    async readJournal(marketId, limit = 500) {
      return journal
        .filter((row) => marketId === null || row.marketId === marketId)
        .slice(-limit)
        .map((row) => decodeJson<JournalEvent>(row.event));
    },
    async recordRun(run) {
      runs.push(run);
    },
  };
}

/**
 * A journal that writes through to a store instead of to disk.
 *
 * Buffers within a firing and flushes once, because a cron Worker pays for
 * wall-clock time and a round trip per mark would dominate a run that scans
 * thousands of them.
 */
export function bufferedJournal(
  store: TapeStore,
  marketId: string | null,
): { write(event: JournalEvent): Promise<void>; events: JournalEvent[]; flush(): Promise<number> } {
  const events: JournalEvent[] = [];
  // Watermark rather than draining the array: the caller reads `events` for
  // this run's summary, and a flush that emptied it would leave every run
  // reporting nothing happened.
  let flushed = 0;
  return {
    events,
    async write(event) {
      events.push(event);
    },
    async flush() {
      const pending = events.slice(flushed);
      if (pending.length === 0) return 0;
      await store.append(marketId, pending);
      flushed = events.length;
      return pending.length;
    },
  };
}
