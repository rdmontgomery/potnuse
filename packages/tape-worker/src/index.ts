import { jsonRpc, jsonRpcClient, poolFeed } from '@rdm/tape/feed';
import {
  discoverMarket,
  enterMarket,
  makePlan,
  runOnce,
  screen,
  sqlStore,
  summarize,
  usdReference,
  type Address,
  type MarketConfig,
  type RunnerDeps,
  type SqlDatabase,
  type TapeStore,
} from '@rdm/tape';
import { dashboard, loginPage, type MarketRow, type PageData } from './page.ts';

/**
 * The runner: a cron that builds tapes, and a page to drive it from.
 *
 * Thin on purpose. Every decision worth testing lives in `@rdm/tape`, which
 * knows nothing about Cloudflare and runs under plain Node in the suite. This
 * file supplies bindings, routes and HTML.
 *
 * No signer, no key, no wallet binding — enforced by the repo boundary in
 * CLAUDE.md. It reads chains and writes rows. It cannot move money.
 */
export interface Env {
  TAPE_DB: SqlDatabase;
  /** Gate for every route. Unset means the whole Worker is closed. */
  TAPE_READ_TOKEN?: string;
}

interface ScheduledController {
  scheduledTime: number;
  cron: string;
}

const PROGRAM = 'paper';
const COOKIE = 'tape_session';

const html = (body: string, status = 200) =>
  new Response(body, { status, headers: { 'content-type': 'text/html; charset=utf-8' } });

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body, null, 2), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8' },
  });

/** Length-independent compare, so a wrong token leaks nothing through timing. */
function sameSecret(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i += 1) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

function cookieToken(request: Request): string | null {
  const header = request.headers.get('cookie');
  if (!header) return null;
  for (const part of header.split(';')) {
    const [name, ...rest] = part.trim().split('=');
    if (name === COOKIE) return decodeURIComponent(rest.join('='));
  }
  return null;
}

function authorized(request: Request, secret: string): boolean {
  const bearer = request.headers.get('authorization');
  if (bearer && sameSecret(bearer, `Bearer ${secret}`)) return true;
  const cookie = cookieToken(request);
  return cookie !== null && sameSecret(cookie, secret);
}

function deps(store: TapeStore): RunnerDeps {
  return {
    store,
    rpcFor: (config: MarketConfig) => jsonRpcClient(config.rpcUrl, { timeoutMs: 8_000 }),
    maxPerMarket: 2_000,
  };
}

/** "2:4000,3:3000,5:1500" — multiple:basis-points, comma separated. */
function parseRungs(input: string) {
  return input
    .split(',')
    .map((part) => part.trim())
    .filter((part) => part.length > 0)
    .map((part) => {
      const [multiple, bps] = part.split(':');
      const atMultiple = Number(multiple);
      const sellBps = Number(bps);
      if (!Number.isFinite(atMultiple) || !Number.isFinite(sellBps)) {
        throw new Error(`cannot read rung "${part}" — expected multiple:bps, e.g. 2:4000`);
      }
      return { atMultiple, sellBps };
    });
}

async function pageData(store: TapeStore, journalFor?: string | null): Promise<PageData> {
  const markets = await store.activeMarkets();
  const rows: MarketRow[] = await Promise.all(
    markets.map(async (market) => {
      const config = market.config as MarketConfig;
      return {
        market,
        cursor: (await store.getCursor(market.id))?.toString() ?? null,
        position: await store.getPosition(market.id),
        symbol: config.market?.base?.symbol ?? '???',
        quoteSymbol: config.market?.quote?.symbol ?? '???',
      };
    }),
  );

  const budgetUsd = (markets[0]?.config as MarketConfig | undefined)?.bankroll?.programBudgetUsd ?? 0;
  const data: PageData = { bankroll: await store.getBankroll(PROGRAM), budgetUsd, rows };

  if (journalFor) {
    const events = await store.readJournal(journalFor, 120);
    data.journal = {
      market: journalFor,
      lines: events.map((event) => {
        const when = new Date(event.t).toISOString().slice(11, 19);
        const detail =
          event.kind === 'mark'
            ? `${event.mark.quotePerBase.toPrecision(6)} quote/base`
            : event.kind === 'fill'
              ? `${event.fill.side} @ ${event.fill.effectivePrice.toPrecision(6)} (${event.fill.slippageBps}bps)`
              : event.kind === 'intent'
                ? `${event.intent.reason.kind}`
                : event.kind === 'stall'
                  ? event.reason
                  : '';
        return `${when}  ${event.kind.padEnd(9)} ${detail}`;
      }),
    };
  }
  return data;
}

