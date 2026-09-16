import type { BankrollState } from '../bankroll.ts';
import { decodeJson, encodeJson, type JournalEvent } from '../journal.ts';
import type { HttpCache } from '../quotes/cache.ts';
import type {
  RunRecord,
  SqlDatabase,
  StoredMarket,
  StoredPosition,
  TapeStore,
} from './types.ts';

/**
 * A store over any SQLite speaking the D1 statement shape.
 *
 * Every write is a single statement. There is no transaction anywhere, which
 * is a decision rather than an omission: a cron firing that dies halfway
 * leaves a cursor behind its journal, and the next firing re-scans that range
 * and re-appends. Duplicate marks in the tape are harmless — they are the same
 * observations — whereas a cursor that advanced past unwritten events would
 * lose them for good. Given the choice, the store is built to repeat itself
 * rather than to skip.
 */
export function sqlStore(db: SqlDatabase): TapeStore {
  return {
    async activeMarkets() {
      const { results } = await db
        .prepare('SELECT id, config, active FROM markets WHERE active = 1 ORDER BY id')
        .all<{ id: string; config: string; active: number }>();
      return results.map<StoredMarket>((row) => ({
        id: row.id,
        config: decodeJson(row.config),
        active: row.active === 1,
      }));
    },

    async putMarket(market) {
      await db
        .prepare(
          `INSERT INTO markets (id, config, active, created_at) VALUES (?, ?, ?, ?)
           ON CONFLICT(id) DO UPDATE SET config = excluded.config, active = excluded.active`,
        )
        .bind(market.id, encodeJson(market.config), market.active ? 1 : 0, Date.now())
        .run();
    },

    async getCursor(marketId) {
      const row = await db
        .prepare('SELECT block FROM cursors WHERE market_id = ?')
        .bind(marketId)
        .first<{ block: string }>();
      return row ? BigInt(row.block) : null;
    },

    async setCursor(marketId, block) {
      await db
        .prepare(
          `INSERT INTO cursors (market_id, block) VALUES (?, ?)
           ON CONFLICT(market_id) DO UPDATE SET block = excluded.block`,
        )
        .bind(marketId, block.toString())
        .run();
    },

    async getBankroll(programId) {
      const row = await db
        .prepare('SELECT state FROM bankroll WHERE program_id = ?')
        .bind(programId)
        .first<{ state: string }>();
      return row ? decodeJson<BankrollState>(row.state) : null;
    },

    async setBankroll(programId, state) {
      await db
        .prepare(
          `INSERT INTO bankroll (program_id, state, updated_at) VALUES (?, ?, ?)
           ON CONFLICT(program_id) DO UPDATE SET state = excluded.state, updated_at = excluded.updated_at`,
        )
        .bind(programId, encodeJson(state), Date.now())
        .run();
    },

    async getPosition(marketId) {
      const row = await db
        .prepare('SELECT state FROM positions WHERE market_id = ?')
        .bind(marketId)
        .first<{ state: string }>();
      return row ? decodeJson<StoredPosition>(row.state) : null;
    },

    async setPosition(marketId, state) {
      await db
        .prepare(
          `INSERT INTO positions (market_id, state, updated_at) VALUES (?, ?, ?)
           ON CONFLICT(market_id) DO UPDATE SET state = excluded.state, updated_at = excluded.updated_at`,
        )
        .bind(marketId, encodeJson(state), Date.now())
        .run();
    },

    async append(marketId, events) {
      const insert = db.prepare(
        'INSERT INTO journal (market_id, t, kind, event) VALUES (?, ?, ?, ?)',
      );
      const statements = events.map((event) =>
        insert.bind(marketId, event.t, event.kind, encodeJson(event)),
      );
      if (statements.length === 0) return;
      // One round trip where the driver supports it; a scan can produce
      // thousands of marks and a Worker pays for every one in wall clock.
      if (db.batch) await db.batch(statements);
      else for (const statement of statements) await statement.run();
    },

    async readJournal(marketId, limit = 500) {
      const { results } =
        marketId === null
          ? await db
              .prepare('SELECT event FROM journal ORDER BY id DESC LIMIT ?')
              .bind(limit)
              .all<{ event: string }>()
          : await db
              .prepare('SELECT event FROM journal WHERE market_id = ? ORDER BY id DESC LIMIT ?')
              .bind(marketId, limit)
              .all<{ event: string }>();
      // Query descends so the LIMIT takes the newest; callers want oldest first.
      return results.reverse().map((row) => decodeJson<JournalEvent>(row.event));
    },

    async recordRun(run: RunRecord) {
      await db
        .prepare(
          'INSERT INTO runs (started_at, finished_at, markets, observations, error) VALUES (?, ?, ?, ?, ?)',
        )
        .bind(run.startedAt, run.finishedAt, run.markets, run.observations, run.error)
        .run();
    },
  };
}

/**
 * An HTTP cache over the same database as everything else.
 *
 * Shared deliberately: the cron and the diagnostics page hit the same public
 * aggregators, which rate-limit by IP, so they are spending one budget and
 * should see one cache. A probe that reports "rate limited" while the cron
 * quietly succeeds against its own cache would be lying about the same fact.
 */
export function sqlCache(db: SqlDatabase, opts: { now?: () => number } = {}): HttpCache {
  const now = opts.now ?? Date.now;
  return {
    async get(url) {
      const row = await db
        .prepare('SELECT body, status, stored_at, expires_at FROM http_cache WHERE url = ?')
        .bind(url)
        .first<{ body: string; status: number; stored_at: number; expires_at: number }>();
      return row
        ? { body: row.body, status: row.status, storedAt: row.stored_at, expiresAt: row.expires_at }
        : null;
    },

    async put(url, entry) {
      await db
        .prepare(
          `INSERT INTO http_cache (url, body, status, stored_at, expires_at) VALUES (?, ?, ?, ?, ?)
           ON CONFLICT(url) DO UPDATE SET body = excluded.body, status = excluded.status,
             stored_at = excluded.stored_at, expires_at = excluded.expires_at`,
        )
        .bind(url, entry.body, entry.status, entry.storedAt, entry.expiresAt)
        .run();
      // Indexed sweep, so the table does not grow without bound.
      await db.prepare('DELETE FROM http_cache WHERE expires_at < ?').bind(now()).run();
    },
  };
}
