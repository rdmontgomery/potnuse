import { basis } from './price.ts';
import { type Denom, type Intent, type Mark, TapeError } from './types.ts';
import type { Bar } from './quotes/types.ts';

const BPS = 10_000n;

/**
 * Relative tolerance on multiple comparisons.
 *
 * Prices are float ratios, so a rung struck exactly on the nose can compare
 * as a miss: 0.3 / 0.1 is 2.9999999999999996, and a 3x rung would sit there
 * unfilled until the next tick happened to print higher. This is nine orders
 * of magnitude below any price move worth reacting to and several above the
 * representation error, so it resolves the artefact without loosening the
 * strategy by anything observable.
 */
const EPSILON = 1e-9;

const atLeast = (value: number, target: number) => value >= target * (1 - EPSILON);
const atMost = (value: number, target: number) => value <= target * (1 + EPSILON);

export interface Rung {
  /** Fires once the position is worth this multiple of its entry basis. */
  atMultiple: number;
  /** Portion of the ORIGINAL position to sell, in basis points. */
  sellBps: number;
}

export interface LadderPlan {
  denom: Denom;
  /** Take-profit rungs. Sorted ascending on construction; must not sum past 100%. */
  rungs: Rung[];
  /** Hard exit for the whole position at this multiple, e.g. 0.5 for -50%. */
  stopMultiple: number;
  /**
   * Trailing stop on whatever survives the rungs — the runner. Disarmed until
   * the position has actually run, so it never fires on entry chop.
   */
  trail?: { armAtMultiple: number; dropPct: number };
  /** Exit if the position has gone nowhere for this long. Optional. */
  timeStopMs?: number;
}

export interface PositionState {
  entryBasis: number;
  qtyOriginal: bigint;
  qtyOpen: bigint;
  /** Parallel to plan.rungs. */
  rungsFilled: boolean[];
  highWater: number;
  trailArmed: boolean;
  openedAt: number;
  closedAt: number | null;
}

export interface StepResult {
  state: PositionState;
  intents: Intent[];
  /**
   * True when this tick could not be evaluated — a USD-denominated plan and
   * no USD reference for the quote asset. The caller should surface this, not
   * swallow it: a plan that stalls every tick is a plan that is not running.
   */
  stalled: boolean;
}

/** Validate and normalise a plan. Throws rather than silently repairing. */
export function makePlan(plan: LadderPlan): LadderPlan {
  const rungs = [...plan.rungs].sort((a, b) => a.atMultiple - b.atMultiple);

  for (const rung of rungs) {
    if (!(rung.atMultiple > 0)) throw new TapeError('rung multiple must be positive');
    if (rung.sellBps <= 0 || rung.sellBps > 10_000) {
      throw new TapeError(`rung sellBps out of range: ${rung.sellBps}`);
    }
  }
  const total = rungs.reduce((sum, r) => sum + r.sellBps, 0);
  if (total > 10_000) {
    throw new TapeError(`rungs sell ${total}bps of the position, more than all of it`);
  }
  if (!(plan.stopMultiple > 0) || plan.stopMultiple >= 1) {
    throw new TapeError('stopMultiple must be in (0, 1)');
  }
  if (rungs[0] && rungs[0].atMultiple <= plan.stopMultiple) {
    throw new TapeError('first rung sits at or below the stop');
  }
  if (plan.trail) {
    if (plan.trail.dropPct <= 0 || plan.trail.dropPct >= 100) {
      throw new TapeError('trail dropPct must be in (0, 100)');
    }
    if (!(plan.trail.armAtMultiple > 0)) throw new TapeError('trail armAtMultiple must be positive');
  }
  if (plan.timeStopMs !== undefined && plan.timeStopMs <= 0) {
    throw new TapeError('timeStopMs must be positive');
  }
  return { ...plan, rungs };
}

export function openPosition(
  plan: LadderPlan,
  entry: { basis: number; qty: bigint; t: number },
): PositionState {
  if (!(entry.basis > 0)) throw new TapeError('entry basis must be positive');
  if (entry.qty <= 0n) throw new TapeError('entry qty must be positive');
  return {
    entryBasis: entry.basis,
    qtyOriginal: entry.qty,
    qtyOpen: entry.qty,
    rungsFilled: plan.rungs.map(() => false),
    highWater: entry.basis,
    trailArmed: false,
    openedAt: entry.t,
    closedAt: null,
  };
}

/**
 * Advance the ladder by one observation.
 *
 * Pure: no clock, no network, no randomness. Time arrives inside the mark.
 * That is what makes a week of paper trading replayable against a changed
 * plan, which is the only reason the paper week is worth running.
 *
 * Ordering matters and is deliberate. Exits are evaluated before take-profit
 * rungs, so a tick that gapped through both a rung and the stop resolves as
 * the stop. We only observe points, never the path between them, and the
 * pessimistic reading is the one that does not flatter the backtest. The
 * corollary is that poll interval is a risk parameter: wide marks hide real
 * excursions in both directions.
 */
