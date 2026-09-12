import type { BankrollState } from '../bankroll.ts';
import type { JournalEvent } from '../journal.ts';
import type { PositionState } from '../ladder.ts';

/** A market the runner is recording, with the config it runs under. */
export interface StoredMarket {
  id: string;
  config: unknown;
  active: boolean;
}

/** Per-market position state. Reserves are excluded — those come from chain. */
export interface StoredPosition {
  position: PositionState | null;
  costUsd: number;
  proceedsUsd: number;
}

export interface RunRecord {
  startedAt: number;
  finishedAt: number;
  markets: number;
  observations: number;
  error: string | null;
}

/**
 * Everything the runner must remember between firings.
 *
 * A cron Worker keeps nothing in memory across invocations, so this interface
 * is the entire continuity of the system. It is deliberately small and
 * deliberately not clever: no transactions, no cross-market invariants beyond
 * the shared bankroll, because a store that needs careful sequencing is a
 * store that breaks the first time a run is retried.
 *
 * Bankroll is program-wide rather than per-market. Ticket sizing, the budget
 * ceiling and the post-loss cooldown all span markets — a cooldown that only
 * applied to the token that just lost would be no cooldown at all.
 */
export interface TapeStore {
  activeMarkets(): Promise<StoredMarket[]>;
  putMarket(market: StoredMarket): Promise<void>;

  getCursor(marketId: string): Promise<bigint | null>;
  setCursor(marketId: string, block: bigint): Promise<void>;

  getBankroll(programId: string): Promise<BankrollState | null>;
  setBankroll(programId: string, state: BankrollState): Promise<void>;

  getPosition(marketId: string): Promise<StoredPosition | null>;
  setPosition(marketId: string, state: StoredPosition): Promise<void>;

  append(marketId: string | null, events: readonly JournalEvent[]): Promise<void>;
  readJournal(marketId: string | null, limit?: number): Promise<JournalEvent[]>;

  recordRun(run: RunRecord): Promise<void>;
}

/**
 * The slice of Cloudflare's D1 this package uses.
 *
 * Declared structurally rather than imported from the Workers types, so the
 * package keeps `fetch` as its only dependency and the adapter can be tested
 * against any SQLite that speaks this shape.
 */
export interface SqlDatabase {
  prepare(query: string): SqlStatement;
  batch?(statements: SqlStatement[]): Promise<unknown>;
  exec?(query: string): Promise<unknown>;
}

export interface SqlStatement {
  bind(...values: unknown[]): SqlStatement;
  first<T = Record<string, unknown>>(): Promise<T | null>;
  run(): Promise<unknown>;
  all<T = Record<string, unknown>>(): Promise<{ results: T[] }>;
}
