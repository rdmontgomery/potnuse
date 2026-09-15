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
import { makePlan, openPosition, stepBar, type LadderPlan, type PositionState } from './ladder.ts';
import { poolFromLiquidity } from './quotes/synthetic.ts';
import { screen, type ScreenFacts, type ScreenPolicy, type Verdict } from './screen.ts';
import type { Bar, PairQuote } from './quotes/types.ts';
import type { Journal } from './journal.ts';
import type { Fill, Market } from './types.ts';

export interface BarPaperConfig {
  pair: PairQuote;
  plan: LadderPlan;
  bankroll: BankrollConfig;
  fees: FeeSchedule;
  latencyHaircutBps?: number;
}

export interface BarPaperState {
  bankroll: BankrollState;
  position: PositionState | null;
  costUsd: number;
  proceedsUsd: number;
}

export type BarEnterOutcome =
  | { opened: true; sizeUsd: number; fill: Fill }
  | { opened: false; why: string; verdict?: Verdict };

/** Dollars are the unit throughout: aggregator prices are already USD. */
const USD_DECIMALS = 6;
const usd = (units: bigint) => Number(units) / 10 ** USD_DECIMALS;
const units = (dollars: number) => BigInt(Math.round(dollars * 10 ** USD_DECIMALS));

/** A pretend market, so the screen and journal can describe a pair from any venue. */
function asMarket(pair: PairQuote): Market {
  return {
    base: {
      chainId: 0,
      address: (pair.baseAddress ?? '0x') as Market['base']['address'],
      symbol: pair.baseSymbol ?? '???',
      decimals: 18,
    },
    quote: {
      chainId: 0,
      address: (pair.quoteAddress ?? '0x') as Market['quote']['address'],
      symbol: pair.quoteSymbol ?? 'USD',
      decimals: USD_DECIMALS,
    },
    pool: pair.pairId as Market['pool'],
    venue: pair.dex ?? 'unknown',
  };
}

/**
 * A paper session driven by candles rather than chain reads.
 *
 * Every price here is in dollars, which removes the whole quote-denomination
 * problem: an aggregator has already done the conversion, and the ladder can
 * measure multiples in the unit the trader actually cares about.
 *
 * Reserves are reconstructed per bar from the pair's liquidity and that bar's
 * price, so the fill model charges real impact without anyone knowing whether
 * the venue was a V2 pair, a concentrated pool or a Solana AMM. That estimate
 * is the price of covering every venue with one implementation, and it is
 * stated where it is made rather than buried.
 */
export function barSession(
  config: BarPaperConfig,
  journal: Journal,
  restore?: BarPaperState,
) {
  const plan = makePlan(config.plan);
  const bankrollConfig = makeBankroll(config.bankroll);
  const haircut = { latencyHaircutBps: config.latencyHaircutBps ?? 30 };
  const key = config.pair.pairId;
  const market = asMarket(config.pair);

  let bankroll = restore?.bankroll ?? openBankroll();
  let position: PositionState | null = restore?.position ?? null;
  let costUsd = restore?.costUsd ?? 0;
  let proceedsUsd = restore?.proceedsUsd ?? 0;
  const fills: Fill[] = [];

  /** Reserves implied by the pair's depth at a given price. */
  function poolAt(priceUsd: number): PoolState | null {
    if (config.pair.liquidityUsd === null) return null;
    return poolFromLiquidity(config.pair.liquidityUsd, priceUsd, {
      baseDecimals: 18,
      quoteDecimals: USD_DECIMALS,
    });
  }

  async function enter(
    t: number,
    facts: Omit<ScreenFacts, 'market' | 'pool' | 'fees'>,
    policy: Omit<ScreenPolicy, 'intendedSizeUsd'> = {},
  ): Promise<BarEnterOutcome> {
    if (position !== null) return { opened: false, why: 'already holding this pair' };

    const price = config.pair.priceUsd;
    if (price === null || !(price > 0)) {
      return { opened: false, why: 'no dollar price for this pair' };
    }
    const pool = poolAt(price);
    if (!pool) return { opened: false, why: 'no liquidity figure, so size cannot be checked' };

    const decision = proposeEntry(bankrollConfig, bankroll, {
      asset: market.base.address,
      t,
    });
    await journal.write({ kind: 'proposal', t, market: key, decision });
    if (!decision.allowed) return { opened: false, why: `${decision.reason}: ${decision.detail}` };

    const verdict = screen(
      { ...facts, market, pool, fees: config.fees },
      { ...policy, intendedSizeUsd: decision.sizeUsd },
    );
    await journal.write({ kind: 'screen', t, market: key, verdict });
    if (verdict.outcome === 'block') {
      return { opened: false, why: 'screen blocked the entry', verdict };
    }

    const result = buy(pool, units(decision.sizeUsd), config.fees, t, haircut);
    fills.push(result.fill);
    costUsd = decision.sizeUsd;
    bankroll = recordEntry(bankroll, decision.sizeUsd);
    position = openPosition(plan, { basis: price, qty: result.fill.qtyBase, t });

    await journal.write({ kind: 'fill', t, market: key, fill: result.fill, position });
    await journal.write({ kind: 'bankroll', t, state: bankroll });
    return { opened: true, sizeUsd: decision.sizeUsd, fill: result.fill };
  }

  /** Run the ladder across a run of bars, oldest first. Returns bars consumed. */
  async function advance(bars: readonly Bar[]): Promise<number> {
    let consumed = 0;
    for (const bar of bars) {
      consumed += 1;
      await journal.write({
        kind: 'mark',
        t: bar.t,
        market: key,
        mark: { t: bar.t, quotePerBase: bar.close, usdPerQuote: 1 },
        pool: poolAt(bar.close) ?? {
          reserveBase: 0n,
          reserveQuote: 0n,
          baseDecimals: 18,
          quoteDecimals: USD_DECIMALS,
        },
      });
      if (position === null) continue;

      const result = stepBar(plan, position, bar);
      position = result.state;
      if (result.stalled) {
        await journal.write({ kind: 'stall', t: bar.t, market: key, reason: 'bar had no price' });
        continue;
      }

      for (const intent of result.intents) {
        await journal.write({ kind: 'intent', t: bar.t, market: key, intent });
        // Price the fill at the trigger, with impact taken against the depth
        // implied there — not at the bar's close, which the ladder never saw.
        const pool = poolAt(intent.mark.quotePerBase);
        if (!pool) continue;
        const executed = sell(pool, intent.qty, config.fees, bar.t, haircut);
        fills.push(executed.fill);
        proceedsUsd += usd(executed.fill.qtyQuote);
        await journal.write({ kind: 'fill', t: bar.t, market: key, fill: executed.fill, position });
      }

      if (position.qtyOpen === 0n) {
        bankroll = recordExit(bankroll, {
          asset: market.base.address,
          costUsd,
          proceedsUsd,
          t: bar.t,
        });
        await journal.write({ kind: 'bankroll', t: bar.t, state: bankroll });
        position = null;
      }
    }
    return consumed;
  }

  function state(): BarPaperState {
    return { bankroll, position, costUsd, proceedsUsd };
  }

  return { enter, advance, state, fills: () => [...fills], market };
}