export function step(plan: LadderPlan, state: PositionState, mark: Mark): StepResult {
  if (state.qtyOpen === 0n || state.closedAt !== null) {
    return { state, intents: [], stalled: false };
  }

  const b = basis(mark, plan.denom);
  if (b === null) return { state, intents: [], stalled: true };

  const multiple = b / state.entryBasis;
  const next: PositionState = {
    ...state,
    rungsFilled: [...state.rungsFilled],
    highWater: Math.max(state.highWater, b),
    trailArmed:
      state.trailArmed ||
      (plan.trail !== undefined && atLeast(multiple, plan.trail.armAtMultiple)),
  };

  const exitAll = (reason: Intent['reason']): StepResult => ({
    state: { ...next, qtyOpen: 0n, closedAt: mark.t },
    intents: [{ side: 'sell', qty: state.qtyOpen, reason, mark }],
    stalled: false,
  });

  if (atMost(multiple, plan.stopMultiple)) {
    return exitAll({ kind: 'stop', atMultiple: multiple });
  }

  if (plan.trail && next.trailArmed) {
    const floor = next.highWater * (1 - plan.trail.dropPct / 100);
    if (atMost(b, floor)) {
      return exitAll({
        kind: 'trail',
        dropPct: plan.trail.dropPct,
        highWater: next.highWater,
      });
    }
  }

  if (plan.timeStopMs !== undefined && mark.t - state.openedAt >= plan.timeStopMs) {
    return exitAll({ kind: 'time-stop', heldMs: mark.t - state.openedAt });
  }

  // Take-profit. A gap can clear several rungs at once; fire all of them
  // rather than one per tick, or a vertical move leaves the ladder behind.
  const intents: Intent[] = [];
  let remaining = state.qtyOpen;

  for (const [index, rung] of plan.rungs.entries()) {
    if (next.rungsFilled[index]) continue;
    if (!atLeast(multiple, rung.atMultiple)) continue;

    next.rungsFilled[index] = true;
    // Fractions are always of the ORIGINAL size. Taking them off the
    // remainder instead would compound: 40% then 30% of what is left is 58%
    // sold, not 70%, and the runner silently grows.
    const want = (state.qtyOriginal * BigInt(rung.sellBps)) / BPS;
    const qty = want > remaining ? remaining : want;
    if (qty <= 0n) continue;

    remaining -= qty;
    intents.push({
      side: 'sell',
      qty,
      reason: { kind: 'rung', index, atMultiple: rung.atMultiple },
      mark,
    });
  }

  next.qtyOpen = remaining;
  if (remaining === 0n) next.closedAt = mark.t;

  return { state: next, intents, stalled: false };
}

/**
 * Advance the ladder across one OHLCV bar.
 *
 * The point-based `step` above can only see where price was when someone
 * looked. A bar carries the high and the low, which is the excursion itself —
 * the wick through a stop that a poll straddling it never knew happened.
 *
 * We still do not know the ORDER of the high and the low within the bar, so
 * every ambiguity resolves to the worse outcome:
 *
 *   - The stop is checked against the low before anything else. A bar that
 *     touched both a rung and the stop exits at the stop and fires no rungs.
 *   - Rungs fill at their trigger price, never at the bar's high.
 *
 * The trail is the exception, and it goes the other way. It fires only from a
 * high-water mark established in an EARLIER bar. A trail is by definition a
 * drop from a peak, and a peak set in the same bar as the low has no knowable
 * ordering against it — treating that as a trail exit would close winners on
 * the volatility that made them winners, which is not pessimism, just noise.
 * The bar still arms the trail and raises the high-water mark for next time.
 *
 * Prices in the bar must already be in the plan's denomination; the caller
 * owns that conversion, because only the caller knows what the source quoted.
 */
