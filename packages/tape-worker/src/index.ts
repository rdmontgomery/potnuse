import { jsonRpcClient } from '@rdm/tape/feed';
import { runOnce, sqlStore, summarize, type MarketConfig, type SqlDatabase } from '@rdm/tape';

/**
 * The cron runner.
 *
 * Deliberately thin. Every decision worth testing lives in `@rdm/tape`, which
 * knows nothing about Cloudflare and runs under plain Node in the test suite;
 * this file only supplies the bindings and the two entry points. If logic
 * starts accumulating here it belongs in the package instead, where it can be
 * exercised without deploying anything.
 *
 * There is no signer, no key and no wallet binding — by design, and enforced
 * by the repo-level boundary in CLAUDE.md. This Worker reads chains and writes
 * rows. It cannot move money.
 */
export interface Env {
  TAPE_DB: SqlDatabase;
  /** Bearer token for the read-only status endpoint. Unset means closed. */
  TAPE_READ_TOKEN?: string;
}

interface ScheduledController {
  scheduledTime: number;
  cron: string;
}

interface Context {
  waitUntil(promise: Promise<unknown>): void;
}

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body, null, 2), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8' },
  });

export default {
  async scheduled(_controller: ScheduledController, env: Env, _ctx: Context): Promise<void> {
    const store = sqlStore(env.TAPE_DB);

    const summary = await runOnce({
      store,
      // A client per market so each can point at its own chain, and so one
      // pool's slow endpoint cannot share a connection with another's.
      rpcFor: (config: MarketConfig) => jsonRpcClient(config.rpcUrl, { timeoutMs: 8_000 }),
      // A cron firing has a wall-clock budget. Leave the rest of a long
      // backlog for the next minute rather than being killed mid-flush.
      maxPerMarket: 2_000,
    });

    // Structured, so `wrangler tail` is readable and Workers observability can
    // be queried on it later.
    console.log(
      JSON.stringify({
        at: summary.finishedAt,
        ms: summary.finishedAt - summary.startedAt,
        markets: summary.markets.length,
        observations: summary.observations,
        errors: summary.errors,
        detail: summary.markets.map((m) => ({
          market: m.marketId,
          obs: m.observations,
          fills: m.fills,
          stalls: m.stalls,
          blocks: `${m.fromBlock}..${m.toBlock}`,
          error: m.error,
        })),
      }),
    );
  },

  /**
   * Read-only status. Fails closed: with no token configured, nothing is
   * served. Put Cloudflare Access in front of it as well if you want the
   * Google sign-in rather than a bearer token.
   */
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    if (!env.TAPE_READ_TOKEN) {
      return json({ error: 'status endpoint is not configured' }, 503);
    }
    if (request.headers.get('authorization') !== `Bearer ${env.TAPE_READ_TOKEN}`) {
      return json({ error: 'unauthorized' }, 401);
    }

    const store = sqlStore(env.TAPE_DB);

    if (url.pathname === '/markets') {
      return json(await store.activeMarkets());
    }

    if (url.pathname === '/journal') {
      const market = url.searchParams.get('market');
      const limit = Math.min(Number(url.searchParams.get('limit') ?? 200) || 200, 1_000);
      const events = await store.readJournal(market, limit);
      return json({ count: events.length, summary: summarize(events), events });
    }

    if (url.pathname === '/' || url.pathname === '/status') {
      const markets = await store.activeMarkets();
      const rows = await Promise.all(
        markets.map(async (market) => ({
          market: market.id,
          cursor: (await store.getCursor(market.id))?.toString() ?? null,
          position: await store.getPosition(market.id),
        })),
      );
      return json({ bankroll: await store.getBankroll('paper'), markets: rows });
    }

    return json({ error: 'not found' }, 404);
  },
};
