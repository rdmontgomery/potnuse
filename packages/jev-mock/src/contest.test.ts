import { describe, expect, it } from 'vitest';
import { contest, shiftPrior, verbalize, VERBAL_MENU } from './contest.ts';
import { platt, isotonic } from './eval.ts';
import { ece, murphy, type Pair } from './calibration.ts';
import { evaluate } from './policy.ts';

const COSTS = { falsePositive: 5, falseNegative: 20 };
const at02 = { lo: 0.2, hi: 0.2, degenerate: true as const };
const d = contest({ n: 60_000, seed: 3 });
const pairs = (ps: number[], from: number, to: number): Pair[] =>
  ps.slice(from, to).map((p, i) => ({ p, y: d.y[from + i]! }));
const test = (ps: number[]) => pairs(ps, 20_000, 60_000);

describe('the contest data', () => {
  it('hits the requested base rate and keeps its honest posteriors honest', () => {
    const rate = d.y.reduce<number>((s, y) => s + y, 0) / d.y.length;
    expect(rate).toBeCloseTo(0.92, 2);
    expect(ece(test(d.honestJev))).toBeLessThan(0.01);
    expect(ece(test(d.honestLlm))).toBeLessThan(0.01);
  });

  it('gives the verbalized readout a dozen values at most', () => {
    expect(new Set(d.llmVerbal).size).toBeLessThanOrEqual(2 * VERBAL_MENU.length);
    expect(verbalize(0.97)).toBe(0.95);
    expect(verbalize(0.03)).toBeCloseTo(0.05);
  });
});

describe('platt', () => {
  it('does not diverge on a cooled model with extreme logits and few labels', () => {
    // Regression: undamped Newton from slope 1 made this fit worse as labels
    // were added. Small, nearly separable, extreme — the hardest case.
    for (const n of [50, 100, 200, 400]) {
      const fit = platt(pairs(d.llmLogprob, 0, n));
      const after = test(d.llmLogprob).map(({ p, y }) => ({ p: fit(p), y }));
      expect(murphy(after).reliability, `n=${n}`).toBeLessThan(0.01);
      expect(evaluate(after, COSTS, at02).costPerItem, `n=${n}`).toBeLessThan(0.5);
    }
  });

  it('never makes reliability worse given plenty of labels', () => {
    for (const ps of [d.jevLike, d.llmLogprob, d.llmVerbal]) {
      const fit = platt(pairs(ps, 0, 4000));
      const after = test(ps).map(({ p, y }) => ({ p: fit(p), y }));
      expect(murphy(after).reliability).toBeLessThanOrEqual(murphy(test(ps)).reliability + 1e-4);
    }
  });
});

describe('what recalibration can and cannot give back', () => {
  it('fixes a base-rate mismatch with one number and no labels', () => {
    const raw = test(d.jevLike);
    const fixed = raw.map(({ p, y }) => ({ p: shiftPrior(p, d.priorShift), y }));
    expect(murphy(raw).reliability).toBeGreaterThan(0.02);
    expect(murphy(fixed).reliability).toBeLessThan(0.001);
    expect(evaluate(fixed, COSTS, at02).costPerItem).toBeLessThan(evaluate(raw, COSTS, at02).costPerItem / 2);
  });

  it('cannot recover resolution lost to ties, whatever the fitter', () => {
    const logprobFit = platt(pairs(d.llmLogprob, 0, 4000));
    const lp = test(d.llmLogprob).map(({ p, y }) => ({ p: logprobFit(p), y }));
    for (const fitter of [platt, isotonic]) {
      const fit = fitter(pairs(d.llmVerbal, 0, 4000));
      const vb = test(d.llmVerbal).map(({ p, y }) => ({ p: fit(p), y }));
      // Same model, same belief; only the readout differs.
      expect(murphy(vb).resolution).toBeLessThan(murphy(lp).resolution);
    }
  });
});
