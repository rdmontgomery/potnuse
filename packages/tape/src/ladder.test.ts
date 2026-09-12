import { describe, expect, it } from 'vitest';
import { makePlan, openPosition, step, type LadderPlan, type PositionState } from './ladder.ts';
import type { Mark } from './types.ts';

const UNIT = 1_000_000_000_000_000_000n; // 1e18, one whole token

/** A stablecoin-quoted mark: quote price and USD price coincide. */
const stable = (t: number, price: number): Mark => ({
  t,
  quotePerBase: price,
  usdPerQuote: 1,
});

/** A mark whose quote asset itself floats, e.g. an equity or ETH pair. */
const floatQuote = (t: number, quotePerBase: number, usdPerQuote: number | null): Mark => ({
  t,
  quotePerBase,
  usdPerQuote,
});

const basePlan: LadderPlan = makePlan({
  denom: 'usd',
  rungs: [
    { atMultiple: 2, sellBps: 4000 },
    { atMultiple: 3, sellBps: 3000 },
    { atMultiple: 5, sellBps: 1500 },
  ],
  stopMultiple: 0.5,
  trail: { armAtMultiple: 2, dropPct: 35 },
});

const open = (plan: LadderPlan, price = 1) =>
  openPosition(plan, { basis: price, qty: 100n * UNIT, t: 0 });

/** Feed a series of prices through the engine, collecting every intent. */
function run(plan: LadderPlan, state: PositionState, marks: Mark[]) {
  const intents = [];
  let stalls = 0;
  for (const mark of marks) {
    const result = step(plan, state, mark);
    state = result.state;
    if (result.stalled) stalls += 1;
    intents.push(...result.intents);
  }
  return { state, intents, stalls };
}

describe('plan validation', () => {
  it('sorts rungs ascending regardless of input order', () => {
    const plan = makePlan({
      denom: 'quote',
      rungs: [
        { atMultiple: 5, sellBps: 1000 },
        { atMultiple: 2, sellBps: 4000 },
      ],
      stopMultiple: 0.5,
    });
    expect(plan.rungs.map((r) => r.atMultiple)).toEqual([2, 5]);
  });

  it('rejects rungs that sell more than the whole position', () => {
    expect(() =>
      makePlan({
        denom: 'quote',
        rungs: [
          { atMultiple: 2, sellBps: 7000 },
          { atMultiple: 3, sellBps: 4000 },
        ],
        stopMultiple: 0.5,
      }),
    ).toThrow(/more than all of it/);
  });

  it('rejects a first rung at or below the stop', () => {
    expect(() =>
      makePlan({
        denom: 'quote',
        rungs: [{ atMultiple: 0.5, sellBps: 1000 }],
        stopMultiple: 0.5,
      }),
    ).toThrow(/at or below the stop/);
  });

  it('rejects a stop at or above entry', () => {
    expect(() =>
      makePlan({ denom: 'quote', rungs: [{ atMultiple: 2, sellBps: 100 }], stopMultiple: 1 }),
    ).toThrow(/stopMultiple/);
  });
});

