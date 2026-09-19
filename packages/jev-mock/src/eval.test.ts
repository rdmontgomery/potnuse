import { describe, expect, it } from 'vitest';
import {
  applyRecalibration,
  calibratedJev,
  ece,
  gate,
  isotonic,
  murphy,
  type Pair,
  platt,
  power,
  reliabilityTable,
  report,
  split,
  stratifiedSample,
  wilson,
} from './index.ts';

const question = {
  urgent: { type: 'boolean', instructions: 'Does this convey urgency?' },
} as const;

async function streamOf(temperature: number, n: number, seed = 42): Promise<Pair[]> {
  const mock = calibratedJev({ seed, temperature });
  for (let i = 0; i < n; i++) await mock.decide(`ticket ${i}`, question);
  return mock.log.map((o) => o.pair);
}

describe('error bars', () => {
  it('gives a wide interval on a small bin and a tight one on a large bin', () => {
    const small = wilson(20, 40);
    const large = wilson(2000, 4000);
    expect(small.hi - small.lo).toBeGreaterThan(0.25);
    expect(large.hi - large.lo).toBeLessThan(0.04);
  });

  it('flags no bins on an honest stream and several on a hot one', async () => {
    const honest = reliabilityTable(await streamOf(1, 8000));
    const hot = reliabilityTable(await streamOf(0.5, 8000));
    expect(honest.filter((b) => b.offDiagonal).length).toBeLessThanOrEqual(1);
    expect(hot.filter((b) => b.offDiagonal).length).toBeGreaterThanOrEqual(5);
  });
});

describe('recalibration', () => {
  it('repairs an overconfident vendor out of sample', async () => {
    const { fit, test } = split(await streamOf(0.5, 8000));
    const before = report(test);
    const after = report(applyRecalibration(test, platt(fit)));

    // Reliability is what gets bought back, and it is bought back nearly whole.
    expect(after.reliability).toBeLessThan(before.reliability / 5);
    expect(after.ece).toBeLessThan(before.ece / 2);

    // Resolution is untouched, because Platt scaling is monotone and therefore
    // cannot reorder anything. You cannot recalibrate your way to a smarter
    // model, only to an honest one.
    expect(after.resolution).toBeCloseTo(before.resolution, 2);
  });

  it('works on a few hundred labels, which is the practical point', async () => {
    const { fit, test } = split(await streamOf(0.5, 20000), 0.02); // 400 labels
    expect(fit.length).toBe(400);
    const before = ece(test);
    const after = ece(applyRecalibration(test, platt(fit)));
    expect(after).toBeLessThan(before / 2);
  });

  it('isotonic reports a perfect in-sample ECE at every sample size', async () => {
    // The purest form of the overfitting tell. Isotonic regression fits the
    // empirical frequencies exactly, so its in-sample calibration error is
    // identically zero whether you gave it a hundred labels or ten thousand.
    // Any calibration report that does not hold out is reporting this number.
    const all = await streamOf(0.5, 20000);
    for (const n of [100, 400, 4000]) {
      const fit = all.slice(0, n);
      expect(ece(applyRecalibration(fit, isotonic(fit))), `n=${n}`).toBeLessThan(0.005);
    }
  });

  it('prefers Platt when labels are scarce and ties once they are not', async () => {
    const all = await streamOf(0.5, 20000);
    const held = all.slice(10000, 12000);
    const raw = ece(held);

    const at = (n: number) => {
      const fit = all.slice(0, n);
      return {
        iso: ece(applyRecalibration(held, isotonic(fit))),
        platt: ece(applyRecalibration(held, platt(fit))),
      };
    };
    const scarce = at(100);
    const plenty = at(10000);

    // Both help out of sample, at both budgets.
    for (const r of [scarce, plenty]) {
      expect(r.iso).toBeLessThan(raw);
      expect(r.platt).toBeLessThan(raw);
    }
    // Two parameters beat a step function when labels are scarce...
    expect(scarce.platt).toBeLessThan(scarce.iso * 0.8);
    // ...and the gap closes once they are not.
    expect(plenty.platt).toBeGreaterThan(plenty.iso * 0.8);
    // More labels help the non-parametric fit far more than the parametric one.
    expect(plenty.iso).toBeLessThan(scarce.iso * 0.6);
  });

  it('leaves an already-honest stream alone', async () => {
    const { fit, test } = split(await streamOf(1, 8000));
    const after = ece(applyRecalibration(test, platt(fit)));
    expect(after).toBeLessThan(ece(test) * 1.5);
  });
});

describe('label allocation', () => {
  it('spends labels across the forecast axis instead of in the bulk', async () => {
    const pairs = await streamOf(1, 20000);
    const forecasts = pairs.map((p) => p.p);
    const picked = stratifiedSample(forecasts, 40);

    const perBin = new Array(10).fill(0) as number[];
    for (const i of picked) perBin[Math.min(9, Math.floor(forecasts[i]! * 10))]! += 1;

    // Every bin gets labels. Uniform random sampling of the same budget would
    // put most of them in the two extreme bins, where nobody is arguing.
    for (const count of perBin) expect(count).toBeGreaterThan(0);
    expect(Math.max(...perBin) - Math.min(...perBin)).toBeLessThan(10);
  });
});

describe('release gate', () => {
  const g = { maxReliability: 0.002, minResolution: 0.08, minSamples: 2000 };

  it('passes an honest model and fails a hot one', async () => {
    expect(gate(await streamOf(1, 8000), g).pass).toBe(true);
    const hot = gate(await streamOf(0.5, 8000), g);
    expect(hot.pass).toBe(false);
    expect(hot.reasons.join(' ')).toMatch(/reliability/);
  });

  it('refuses to have an opinion on too few labels', async () => {
    const thin = gate(await streamOf(1, 500), g);
    expect(thin.pass).toBe(false);
    expect(thin.reasons.join(' ')).toMatch(/labelled items/);
  });

  it('fails a model that is honest but says nothing', () => {
    // Always reports the base rate: perfectly reliable, zero resolution.
    const pairs: Pair[] = Array.from({ length: 4000 }, (_, i) => ({
      p: 0.5,
      y: (i % 2) as 0 | 1,
    }));
    const r = gate(pairs, g);
    expect(murphy(pairs).reliability).toBeLessThan(1e-9);
    expect(r.pass).toBe(false);
    expect(r.reasons.join(' ')).toMatch(/uninformative/);
  });
});

describe('power', () => {
  it('says how many labels it takes to catch 15% overconfidence', async () => {
    const acceptable = (n: number, seed: number) => streamOf(1, n, seed);
    const bad = (n: number, seed: number) => streamOf(0.5, n, seed);
    const thin = await power(acceptable, bad, 250, 30);
    const thick = await power(acceptable, bad, 4000, 30);
    expect(thick.detectionRate).toBeGreaterThan(thin.detectionRate);
    expect(thick.detectionRate).toBeGreaterThan(0.9);
    expect(thick.falsePositiveRate).toBeLessThanOrEqual(0.1);
  });
});
