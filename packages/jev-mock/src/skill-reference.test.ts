// Tests for the calibration-loop skill's reference code, so the code the skill
// hands to other repos is known to work.
import { describe, expect, it } from 'vitest';
import {
  applyCalibration, applyTemperature, calibrationKey, calibratedMock, compareOnHoldout, decide,
  fitPlatt, fitTemperature, psi, reliability, selectForReview, thresholdFromCosts,
  type CalibrationRow, type Decision, type Labelled,
} from '../skills/calibration-loop/reference/loop.ts';

const draw = (n: number, opts: Parameters<typeof calibratedMock>[0]) => {
  const m = calibratedMock(opts);
  return Array.from({ length: n }, () => m());
};

describe('calibration-loop reference', () => {
  it('passes an honest stream through with reliability near zero', () => {
    const s = draw(20000, { seed: 1 });
    const r = reliability(s.map((x) => ({ p: applyCalibration(undefined, x.reported), y: x.truth })));
    expect(r.reliability).toBeLessThan(0.001);
    expect(r.resolution).toBeGreaterThan(0.05);
  });

  it('Platt repairs a cooled stream out of sample and leaves resolution alone', () => {
    const s = draw(24000, { seed: 2, temperature: 0.5 });
    const fit: Labelled[] = s.slice(0, 4000).map((x) => ({ question: 'q', raw: x.reported, y: x.truth }));
    const { slope, intercept } = fitPlatt(fit);
    const row: CalibrationRow = { kind: 'platt', slope, intercept, fittedOn: 4000, modelVersion: 'v1' };
    const held = s.slice(4000);
    const before = reliability(held.map((x) => ({ p: x.reported, y: x.truth })));
    const after = reliability(held.map((x) => ({ p: applyCalibration(row, x.reported), y: x.truth })));
    expect(after.reliability).toBeLessThan(before.reliability / 10);
    expect(after.resolution).toBeCloseTo(before.resolution, 2);
    expect(slope).toBeCloseTo(0.5, 1);
  });

  it('only publishes a refit that wins on held-back rows', () => {
    const s = draw(8000, { seed: 3, temperature: 0.5 });
    const hold: Labelled[] = s.slice(4000).map((x) => ({ question: 'q', raw: x.reported, y: x.truth }));
    const good = fitPlatt(s.slice(0, 4000).map((x) => ({ question: 'q', raw: x.reported, y: x.truth })));
    const cand: CalibrationRow = { kind: 'platt', ...good, fittedOn: 4000, modelVersion: 'v1' };
    expect(compareOnHoldout(hold, undefined, cand).publish).toBe(true);
    const bad: CalibrationRow = { kind: 'platt', slope: 3, intercept: 1, fittedOn: 1, modelVersion: 'v1' };
    expect(compareOnHoldout(hold, cand, bad).publish).toBe(false);
  });

  it('derives thresholds from costs', () => {
    expect(thresholdFromCosts({ falsePositive: 5, falseNegative: 20 })).toBeCloseTo(0.2);
    expect(decide(0.25, 0.2)).toBe(true);
  });

  it('audits the configured share and its weighted count recovers the truth', () => {
    const s = draw(40000, { seed: 4, baseRate: 0.08 });
    const decisions: Decision[] = s.map((x, i) => ({ itemId: `t${i}`, question: 'abuse', raw: x.reported, p: x.reported, acted: x.reported >= 0.8 }));
    const q = selectForReview(decisions, 0.03);
    const audit = q.filter((x) => x.reason === 'audit');
    expect(audit.length / decisions.length).toBeGreaterThan(0.02);
    expect(audit.length / decisions.length).toBeLessThan(0.04);
    const truth = s.reduce((a, x) => a + x.truth, 0);
    const estimate = audit.reduce((a, x) => a + x.weight * s[Number(x.itemId.slice(1))]!.truth, 0);
    expect(Math.abs(estimate - truth) / truth).toBeLessThan(0.15);
  });

  it('drift stays quiet on the same stream and fires on a cooled one', () => {
    const a = draw(10000, { seed: 5 }).map((x) => x.reported);
    const b = draw(10000, { seed: 6 }).map((x) => x.reported);
    const c = draw(10000, { seed: 6, temperature: 0.4 }).map((x) => x.reported);
    expect(psi(a, b)).toBeLessThan(0.1);
    expect(psi(a, c)).toBeGreaterThan(0.25);
  });

  it('fits one temperature for a choice question', () => {
    const r = (() => { let s = 7; return () => ((s = (s * 16807) % 2147483647) / 2147483647); })();
    const rows = Array.from({ length: 3000 }, () => {
      const w = [r(), r(), r()].map((x) => x ** 3); const t = w.reduce((a, b) => a + b);
      const belief = w.map((x) => x / t);
      const u = r(); const truth = u < belief[0]! ? 'a' : u < belief[0]! + belief[1]! ? 'b' : 'c';
      const cooled = applyTemperature({ a: belief[0]!, b: belief[1]!, c: belief[2]! }, 0.5);
      return { probs: cooled, truth };
    });
    expect(fitTemperature(rows)).toBeCloseTo(2, 0);
  });

  it('gives a reworded question a new calibration key', () => {
    const a = calibrationKey('abuse', { instructions: 'Is this refund abusive?' }, 'jev-1.13.0');
    const b = calibrationKey('abuse', { instructions: 'Is this refund request fraudulent?' }, 'jev-1.13.0');
    const c = calibrationKey('abuse', { instructions: 'Is this refund abusive?' }, 'jev-1.14.0');
    expect(a).toBe(calibrationKey('abuse', { instructions: 'Is this refund abusive?' }, 'jev-1.13.0'));
    expect(new Set([a, b, c]).size).toBe(3);
  });
});
