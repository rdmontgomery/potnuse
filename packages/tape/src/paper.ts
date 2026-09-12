import {
  makeBankroll,
  openBankroll,
  proposeEntry,
  recordEntry,
  recordExit,
  type BankrollConfig,
  type BankrollState,
} from './bankroll.ts';
import { buy, sell, type FeeSchedule, type PoolState } from './fills.ts';
import { makePlan, openPosition, step, type LadderPlan, type PositionState } from './ladder.ts';
import { basis } from './price.ts';
import { screen, type ScreenFacts, type ScreenPolicy, type Verdict } from './screen.ts';
import { TapeError, type Fill, type Market } from './types.ts';
import type { Journal } from './journal.ts';
import type { MarkFeed } from './feed/types.ts';

export interface PaperConfig {
  market: Market;
  plan: LadderPlan;
  bankroll: BankrollConfig;
  fees: FeeSchedule;
  /** Adverse selection charged on every simulated fill. */
  latencyHaircutBps?: number;
}

export interface PaperSnapshot {
  bankroll: BankrollState;
  position: PositionState | null;
  pool: PoolState | null;
  costUsd: number;
  proceedsUsd: number;
  fills: Fill[];
}

export type EnterOutcome =
  | { opened: true; sizeUsd: number; fill: Fill }
  | { opened: false; why: string; verdict?: Verdict };

/**
 * A single-market paper session.
 *
 * Simulated, but not generous: fills pay the fee, the price impact and a
 * latency haircut, and each fill moves the reserves the next one trades
 * against. The purpose of a paper week is to find out whether the plan
 * survives realistic execution, which means the simulation has to be allowed
 * to say no.
 */
export function paperSession(config: PaperConfig, feed: MarkFeed, journal: Journal) {
  const plan = makePlan(config.plan);
  const bankrollConfig = makeBankroll(config.bankroll);
  const haircut = { latencyHaircutBps: config.latencyHaircutBps ?? 30 };

  let bankroll = openBankroll();
  let position: PositionState | null = null;
  let pool: PoolState | null = null;
  let costUsd = 0;
  let proceedsUsd = 0;
  const fills: Fill[] = [];

  const key = config.market.pool;
  const quoteUnit = 10 ** config.market.quote.decimals;

  async function observe(t: number) {
    const observation = await feed.poll(t);
    if (observation === null) return null;
    pool = observation.pool;
    await journal.write({
      kind: 'mark',
      t,
      market: key,
      mark: observation.mark,
      pool: observation.pool,
    });
    return observation;
  }

  /**
   * Screen, size and open. Entry is explicit and never automatic: deciding
   * which tickers enter the universe is the one judgement in this system that
   * stays with a person.
   */
  async function enter(
    t: number,
    facts: Omit<ScreenFacts, 'market' | 'pool' | 'fees'>,
    policy: Omit<ScreenPolicy, 'intendedSizeUsd'> = {},
  ): Promise<EnterOutcome> {
    if (position !== null) return { opened: false, why: 'already holding this market' };

    const observation = await observe(t);
    if (observation === null || pool === null) {
      return { opened: false, why: 'no mark available from the feed' };
    }

    const decision = proposeEntry(bankrollConfig, bankroll, {
      asset: config.market.base.address,
      t,
    });
    await journal.write({ kind: 'proposal', t, market: key, decision });
    if (!decision.allowed) return { opened: false, why: `${decision.reason}: ${decision.detail}` };

    const verdict = screen(
      { ...facts, market: config.market, pool, fees: config.fees },
      { ...policy, intendedSizeUsd: decision.sizeUsd },
    );
    await journal.write({ kind: 'screen', t, market: key, verdict });
    if (verdict.outcome === 'block') {
      return { opened: false, why: 'screen blocked the entry', verdict };
    }

    const usdPerQuote = observation.mark.usdPerQuote;
    if (usdPerQuote === null || usdPerQuote <= 0) {
      // Sizing in dollars requires a dollar price for the quote asset. Refuse
      // rather than quietly pretend the quote asset is worth one dollar.
      return {
        opened: false,
        why: 'no USD reference for the quote asset, so a dollar-sized ticket cannot be computed',
        verdict,
      };
    }

    const spendQuote = BigInt(Math.floor((decision.sizeUsd / usdPerQuote) * quoteUnit));
    if (spendQuote <= 0n) return { opened: false, why: 'ticket rounds to zero quote units', verdict };

    const result = buy(pool, spendQuote, config.fees, t, haircut);
    pool = result.pool;
    fills.push(result.fill);
    costUsd = decision.sizeUsd;
    bankroll = recordEntry(bankroll, decision.sizeUsd);

    const entryBasis = basis(observation.mark, plan.denom);
    if (entryBasis === null) throw new TapeError('cannot open a position with no entry basis');

    position = openPosition(plan, { basis: entryBasis, qty: result.fill.qtyBase, t });

    await journal.write({ kind: 'fill', t, market: key, fill: result.fill, position });
    await journal.write({ kind: 'bankroll', t, state: bankroll });
    return { opened: true, sizeUsd: decision.sizeUsd, fill: result.fill };
  }

  /** Advance one observation. Returns false once the feed is exhausted. */
  async function tick(t: number): Promise<boolean> {
    const observation = await observe(t);
    if (observation === null) return false;
    if (position === null || pool === null) return true;

    const result = step(plan, position, observation.mark);
    position = result.state;

    if (result.stalled) {
      await journal.write({
        kind: 'stall',
        t,
        market: key,
        reason: 'plan is USD-denominated and the quote asset has no reference this tick',
      });
      return true;
    }

    for (const intent of result.intents) {
      await journal.write({ kind: 'intent', t, market: key, intent });
      const executed = sell(pool, intent.qty, config.fees, t, haircut);
      pool = executed.pool;
      fills.push(executed.fill);

      const usdPerQuote = observation.mark.usdPerQuote;
      if (usdPerQuote !== null) {
        proceedsUsd += (Number(executed.fill.qtyQuote) / quoteUnit) * usdPerQuote;
      }
      await journal.write({ kind: 'fill', t, market: key, fill: executed.fill, position });
    }

    if (position.qtyOpen === 0n) {
      bankroll = recordExit(bankroll, {
        asset: config.market.base.address,
        costUsd,
        proceedsUsd,
        t,
      });
      await journal.write({ kind: 'bankroll', t, state: bankroll });
      position = null;
    }
    return true;
  }

  /** Drain a finite feed. Used by replay; a live run calls tick on a timer. */
  async function drain(times: number[]): Promise<void> {
    for (const t of times) {
      if (!(await tick(t))) return;
    }
  }

  function snapshot(): PaperSnapshot {
    return { bankroll, position, pool, costUsd, proceedsUsd, fills: [...fills] };
  }

  return { enter, tick, drain, snapshot };
}
