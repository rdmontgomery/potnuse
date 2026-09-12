import { makeBankroll, openBankroll } from './bankroll.ts';
import { usdReference, type TapeConfig } from './config.ts';
import { poolFeed, resolveTokenOrder } from './feed/pool.ts';
import { syncFeed } from './feed/sync.ts';
import type { RpcClient } from './feed/types.ts';
import { summarize } from './journal.ts';
import { paperSession, type PaperState } from './paper.ts';
import { bufferedJournal } from './store/memory.ts';
import type { TapeStore } from './store/types.ts';
import type { UsdReference } from './price.ts';

export interface MarketConfig extends TapeConfig {
  /**
   * Which side of the pair the base token sits on. Persisted with the market
   * so the hot path costs no RPC call; it cannot change for a given pool.
   */
  baseIsToken0?: boolean;
}

export interface RunnerDeps {
  store: TapeStore;
  /** Built per market so each can point at its own chain. */
  rpcFor(config: MarketConfig): RpcClient;
  usdRefFor?(config: MarketConfig): UsdReference;
  now?(): number;
  /** Ceiling on observations consumed per market per firing. */
  maxPerMarket?: number;
}

export interface MarketResult {
  marketId: string;
  observations: number;
  intents: number;
  fills: number;
  stalls: number;
  fromBlock: string;
  toBlock: string;
  error: string | null;
}

export interface RunSummary {
  startedAt: number;
  finishedAt: number;
  markets: MarketResult[];
  observations: number;
  errors: number;
}

const PROGRAM = 'paper';

/**
 * One firing of the runner.
 *
 * Stateless by construction: everything it needs it loads from the store and
 * everything it learns it writes back. Two properties are load-bearing.
 *
 * Markets are isolated. One pool's RPC timing out must not cost every other
 * pool its minute, so each is wrapped and its failure recorded rather than
 * thrown.
 *
 * The cursor advances last, after the journal is flushed and the position is
 * saved. A firing that dies midway therefore re-scans a range it partly
 * processed, which duplicates marks in the tape — harmless, they are the same
 * observations — instead of advancing past events that were never written,
 * which loses them permanently. Given the choice, repeat rather than skip.
 */
export async function runOnce(deps: RunnerDeps): Promise<RunSummary> {
  const now = deps.now ?? Date.now;
  const startedAt = now();
  const markets = await deps.store.activeMarkets();
  const results: MarketResult[] = [];

  for (const stored of markets) {
    const config = stored.config as MarketConfig;
    const rpc = deps.rpcFor(config);
    const cursorBefore = (await deps.store.getCursor(stored.id)) ?? BigInt(
      config.feed?.kind === 'sync' ? config.feed.startBlock : 0,
    );

    const result: MarketResult = {
      marketId: stored.id,
      observations: 0,
      intents: 0,
      fills: 0,
      stalls: 0,
      fromBlock: cursorBefore.toString(),
      toBlock: cursorBefore.toString(),
      error: null,
    };

    try {
      const baseIsToken0 =
        config.baseIsToken0 ?? (await resolveTokenOrder(rpc.call, config.market));

      const usdRef = deps.usdRefFor ? deps.usdRefFor(config) : usdReference(config.usdRef);
      const scanOpts =
        config.feed?.kind === 'sync'
          ? {
              confirmations:
                config.feed.confirmations === undefined
                  ? undefined
                  : BigInt(config.feed.confirmations),
              maxRange: config.feed.maxRange === undefined ? undefined : BigInt(config.feed.maxRange),
              maxObservations: config.feed.maxObservations,
            }
          : {};

      const feed = syncFeed(rpc, config.market, usdRef, baseIsToken0, cursorBefore, scanOpts);
      const journal = bufferedJournal(deps.store, stored.id);

      const bankroll = (await deps.store.getBankroll(PROGRAM)) ?? openBankroll();
      const saved = await deps.store.getPosition(stored.id);
      const restore: PaperState = {
        bankroll,
        position: saved?.position ?? null,
        costUsd: saved?.costUsd ?? 0,
        proceedsUsd: saved?.proceedsUsd ?? 0,
      };

      const session = paperSession(
        {
          market: config.market,
          plan: config.plan,
          bankroll: makeBankroll(config.bankroll),
          fees: config.fees,
          latencyHaircutBps: config.latencyHaircutBps,
        },
        feed,
        journal,
        restore,
      );

      const ceiling = deps.maxPerMarket ?? 5_000;
      let consumed = 0;
      while (consumed < ceiling && (await session.tick(now()))) consumed += 1;

      const summary = summarize(journal.events);
      result.observations = consumed;
      result.intents = summary.intents;
      result.fills = summary.fills;
      result.stalls = summary.stalls;
      result.toBlock = feed.cursor().toString();

      // Order matters: journal, then state, then cursor. See the note above.
      await journal.flush();
      const state = session.state();
      await deps.store.setPosition(stored.id, {
        position: state.position,
        costUsd: state.costUsd,
        proceedsUsd: state.proceedsUsd,
      });
      await deps.store.setBankroll(PROGRAM, state.bankroll);
      await deps.store.setCursor(stored.id, feed.cursor());
    } catch (error) {
      result.error = error instanceof Error ? error.message : String(error);
    }

    results.push(result);
  }

  const finishedAt = now();
  const observations = results.reduce((sum, r) => sum + r.observations, 0);
  const errors = results.filter((r) => r.error !== null).length;

  await deps.store.recordRun({
    startedAt,
    finishedAt,
    markets: results.length,
    observations,
    error: errors === 0 ? null : `${errors} of ${results.length} markets failed`,
  });

  return { startedAt, finishedAt, markets: results, observations, errors };
}

