import { jsonRpc, jsonRpcClient, poolFeed } from '@rdm/tape/feed';
import {
  aggregatorSource,
  assertTokenId,
  enterMarket,
  enterQuoteMarket,
  isQuoteMarket,
  makePlan,
  poolFor,
  probeToken,
  runOnce,
  runQuotes,
  screen,
  solanaRpc,
  solanaTokenFacts,
  SOLANA_RPC,
  sqlStore,
  summarize,
  type MarketConfig,
  type QuoteMarketConfig,
  type RunnerDeps,
  type SqlDatabase,
  type TapeStore,
} from '@rdm/tape';
import { dashboard, loginPage, probePage, type MarketRow, type PageData } from './page.ts';

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
      // Two config shapes share this list: aggregator-priced and chain-read.
      const quote = isQuoteMarket(market.config) ? market.config : null;
      const chain = market.config as MarketConfig;
      return {
        market,
        cursor: (await store.getCursor(market.id))?.toString() ?? null,
        position: await store.getPosition(market.id),
        symbol: quote?.pair.baseSymbol ?? chain.market?.base?.symbol ?? '???',
        quoteSymbol: quote?.pair.quoteSymbol ?? chain.market?.quote?.symbol ?? '???',
        venue: quote ? `${quote.pair.chain} · ${quote.pair.dex ?? 'dex'}` : 'onchain',
      };
    }),
  );

  const budgetUsd =
    (markets[0]?.config as { bankroll?: { programBudgetUsd?: number } } | undefined)?.bankroll
      ?.programBudgetUsd ?? 0;
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

/**
 * Turn a pasted token into a watched market.
 *
 * Prices come from aggregators rather than from a chain, which is what makes
 * one paste work for a Solana mint, an EVM pair and a singleton pool alike.
 * The identifier is whatever the source issued; nothing here needs to know
 * what venue produced it.
 */