describe('take-profit rungs', () => {
  it('fires a rung once and only once', () => {
    const { intents, state } = run(basePlan, open(basePlan), [
      stable(1, 1.9),
      stable(2, 2.0),
      stable(3, 2.1),
      stable(4, 2.5),
    ]);
    expect(intents).toHaveLength(1);
    expect(intents[0]?.qty).toBe(40n * UNIT);
    expect(state.qtyOpen).toBe(60n * UNIT);
  });

  it('takes rung fractions of the original size, not the remainder', () => {
    const { intents, state } = run(basePlan, open(basePlan), [stable(1, 2), stable(2, 3)]);
    expect(intents.map((i) => i.qty)).toEqual([40n * UNIT, 30n * UNIT]);
    // 40 + 30 sold, not 40 then 30% of the remaining 60.
    expect(state.qtyOpen).toBe(30n * UNIT);
  });

  it('clears every rung a gap jumped over in a single tick', () => {
    const { intents, state } = run(basePlan, open(basePlan), [stable(1, 6)]);
    expect(intents.map((i) => i.reason)).toEqual([
      { kind: 'rung', index: 0, atMultiple: 2 },
      { kind: 'rung', index: 1, atMultiple: 3 },
      { kind: 'rung', index: 2, atMultiple: 5 },
    ]);
    // 40% + 30% + 15% sold, 15% left running.
    expect(state.qtyOpen).toBe(15n * UNIT);
  });

  it('fires a rung struck exactly on the nose, float representation notwithstanding', () => {
    // 0.3 / 0.1 is 2.9999999999999996. Without a tolerance the 3x rung sits
    // unfilled until some later tick happens to print higher.
    const state = openPosition(basePlan, { basis: 0.1, qty: 100n * UNIT, t: 0 });
    const { intents } = run(basePlan, state, [stable(1, 0.2), stable(2, 0.3)]);
    expect(intents.map((i) => i.reason)).toEqual([
      { kind: 'rung', index: 0, atMultiple: 2 },
      { kind: 'rung', index: 1, atMultiple: 3 },
    ]);
  });

  it('leaves the runner alone once every rung has filled', () => {
    const { state, intents } = run(basePlan, open(basePlan), [
      stable(1, 6),
      stable(2, 8),
      stable(3, 10),
    ]);
    expect(state.qtyOpen).toBe(15n * UNIT);
    expect(intents).toHaveLength(3);
  });

  it('never sells more than is open', () => {
    const plan = makePlan({
      denom: 'quote',
      rungs: [
        { atMultiple: 2, sellBps: 6000 },
        { atMultiple: 3, sellBps: 4000 },
      ],
      stopMultiple: 0.5,
    });
    const { state, intents } = run(plan, open(plan), [stable(1, 4)]);
    const sold = intents.reduce((sum, i) => sum + i.qty, 0n);
    expect(sold).toBe(100n * UNIT);
    expect(state.qtyOpen).toBe(0n);
    expect(state.closedAt).toBe(1);
  });
});

describe('exits', () => {
  it('stops the whole position out and stops trading it', () => {
    const { state, intents } = run(basePlan, open(basePlan), [stable(1, 0.5), stable(2, 4)]);
    expect(intents).toHaveLength(1);
    expect(intents[0]?.qty).toBe(100n * UNIT);
    expect(intents[0]?.reason).toEqual({ kind: 'stop', atMultiple: 0.5 });
    expect(state.qtyOpen).toBe(0n);
  });

  it('resolves a tick that gapped through both a rung and the stop as the stop', () => {
    // We saw a point, not a path. The pessimistic reading is the honest one.
    let state = open(basePlan);
    const first = step(basePlan, state, stable(1, 2)); // arm and fill rung 0
    state = first.state;
    const crash = step(basePlan, state, stable(2, 0.4));
    expect(crash.intents).toHaveLength(1);
    expect(crash.intents[0]?.reason.kind).toBe('stop');
    expect(crash.state.qtyOpen).toBe(0n);
  });

  it('does not arm the trail before the position has run', () => {
    const plan = makePlan({
      denom: 'quote',
      rungs: [{ atMultiple: 4, sellBps: 5000 }],
      stopMultiple: 0.2,
      trail: { armAtMultiple: 2, dropPct: 30 },
    });
    // Chop well below the arming multiple, with drops deeper than 30%.
    const { state, intents } = run(plan, open(plan), [
      stable(1, 1.4),
      stable(2, 0.9),
      stable(3, 1.3),
      stable(4, 0.85),
    ]);
    expect(intents).toHaveLength(0);
    expect(state.trailArmed).toBe(false);
  });

  it('trails the runner from its high-water mark once armed', () => {
    const { state, intents } = run(basePlan, open(basePlan), [
      stable(1, 6), // clears all three rungs, arms trail, high-water 6
      stable(2, 10), // high-water 10
      stable(3, 6.4), // -36% off the high
    ]);
    expect(state.highWater).toBe(10);
    const last = intents.at(-1);
    expect(last?.reason.kind).toBe('trail');
    expect(last?.qty).toBe(15n * UNIT);
    expect(state.qtyOpen).toBe(0n);
  });

  it('does not trail out on a tick that sets a new high', () => {
    const { intents } = run(basePlan, open(basePlan), [stable(1, 2), stable(2, 100)]);
    expect(intents.every((i) => i.reason.kind === 'rung')).toBe(true);
  });

  it('closes a position that has gone nowhere by the time stop', () => {
    const plan = makePlan({ ...basePlan, timeStopMs: 3_600_000 });
    const { state, intents } = run(plan, open(plan), [
      stable(1_000, 1.1),
      stable(3_600_000, 1.05),
    ]);
    expect(intents[0]?.reason).toEqual({ kind: 'time-stop', heldMs: 3_600_000 });
    expect(state.qtyOpen).toBe(0n);
  });
});