/**
 * Open a paper position by hand.
 *
 * Separate from the scan loop, and deliberately so: deciding which tickers
 * enter the universe is the one judgement this system leaves to a person.
 * Nothing in `runOnce` ever opens a position.
 *
 * Entry prices against a fresh pool read rather than the log tape. The tape is
 * history — correct for driving a ladder, wrong for deciding what you can buy
 * right now.
 */
export async function enterMarket(
  deps: RunnerDeps,
  marketId: string,
  facts: Parameters<ReturnType<typeof paperSession>['enter']>[1],
  policy?: Parameters<ReturnType<typeof paperSession>['enter']>[2],
): Promise<{ ok: boolean; detail: string; verdict?: unknown }> {
  const now = deps.now ?? Date.now;
  const markets = await deps.store.activeMarkets();
  const stored = markets.find((market) => market.id === marketId);
  if (!stored) return { ok: false, detail: 'market is not on the watchlist' };

  const config = stored.config as MarketConfig;
  const rpc = deps.rpcFor(config);
  const usdRef = deps.usdRefFor ? deps.usdRefFor(config) : usdReference(config.usdRef);
  const journal = bufferedJournal(deps.store, marketId);

  const bankroll = (await deps.store.getBankroll(PROGRAM)) ?? openBankroll();
  const saved = await deps.store.getPosition(marketId);

  const session = paperSession(
    {
      market: config.market,
      plan: config.plan,
      bankroll: makeBankroll(config.bankroll),
      fees: config.fees,
      latencyHaircutBps: config.latencyHaircutBps,
    },
    poolFeed(rpc.call, config.market, usdRef),
    journal,
    {
      bankroll,
      position: saved?.position ?? null,
      costUsd: saved?.costUsd ?? 0,
      proceedsUsd: saved?.proceedsUsd ?? 0,
    },
  );

  const outcome = await session.enter(now(), facts, policy);
  await journal.flush();

  if (!outcome.opened) {
    return { ok: false, detail: outcome.why, verdict: outcome.verdict };
  }

  const state = session.state();
  await deps.store.setPosition(marketId, {
    position: state.position,
    costUsd: state.costUsd,
    proceedsUsd: state.proceedsUsd,
  });
  await deps.store.setBankroll(PROGRAM, state.bankroll);
  return { ok: true, detail: `opened $${outcome.sizeUsd}` };
}