export function stepBar(plan: LadderPlan, state: PositionState, bar: Bar): StepResult {
  if (state.qtyOpen === 0n || state.closedAt !== null) {
    return { state, intents: [], stalled: false };
  }
  if (!(bar.low > 0) || !(bar.high > 0)) return { state, intents: [], stalled: true };

  const priced = (price: number): Mark => ({ t: bar.t, quotePerBase: price, usdPerQuote: 1 });
  const lowMultiple = bar.low / state.entryBasis;
  const highMultiple = bar.high / state.entryBasis;

  // Captured before the bar updates them: the trail may only act on a peak
  // that already existed when this bar opened.
  const armedComingIn = state.trailArmed;
  const priorHighWater = state.highWater;

  const next: PositionState = {
    ...state,
    rungsFilled: [...state.rungsFilled],
    highWater: Math.max(state.highWater, bar.high),
    trailArmed:
      state.trailArmed ||
      (plan.trail !== undefined && atLeast(highMultiple, plan.trail.armAtMultiple)),
  };

  const exitAll = (reason: Intent['reason'], at: number): StepResult => ({
    state: { ...next, qtyOpen: 0n, closedAt: bar.t },
    intents: [{ side: 'sell', qty: state.qtyOpen, reason, mark: priced(at) }],
    stalled: false,
  });

  if (atMost(lowMultiple, plan.stopMultiple)) {
    return exitAll(
      { kind: 'stop', atMultiple: lowMultiple },
      state.entryBasis * plan.stopMultiple,
    );
  }

  if (plan.trail && armedComingIn) {
    const floor = priorHighWater * (1 - plan.trail.dropPct / 100);
    if (atMost(bar.low, floor)) {
      return exitAll(
        { kind: 'trail', dropPct: plan.trail.dropPct, highWater: priorHighWater },
        floor,
      );
    }
  }

  if (plan.timeStopMs !== undefined && bar.t - state.openedAt >= plan.timeStopMs) {
    return exitAll({ kind: 'time-stop', heldMs: bar.t - state.openedAt }, bar.close);
  }

  const intents: Intent[] = [];
  let remaining = state.qtyOpen;

  for (const [index, rung] of plan.rungs.entries()) {
    if (next.rungsFilled[index]) continue;
    if (!atLeast(highMultiple, rung.atMultiple)) continue;

    next.rungsFilled[index] = true;
    const want = (state.qtyOriginal * BigInt(rung.sellBps)) / BPS;
    const qty = want > remaining ? remaining : want;
    if (qty <= 0n) continue;

    remaining -= qty;
    intents.push({
      side: 'sell',
      qty,
      reason: { kind: 'rung', index, atMultiple: rung.atMultiple },
      // Filled at the trigger, never at the bar's high.
      mark: priced(state.entryBasis * rung.atMultiple),
    });
  }

  next.qtyOpen = remaining;
  if (remaining === 0n) next.closedAt = bar.t;

  return { state: next, intents, stalled: false };
}

export interface StopStudy {
  /** Bars where price fell to or below the stop. */
  stopEvents: number;
  /** Of those, how many later traded back above the entry. */
  recovered: number;
  /** Of those, how many reached the first rung after stopping out. */
  reachedFirstRung: number;
  recoveryRate: number;
}

/**
 * How often a stop-out was followed by recovery.
 *
 * The first question the paper week exists to answer, and the one with real
 * sample size: stop events accumulate across every recorded tape even when the
 * number of trades is tiny. A stop that is usually followed by recovery above
 * entry is not protection, it is a tax on wicks — and memecoins mean-revert
 * violently enough that this is a live possibility rather than a rhetorical
 * one.
 *
 * Deliberately independent of any position: it asks what WOULD have happened
 * to an entry at each bar, so a tape recorded on a token never traded still
 * contributes evidence.
 */
export function studyStops(
  bars: readonly Bar[],
  opts: { stopMultiple: number; firstRungMultiple?: number; withinMs?: number },
): StopStudy {
  const within = opts.withinMs ?? 6 * 60 * 60_000;
  const firstRung = opts.firstRungMultiple ?? 2;
  let stopEvents = 0;
  let recovered = 0;
  let reachedFirstRung = 0;

  for (let i = 0; i < bars.length; i += 1) {
    const entry = bars[i]!;
    const entryPrice = entry.close;
    if (!(entryPrice > 0)) continue;

    // Find the first later bar whose low breaches the stop.
    let stoppedAt = -1;
    for (let j = i + 1; j < bars.length; j += 1) {
      if (bars[j]!.low <= entryPrice * opts.stopMultiple) {
        stoppedAt = j;
        break;
      }
      if (bars[j]!.high >= entryPrice * firstRung) break; // won before it lost
    }
    if (stoppedAt === -1) continue;

    stopEvents += 1;
    const deadline = bars[stoppedAt]!.t + within;
    for (let k = stoppedAt + 1; k < bars.length && bars[k]!.t <= deadline; k += 1) {
      if (bars[k]!.high > entryPrice) {
        recovered += 1;
        for (let m = k; m < bars.length && bars[m]!.t <= deadline; m += 1) {
          if (bars[m]!.high >= entryPrice * firstRung) {
            reachedFirstRung += 1;
            break;
          }
        }
        break;
      }
    }
  }

  return {
    stopEvents,
    recovered,
    reachedFirstRung,
    recoveryRate: stopEvents === 0 ? 0 : recovered / stopEvents,
  };
}