async function addMarket(store: TapeStore, form: FormData): Promise<PageData['flash']> {
  const read = (key: string) => String(form.get(key) ?? '').trim();
  const num = (key: string, fallback: number) => {
    const value = Number(read(key));
    return Number.isFinite(value) ? value : fallback;
  };

  try {
    const token = assertTokenId(read('base'));
    const source = aggregatorSource({ timeoutMs: 8_000 });
    const pairs = await source.pairsFor(token);
    const wanted = read('pool');
    const pair = wanted ? pairs.find((p: { pairId: string }) => p.pairId === wanted) : pairs[0];

    if (!pair) {
      return {
        kind: 'bad',
        text: pairs.length
          ? `No pair matching ${wanted}. Found ${pairs.length} others.`
          : 'No price source knows this token. Open /probe to see what each one said.',
        detail: pairs.map((p) => `${p.chain.padEnd(12)}  ${p.pairId}`).join('\n') || undefined,
      };
    }

    const plan = makePlan({
      denom: 'usd',
      rungs: parseRungs(read('rungs') || '2:4000,3:3000,5:1500'),
      // Zero means run without a stop, which is the point of the paper week.
      stopMultiple: num('stop', 0) > 0 ? num('stop', 0) : 0.000001,
      trail: num('trail', 35) > 0 ? { armAtMultiple: 2, dropPct: num('trail', 35) } : undefined,
    });

    const fees = { buyBps: num('buyBps', 30), sellBps: num('sellBps', 30) };
    const budget = num('budget', 500);
    const slots = Math.max(Math.round(num('slots', 10)), 1);
    const config: QuoteMarketConfig = {
      kind: 'quotes',
      pair,
      barMinutes: Math.max(Math.round(num('barMinutes', 5)), 1),
      plan,
      bankroll: { programBudgetUsd: budget, slots },
      fees,
      latencyHaircutBps: num('haircutBps', 30),
    };

    // Authorities are the facts that decide whether a position can be diluted
    // or stranded, and no price aggregator carries them. Two RPC calls do.
    const onchain =
      pair.chain === 'solana' && pair.baseAddress
        ? await solanaTokenFacts(solanaRpc(SOLANA_RPC, { timeoutMs: 8_000 }), pair.baseAddress, {
            poolBaseUsd: (pair.liquidityUsd ?? 0) / 2,
            priceUsd: pair.priceUsd,
          }).catch(() => null)
        : null;

    const pool = poolFor(pair);
    if (!pool) {
      return {
        kind: 'bad',
        text: `${pair.baseSymbol ?? token} has no usable price or depth figure, so size cannot be checked.`,
      };
    }

    const verdict = screen(
      {
        market: { base: { chainId: 0, address: '0x', symbol: pair.baseSymbol ?? '???', decimals: 18 }, quote: { chainId: 0, address: '0x', symbol: pair.quoteSymbol ?? 'USD', decimals: 6 }, pool: pair.pairId as never, venue: pair.dex ?? 'unknown' },
        pool,
        fees,
        usdPerQuote: 1,
        quoteKind: 'stable',
        quoteVolatilityPct: null,
        sourceVerified: null,
        ownerRenounced: null,
        canMint: onchain?.canMint ?? null,
        canFreeze: onchain?.canFreeze ?? null,
        topHolderPct: onchain?.topHolderPct ?? null,
        holders: null,
        lpLockedPct: null,
        ageMs: null,
      },
      { intendedSizeUsd: budget / slots },
    );

    const detail = [
      `${pair.chain} · ${pair.dex ?? 'unknown dex'} · ${pair.pairId}`,
      `price   $${pair.priceUsd}`,
      `depth   $${Math.round(pair.liquidityUsd ?? 0).toLocaleString()}`,
      `24h vol $${Math.round(pair.volume24hUsd ?? 0).toLocaleString()}`,
      ...(onchain ? ['', ...onchain.notes.map((note) => `chain   ${note}`)] : []),
      '',
      ...verdict.findings.map((f) => `${f.severity.padEnd(5)} ${f.code}: ${f.message}`),
    ].join('\n');

    if (verdict.outcome === 'block') {
      return {
        kind: 'bad',
        text: `${pair.baseSymbol ?? token} was blocked and has not been added.`,
        detail,
      };
    }

    await store.putMarket({ id: pair.pairId, config, active: true });
    return {
      kind: verdict.outcome === 'warn' ? 'warn' : 'ok',
      text: `Watching ${pair.baseSymbol ?? token}/${pair.quoteSymbol ?? '?'} on ${pair.chain}. Open a ticket when you want one.`,
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
    const store = sqlStore(env.TAPE_DB);
    const quotes = await runQuotes({ store, source: aggregatorSource({ timeoutMs: 8_000 }) });
    const summary = await runOnce(deps(store));
    console.log(
      JSON.stringify({
        at: summary.finishedAt,
        ms: summary.finishedAt - summary.startedAt,
        markets: summary.markets.length,
        observations: summary.observations,
        errors: summary.errors + quotes.errors,
        quoteBars: quotes.bars,
        quoteMarkets: quotes.markets,
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
        const market = (await store.activeMarkets()).find((m) => m.id === id);
        const unknownFacts = {
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
        } as const;
        const result = isQuoteMarket(market?.config)
          ? await enterQuoteMarket(
              { store, source: aggregatorSource({ timeoutMs: 8_000 }) },
              id,
              unknownFacts,
            )
          : await enterMarket(deps(store), id, unknownFacts);
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

    if (url.pathname === '/probe') {
      const token = url.searchParams.get('token')?.trim();
      if (!token) return html(probePage(null));
      const report = await probeToken(token, { timeoutMs: 8_000 });
      return html(
        probePage({
          token,
          attempts: report.attempts.map((a) => ({
            endpoint: a.endpoint,
            url: a.url,
            status: a.status,
            bytes: a.bytes,
            sample: a.sample,
            pairCount: a.pairs.length,
            barCount: a.bars.length,
            error: a.error,
          })),
          best: report.best
            ? {
                chain: report.best.chain,
                pairId: report.best.pairId,
                dex: report.best.dex,
                baseSymbol: report.best.baseSymbol,
                quoteSymbol: report.best.quoteSymbol,
                priceUsd: report.best.priceUsd,
                liquidityUsd: report.best.liquidityUsd,
              }
            : null,
        }),
      );
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
