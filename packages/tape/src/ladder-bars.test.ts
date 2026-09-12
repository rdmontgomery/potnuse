import { describe, expect, it } from 'vitest';
import { makePlan, openPosition, stepBar, studyStops, type LadderPlan } from './ladder.ts';
import type { Bar } from './quotes/types.ts';

const UNIT = 10n ** 18n;
const MINUTE = 60_000;

const bar = (n: number, open: number, high: number, low: number, close: number): Bar => ({
  t: n * MINUTE,
  open,
  high,
  low,
  close,
  volume: null,
});

const plan: LadderPlan = makePlan({
  denom: 'usd',
  rungs: [
    { atMultiple: 2, sellBps: 4000 },
    { atMultiple: 3, sellBps: 3000 },
    { atMultiple: 5, sellBps: 1500 },
  ],
  stopMultiple: 0.5,
  trail: { armAtMultiple: 2, dropPct: 35 },
});

const open = () => openPosition(plan, { basis: 1, qty: 100n * UNIT, t: 0 });

function run(bars: Bar[], p: LadderPlan = plan) {
  let state = open();
  const intents = [];
  for (const b of bars) {
    const result = stepBar(p, state, b);
    state = result.state;
    intents.push(...result.intents);
  }
  return { state, intents };
}

describe('a bar shows the excursion a point hides', () => {
  it('stops out on a wick the open and close never reveal', () => {
    // Opens at 3x, closes at 3.2x, and touched 0.4x in between. A poller
    // sampling either end sees a winning position and holds it.
    const { state, intents } = run([bar(1, 3, 3.3, 0.4, 3.2)]);
    expect(intents).toHaveLength(1);
    expect(intents[0]?.reason.kind).toBe('stop');
    expect(state.qtyOpen).toBe(0n);
  });

  it('fires every rung the high cleared', () => {
    const { state, intents } = run([bar(1, 1, 6, 0.9, 5.5)]);
    expect(intents.map((i) => i.reason)).toEqual([
      { kind: 'rung', index: 0, atMultiple: 2 },
      { kind: 'rung', index: 1, atMultiple: 3 },
      { kind: 'rung', index: 2, atMultiple: 5 },
    ]);
    expect(state.qtyOpen).toBe(15n * UNIT);
  });

  it('fills a rung at its trigger, never at the bar high', () => {
    const [intent] = run([bar(1, 1, 4.9, 1, 4.8)]).intents;
    expect(intent?.mark.quotePerBase).toBe(2);
  });

  it('resolves a bar that touched both a rung and the stop as the stop', () => {
    // We do not know the order within the bar, so we take the worse one.
    const { intents } = run([bar(1, 1, 4, 0.3, 2)]);
    expect(intents).toHaveLength(1);
    expect(intents[0]?.reason.kind).toBe('stop');
  });

  it('does not trail out from a peak set in the same bar as the drop', () => {
    // A peak and a low inside one bar have no knowable ordering. Treating
    // that as a trail exit closes winners on the volatility that made them
    // winners, which is noise rather than pessimism.
    const { state, intents } = run([bar(1, 1, 10, 1, 6.2)]);
    expect(intents.every((i) => i.reason.kind === 'rung')).toBe(true);
    expect(state.qtyOpen).toBe(15n * UNIT);
    expect(state.trailArmed).toBe(true);
    expect(state.highWater).toBe(10);
  });

  it('trails out on the next bar, from the peak the last one set', () => {
    const { state, intents } = run([bar(1, 1, 10, 1, 9), bar(2, 9, 9, 6, 6.2)]);
    expect(state.qtyOpen).toBe(0n);
    expect(intents.at(-1)?.reason).toEqual({ kind: 'trail', dropPct: 35, highWater: 10 });
  });

  it('does not trail out while price holds near its high', () => {
    const { intents } = run([bar(1, 1, 6, 1, 5.8), bar(2, 5.8, 6, 5, 5.9)]);
    expect(intents.every((i) => i.reason.kind === 'rung')).toBe(true);
  });

  it('refuses a bar with a non-positive price rather than dividing by it', () => {
    let state = open();
    const result = stepBar(plan, state, bar(1, 0, 0, 0, 0));
    expect(result.stalled).toBe(true);
    expect(result.state.qtyOpen).toBe(100n * UNIT);
  });

  it('stops trading a position once it is closed', () => {
    const { intents } = run([bar(1, 1, 1, 0.2, 0.3), bar(2, 3, 9, 3, 8)]);
    expect(intents).toHaveLength(1);
  });
});

describe('studying whether the stop pays for itself', () => {
  it('counts a stop that was followed by recovery above entry', () => {
    // Enter at 1.0, wick to 0.4, then back to 1.6. The stop cost money.
    const bars = [bar(0, 1, 1, 1, 1), bar(1, 1, 1, 0.4, 0.5), bar(2, 0.5, 1.6, 0.5, 1.5)];
    const study = studyStops(bars, { stopMultiple: 0.5 });
    expect(study.stopEvents).toBeGreaterThan(0);
    expect(study.recovered).toBeGreaterThan(0);
    expect(study.recoveryRate).toBeGreaterThan(0);
  });

  it('counts a stop that was not followed by recovery', () => {
    // Every bar is a hypothetical entry, so a tape that only falls produces
    // one stop event per entry that had somewhere left to fall.
    const bars = [bar(0, 1, 1, 1, 1), bar(1, 1, 1, 0.4, 0.4), bar(2, 0.4, 0.45, 0.2, 0.25)];
    const study = studyStops(bars, { stopMultiple: 0.5 });
    expect(study.stopEvents).toBe(2);
    expect(study.recovered).toBe(0);
    expect(study.recoveryRate).toBe(0);
  });

  it('does not count a position that reached its first rung before any stop', () => {
    const bars = [bar(0, 1, 1, 1, 1), bar(1, 1, 2.5, 1, 2.4), bar(2, 2.4, 2.4, 0.3, 0.3)];
    // The entry at bar 0 won before it lost, so it is not a stop event.
    expect(studyStops(bars, { stopMultiple: 0.5 }).stopEvents).toBeLessThan(bars.length);
  });

  it('honours the recovery window rather than counting a rebound days later', () => {
    const bars = [
      bar(0, 1, 1, 1, 1),
      bar(1, 1, 1, 0.4, 0.4),
      { ...bar(2, 0.4, 3, 0.4, 2.9), t: 48 * 60 * MINUTE },
    ];
    expect(studyStops(bars, { stopMultiple: 0.5, withinMs: 60 * MINUTE }).recovered).toBe(0);
    expect(studyStops(bars, { stopMultiple: 0.5, withinMs: 72 * 60 * MINUTE }).recovered).toBe(1);
  });

  it('notes when a stopped-out entry went on to reach the first rung', () => {
    const bars = [bar(0, 1, 1, 1, 1), bar(1, 1, 1, 0.4, 0.4), bar(2, 0.4, 2.5, 0.4, 2.4)];
    const study = studyStops(bars, { stopMultiple: 0.5, firstRungMultiple: 2 });
    expect(study.reachedFirstRung).toBe(1);
  });

  it('reports nothing rather than dividing by zero on a quiet tape', () => {
    expect(studyStops([bar(0, 1, 1.01, 0.99, 1)], { stopMultiple: 0.5 })).toEqual({
      stopEvents: 0,
      recovered: 0,
      reachedFirstRung: 0,
      recoveryRate: 0,
    });
  });

  it('handles an empty tape', () => {
    expect(studyStops([], { stopMultiple: 0.5 }).stopEvents).toBe(0);
  });
});