/** Build and screen a market from pasted addresses; store it only if it passes. */
async function addMarket(store: TapeStore, form: FormData): Promise<PageData['flash']> {
  const read = (key: string) => String(form.get(key) ?? '').trim();
  const rpcUrl = read('rpcUrl');

  try {
    const market = await discoverMarket(jsonRpc(rpcUrl, { timeoutMs: 8_000 }), {
      chainId: Number(read('chainId')),
      base: read('base').toLowerCase() as Address,
      quote: read('quote').toLowerCase() as Address,
      pool: read('pool') ? (read('pool').toLowerCase() as Address) : undefined,
      factory: read('factory') ? (read('factory').toLowerCase() as Address) : undefined,
    });

    const stop = Number(read('stop'));
    const trail = Number(read('trail'));
    const plan = makePlan({
      denom: read('denom') === 'quote' ? 'quote' : 'usd',
      rungs: parseRungs(read('rungs')),
      // A stop of zero means run without one — the paper week's whole point is
      // finding out whether it pays for itself.
      stopMultiple: stop > 0 ? stop : 0.000001,
      trail: trail > 0 ? { armAtMultiple: 2, dropPct: trail } : undefined,
    });

    const fees = { buyBps: Number(read('buyBps')), sellBps: Number(read('sellBps')) };
    const budget = Number(read('budget'));
    const slots = Number(read('slots'));
    const usdRefKind = read('usdRef') === 'none' ? 'none' : 'pegged';

    const config: MarketConfig = {
      rpcUrl,
      market,
      usdRef: usdRefKind === 'none' ? { kind: 'none' } : { kind: 'pegged' },
      fees,
      plan,
      bankroll: { programBudgetUsd: budget, slots },
      feed: { kind: 'sync', startBlock: Number(read('startBlock')), confirmations: 5, maxRange: 2_000 },
    };

    // Screen before storing, so a pool that cannot be exited never joins the
    // watchlist in the first place.
    const rpc = jsonRpcClient(rpcUrl, { timeoutMs: 8_000 });
    const observation = await poolFeed(rpc.call, market, usdReference(config.usdRef)).poll(
      Date.now(),
    );

    if (!observation) {
      return { kind: 'bad', text: `${market.base.symbol}: the pool reports no reserves.` };
    }

    const verdict = screen(
      {
        market,
        pool: observation.pool,
        fees,
        usdPerQuote: observation.mark.usdPerQuote,
        quoteKind: usdRefKind === 'none' ? 'unreferenced' : 'stable',
        quoteVolatilityPct: null,
        sourceVerified: null,
        ownerRenounced: null,
        canMint: null,
        topHolderPct: null,
        holders: null,
        lpLockedPct: null,
        ageMs: null,
      },
      { intendedSizeUsd: budget / slots },
    );

    const detail = verdict.findings.map((f) => `${f.severity.padEnd(5)} ${f.code}: ${f.message}`).join('\n');

    if (verdict.outcome === 'block') {
      return {
        kind: 'bad',
        text: `${market.base.symbol}/${market.quote.symbol} was blocked and has not been added.`,
        detail,
      };
    }

    await store.putMarket({ id: market.pool.toLowerCase(), config, active: true });
    return {
      kind: verdict.outcome === 'warn' ? 'warn' : 'ok',
      text: `Watching ${market.base.symbol}/${market.quote.symbol} at ${market.pool}.`,
      detail,
    };
  } catch (error) {
    return { kind: 'bad', text: error instanceof Error ? error.message : String(error) };
  }
}

