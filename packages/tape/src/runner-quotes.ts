import { barSession, type BarPaperConfig, type BarPaperState } from './barpaper.ts';
import { openBankroll } from './bankroll.ts';
import { bufferedJournal } from './store/memory.ts';
import { summarize } from './journal.ts';
import type { PairQuote, QuoteSource } from './quotes/types.ts';
import type { TapeStore } from './store/types.ts';

/** A watched market whose prices come from an aggregator rather than a chain. */
export interface QuoteMarketConfig extends BarPaperConfig {
  kind: 'quotes';
  /** Candle width requested from the source. */
  barMinutes: number;
}

export function isQuoteMarket(config: unknown): config is QuoteMarketConfig {
  return typeof config === 'object' && config !== null && (config as { kind?: string }).kind === 'quotes';
}

export interface QuoteRunResult {
  marketId: string;
  bars: number;
  intents: number;
  fills: number;
  fromT: number;
  toT: number;
  error: string | null;
}

export interface QuoteRunSummary {
  startedAt: number;
  finishedAt: number;
  markets: QuoteRunResult[];
  bars: number;
  errors: number;
}

const PROGRAM = 'paper';

/**
 * One firing over every aggregator-priced market.
 *
 * Same discipline as the chain runner and for the same reasons: state is
 * loaded and written back on every pass so nothing lives in memory between
 * firings, markets are isolated so one source failing costs only that market,
 * and the cursor advances last — after the journal is flushed and the position
 * saved — so a firing that dies re-reads bars it already saw rather than
 * skipping bars it never wrote. Duplicate bars are idempotent; missing ones
 * are gone.
 *
 * The cursor here is a bar timestamp rather than a block. Bars are the unit of
 * time for a source that does not expose a chain.
 */
export async function runQuotes(deps: {
  store: TapeStore;
  source: QuoteSource;
  now?: () => number;
  maxBarsPerMarket?: number;
  /** Re-read depth and price before running, so the fill model is not stale. */
  refreshPair?: boolean;
}): Promise<QuoteRunSummary> {
  const now = deps.now ?? Date.now;
  const startedAt = now();
  const markets = (await deps.store.activeMarkets()).filter((market) =>
    isQuoteMarket(market.config),
  );
  const results: QuoteRunResult[] = [];

  for (const stored of markets) {
    const config = stored.config as QuoteMarketConfig;
    const cursor = (await deps.store.getCursor(stored.id)) ?? 0n;
    const result: QuoteRunResult = {
      marketId: stored.id,
      bars: 0,
      intents: 0,
      fills: 0,
      fromT: Number(cursor),
      toT: Number(cursor),
      error: null,
    };

    try {
      let pair: PairQuote = config.pair;
      if (deps.refreshPair !== false && pair.baseAddress) {
        // Depth moves, and a stale liquidity figure silently misprices every
        // fill after it. A refresh that fails leaves the old figure in place.
        const fresh = await deps.source
          .pairsFor(pair.baseAddress)
          .then((found) => found.find((candidate) => candidate.pairId === pair.pairId))
          .catch(() => undefined);
        if (fresh) pair = fresh;
      }

      const bars = await deps.source.bars(pair, { minutes: config.barMinutes });
      const fresh = bars
        .filter((bar) => BigInt(bar.t) > cursor)
        .slice(0, deps.maxBarsPerMarket ?? 500);

      if (fresh.length === 0) {
        results.push(result);
        continue;
      }

      const journal = bufferedJournal(deps.store, stored.id);
      const saved = await deps.store.getPosition(stored.id);
      const restore: BarPaperState = {
        bankroll: (await deps.store.getBankroll(PROGRAM)) ?? openBankroll(),
        position: saved?.position ?? null,
        costUsd: saved?.costUsd ?? 0,
        proceedsUsd: saved?.proceedsUsd ?? 0,
      };

      const session = barSession({ ...config, pair }, journal, restore);
      result.bars = await session.advance(fresh);

      const counted = summarize(journal.events);
      result.intents = counted.intents;
      result.fills = counted.fills;
      result.toT = fresh.at(-1)!.t;

      await journal.flush();
      const state = session.state();
      await deps.store.setPosition(stored.id, {
        position: state.position,
        costUsd: state.costUsd,
        proceedsUsd: state.proceedsUsd,
      });
      await deps.store.setBankroll(PROGRAM, state.bankroll);
      if (pair !== config.pair) {
        await deps.store.putMarket({ ...stored, config: { ...config, pair } });
      }
      await deps.store.setCursor(stored.id, BigInt(result.toT));
    } catch (error) {
      result.error = error instanceof Error ? error.message : String(error);
    }

    results.push(result);
  }

  const finishedAt = now();
  const bars = results.reduce((sum, r) => sum + r.bars, 0);
  const errors = results.filter((r) => r.error !== null).length;

  await deps.store.recordRun({
    startedAt,
    finishedAt,
    markets: results.length,
    observations: bars,
    error: errors === 0 ? null : `${errors} of ${results.length} markets failed`,
  });

  return { startedAt, finishedAt, markets: results, bars, errors };
}

/**
 * Open a paper ticket on an aggregator-priced market, by hand.
 *
 * Separate from the firing loop for the same reason as its chain counterpart:
 * `runQuotes` never opens a position. Which tickers enter the universe is the
 * judgement this system leaves to a person.
 */
export async function enterQuoteMarket(
  deps: { store: TapeStore; source: QuoteSource; now?: () => number },
  marketId: string,
  facts: Parameters<ReturnType<typeof barSession>['enter']>[1],
  policy?: Parameters<ReturnType<typeof barSession>['enter']>[2],
): Promise<{ ok: boolean; detail: string; verdict?: unknown }> {
  const now = deps.now ?? Date.now;
  const stored = (await deps.store.activeMarkets()).find((market) => market.id === marketId);
  if (!stored || !isQuoteMarket(stored.config)) {
    return { ok: false, detail: 'market is not on the watchlist' };
  }

  const config = stored.config;
  // Price and depth at the moment of entry, not whenever this was last watched.
  let pair = config.pair;
  if (pair.baseAddress) {
    const fresh = await deps.source
      .pairsFor(pair.baseAddress)
      .then((found) => found.find((candidate) => candidate.pairId === pair.pairId))
      .catch(() => undefined);
    if (fresh) pair = fresh;
  }

  const journal = bufferedJournal(deps.store, marketId);
  const saved = await deps.store.getPosition(marketId);
  const session = barSession({ ...config, pair }, journal, {
    bankroll: (await deps.store.getBankroll(PROGRAM)) ?? openBankroll(),
    position: saved?.position ?? null,
    costUsd: saved?.costUsd ?? 0,
    proceedsUsd: saved?.proceedsUsd ?? 0,
  });

  const outcome = await session.enter(now(), facts, policy);
  await journal.flush();
  if (!outcome.opened) return { ok: false, detail: outcome.why, verdict: outcome.verdict };

  const state = session.state();
  await deps.store.setPosition(marketId, {
    position: state.position,
    costUsd: state.costUsd,
    proceedsUsd: state.proceedsUsd,
  });
  await deps.store.setBankroll(PROGRAM, state.bankroll);
  return { ok: true, detail: `opened $${outcome.sizeUsd} on ${pair.baseSymbol ?? marketId}` };
}