describe('quote asset is a parameter, not an assumption', () => {
  it('reads identical pool prices differently under a floating quote asset', () => {
    const usdPlan = makePlan({ ...basePlan, denom: 'usd' });
    const quotePlan = makePlan({ ...basePlan, denom: 'quote' });

    // The pair ratio doubles while the quote asset halves in dollars:
    // 2x against the quote, flat in USD.
    const marks = [floatQuote(1, 2, 50)];
    const entryUsd = openPosition(usdPlan, { basis: 1 * 100, qty: 100n * UNIT, t: 0 });
    const entryQuote = openPosition(quotePlan, { basis: 1, qty: 100n * UNIT, t: 0 });

    expect(run(usdPlan, entryUsd, marks).intents).toHaveLength(0);
    expect(run(quotePlan, entryQuote, marks).intents).toHaveLength(1);
  });

  it('stops out in USD when the quote asset collapses under a flat pair', () => {
    const plan = makePlan({ ...basePlan, denom: 'usd' });
    const state = openPosition(plan, { basis: 100, qty: 100n * UNIT, t: 0 });
    const { intents } = run(plan, state, [floatQuote(1, 1, 40)]);
    expect(intents[0]?.reason.kind).toBe('stop');
  });

  it('stalls rather than inventing a dollar price when the reference is missing', () => {
    const plan = makePlan({ ...basePlan, denom: 'usd' });
    const state = openPosition(plan, { basis: 100, qty: 100n * UNIT, t: 0 });
    const { intents, stalls, state: after } = run(plan, state, [floatQuote(1, 0.001, null)]);
    expect(stalls).toBe(1);
    expect(intents).toHaveLength(0);
    expect(after.qtyOpen).toBe(100n * UNIT);
  });

  it('keeps running a quote-denominated plan with no USD reference at all', () => {
    const plan = makePlan({ ...basePlan, denom: 'quote' });
    const state = openPosition(plan, { basis: 1, qty: 100n * UNIT, t: 0 });
    const { intents, stalls } = run(plan, state, [floatQuote(1, 2, null)]);
    expect(stalls).toBe(0);
    expect(intents).toHaveLength(1);
  });
});

describe('purity', () => {
  it('does not mutate the state it is given', () => {
    const state = open(basePlan);
    const snapshot = structuredClone({ ...state, qtyOriginal: 0n, qtyOpen: 0n });
    step(basePlan, state, stable(1, 6));
    expect(state.qtyOpen).toBe(100n * UNIT);
    expect(state.rungsFilled).toEqual([false, false, false]);
    expect(state.highWater).toBe(snapshot.highWater);
  });

  it('replays identically from the same inputs', () => {
    const marks = [stable(1, 1.5), stable(2, 2.2), stable(3, 3.4), stable(4, 2.9)];
    const a = run(basePlan, open(basePlan), marks);
    const b = run(basePlan, open(basePlan), marks);
    expect(a.intents).toEqual(b.intents);
    expect(a.state).toEqual(b.state);
  });
});