export { parseRungs, sameSecret };

export default {
  async scheduled(_controller: ScheduledController, env: Env): Promise<void> {
    if (!env.TAPE_DB) return;
    const summary = await runOnce(deps(sqlStore(env.TAPE_DB)));
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

  async fetch(request: Request, env: Env): Promise<Response> {
    const secret = env.TAPE_READ_TOKEN;
    const url = new URL(request.url);

    // Fails closed: with no token configured the Worker serves nothing.
    if (!secret) {
      return html(
        loginPage({
          kind: 'unconfigured',
          text:
            'No access token is set on this Worker yet. Add TAPE_READ_TOKEN as a RUNTIME secret ' +
            '(the Worker\u2019s own Settings \u2192 Variables and Secrets), not a build variable \u2014 ' +
            'build variables reach the build process and never reach the running Worker. Then reload.',
        }),
        503,
      );
    }

    if (request.method === 'POST' && url.pathname === '/login') {
      const form = await request.formData();
      if (!sameSecret(String(form.get('token') ?? ''), secret)) {
        return html(loginPage({ kind: 'rejected', text: 'That token is not right.' }), 401);
      }
      return new Response(null, {
        status: 303,
        headers: {
          location: '/',
          'set-cookie': `${COOKIE}=${encodeURIComponent(secret)}; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=604800`,
        },
      });
    }

    if (!authorized(request, secret)) {
      return url.pathname.startsWith('/api/')
        ? json({ error: 'unauthorized' }, 401)
        : html(loginPage(), 401);
    }

    const store = sqlStore(env.TAPE_DB);

    if (request.method === 'POST') {
      let flash: PageData['flash'];

      if (url.pathname === '/market') {
        flash = await addMarket(store, await request.formData());
      } else if (url.pathname === '/market/deactivate') {
        const id = String((await request.formData()).get('id') ?? '');
        const existing = (await store.activeMarkets()).find((market) => market.id === id);
        if (existing) await store.putMarket({ ...existing, active: false });
        flash = { kind: 'ok', text: `Stopped watching ${id}.` };
      } else if (url.pathname === '/market/enter') {
        const id = String((await request.formData()).get('id') ?? '');
        const result = await enterMarket(deps(store), id, {
          usdPerQuote: null,
          quoteKind: 'stable',
          quoteVolatilityPct: null,
          sourceVerified: null,
          ownerRenounced: null,
          canMint: null,
          topHolderPct: null,
          holders: null,
          lpLockedPct: null,
          ageMs: null,
        });
        flash = result.ok
          ? { kind: 'ok', text: result.detail }
          : { kind: 'bad', text: `Refused: ${result.detail}` };
      } else {
        return html(loginPage({ kind: 'rejected', text: 'No such page.' }), 404);
      }

      const data = await pageData(store);
      data.flash = flash;
      return html(dashboard(data));
    }

    if (url.pathname === '/api/status') {
      const data = await pageData(store);
      return json({ bankroll: data.bankroll, markets: data.rows });
    }

    if (url.pathname === '/api/journal') {
      const market = url.searchParams.get('market');
      const limit = Math.min(Number(url.searchParams.get('limit') ?? 200) || 200, 1_000);
      const events = await store.readJournal(market, limit);
      return json({ count: events.length, summary: summarize(events), events });
    }

    if (url.pathname === '/') {
      return html(dashboard(await pageData(store, url.searchParams.get('journal'))));
    }

    return html(loginPage({ kind: 'rejected', text: 'No such page.' }), 404);
  },
};
