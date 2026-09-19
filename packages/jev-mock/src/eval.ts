/**
 * Building your own eval suite against a vendor you cannot inspect.
 *
 * The premise: you will never see the model's training data, its RLCD reward,
 * or its internal logits. What you can see is a stream of (forecast, outcome)
 * pairs on *your* distribution, which is the only distribution that matters.
 * Everything here operates on that stream.
 *
 * The load-bearing consequence is that vendor calibration is a convenience, not
 * a dependency. A monotone score plus a few hundred labels is enough to
 * manufacture calibration yourself, in your own layer, on your own data.
 */

import { type Bin, bins, brier, ece, murphy, type Pair } from './calibration.ts';

// --- error bars -------------------------------------------------------------

export interface Interval {
  lo: number;
  hi: number;
}

/**
 * Wilson score interval for a binomial proportion. Use it on every bin of a
 * reliability diagram. A diagram without error bars is a Rorschach test: at
 * n=40 per bin the 95% interval is about +/-0.15 wide, which is wider than most
 * of the miscalibration anyone is arguing about.
 */
export function wilson(successes: number, n: number, z = 1.96): Interval {
  if (n === 0) return { lo: 0, hi: 1 };
  const p = successes / n;
  const z2 = z * z;
  const denom = 1 + z2 / n;
  const center = (p + z2 / (2 * n)) / denom;
  const half = (z * Math.sqrt((p * (1 - p)) / n + z2 / (4 * n * n))) / denom;
  return { lo: Math.max(0, center - half), hi: Math.min(1, center + half) };
}

export interface BinWithInterval extends Bin {
  interval: Interval;
  /** True when the claimed probability falls outside the observed interval —
   *  i.e. this bin is miscalibrated by more than sampling noise explains. */
  offDiagonal: boolean;
}

/** A reliability diagram you are allowed to draw conclusions from. */
export function reliabilityTable(pairs: readonly Pair[], binCount = 10): BinWithInterval[] {
  return bins(pairs, binCount).map((b) => {
    const interval = wilson(Math.round(b.meanY * b.count), b.count);
    return {
      ...b,
      interval,
      offDiagonal: b.count > 0 && (b.meanP < interval.lo || b.meanP > interval.hi),
    };
  });
}

// --- recalibration ----------------------------------------------------------

export interface Recalibrator {
  (p: number): number;
}

const logit = (p: number) => Math.log(p / (1 - p));
const sigmoid = (x: number) => 1 / (1 + Math.exp(-x));
const clamp = (p: number, eps = 1e-6) => Math.min(1 - eps, Math.max(eps, p));

/**
 * Platt scaling: fit `sigmoid(a * logit(p) + b)` by Newton-Raphson on the log
 * loss. Two parameters, so it works on a few hundred labels, and it is exactly
 * the inverse of the temperature distortion in `mock.ts` — which is why it
 * repairs an RLHF-shaped overconfidence almost completely.
 *
 * Being a monotone map, it cannot change the ranking, and therefore cannot
 * change resolution. It buys back reliability only. That is the correct
 * division of labor: the vendor sells you discrimination, you manufacture
 * honesty locally.
 */
export function platt(pairs: readonly Pair[], iterations = 60): Recalibrator {
  let a = 1;
  let b = 0;
  const xs = pairs.map(({ p }) => logit(clamp(p)));
  const ys = pairs.map(({ y }) => y as number);

  for (let it = 0; it < iterations; it++) {
    let g0 = 0;
    let g1 = 0;
    let h00 = 0;
    let h01 = 0;
    let h11 = 0;
    for (let i = 0; i < xs.length; i++) {
      const x = xs[i]!;
      const mu = sigmoid(a * x + b);
      const r = mu - ys[i]!;
      const w = Math.max(mu * (1 - mu), 1e-9);
      g0 += r * x;
      g1 += r;
      h00 += w * x * x;
      h01 += w * x;
      h11 += w;
    }
    const det = h00 * h11 - h01 * h01;
    if (!Number.isFinite(det) || Math.abs(det) < 1e-12) break;
    const da = (h11 * g0 - h01 * g1) / det;
    const db = (h00 * g1 - h01 * g0) / det;
    a -= da;
    b -= db;
    if (Math.abs(da) + Math.abs(db) < 1e-10) break;
  }

  return (p: number) => sigmoid(a * logit(clamp(p)) + b);
}

/**
 * Isotonic regression by pool-adjacent-violators. Non-parametric, so it fixes
 * shapes Platt cannot, and it overfits hard on small samples — below about a
 * thousand labels prefer Platt. Also monotone, so again: reliability only.
 */
export function isotonic(pairs: readonly Pair[]): Recalibrator {
  const sorted = [...pairs].sort((m, n) => m.p - n.p);
  if (sorted.length === 0) return (p) => p;

  const x = sorted.map((d) => d.p);
  const v = sorted.map((d) => d.y as number);
  const w = sorted.map(() => 1);

  // PAV: walk forward, pooling any block that violates monotonicity.
  const blocks: { start: number; value: number; weight: number }[] = [];
  for (let i = 0; i < v.length; i++) {
    blocks.push({ start: i, value: v[i]!, weight: w[i]! });
    while (blocks.length > 1 && blocks[blocks.length - 2]!.value > blocks[blocks.length - 1]!.value) {
      const b = blocks.pop()!;
      const a = blocks.pop()!;
      const weight = a.weight + b.weight;
      blocks.push({
        start: a.start,
        value: (a.value * a.weight + b.value * b.weight) / weight,
        weight,
      });
    }
  }

  // Flatten to a step function over the sorted forecast axis.
  const knots: { p: number; y: number }[] = [];
  for (const block of blocks) knots.push({ p: x[block.start]!, y: block.value });

  return (p: number) => {
    let lo = 0;
    let hi = knots.length - 1;
    if (p <= knots[0]!.p) return knots[0]!.y;
    if (p >= knots[hi]!.p) return knots[hi]!.y;
    while (hi - lo > 1) {
      const mid = (lo + hi) >> 1;
      if (knots[mid]!.p <= p) lo = mid;
      else hi = mid;
    }
    return knots[lo]!.y;
  };
}

export function applyRecalibration(
  pairs: readonly Pair[],
  fit: Recalibrator,
): Pair[] {
  return pairs.map(({ p, y }) => ({ p: fit(p), y }));
}

// --- honest splits ----------------------------------------------------------

/**
 * Deterministic fit/test split. Recalibration fitted and scored on the same
 * pairs will report an ECE near zero no matter how badly it overfits, which is
 * the single most common way a calibration report lies.
 */
export function split(
  pairs: readonly Pair[],
  fitFraction = 0.5,
): { fit: Pair[]; test: Pair[] } {
  const cut = Math.floor(pairs.length * fitFraction);
  return { fit: pairs.slice(0, cut), test: pairs.slice(cut) };
}

/**
 * Stratified sample of items to label, allocated across the forecast axis
 * rather than uniformly at random. Uniform sampling spends most of its labels
 * in the confident bulk, where you already believe the model; the bins near
 * your decision threshold are the ones that decide your costs. Returns indices
 * into `pairs`, so you can use it to pick which production rows to send for
 * human labelling.
 */
export function stratifiedSample(
  forecasts: readonly number[],
  perBin: number,
  binCount = 10,
): number[] {
  const buckets: number[][] = Array.from({ length: binCount }, () => []);
  forecasts.forEach((p, i) => {
    const b = Math.min(binCount - 1, Math.max(0, Math.floor(p * binCount)));
    buckets[b]!.push(i);
  });
  // Deterministic: take evenly spaced items from each bucket.
  const out: number[] = [];
  for (const bucket of buckets) {
    if (bucket.length <= perBin) {
      out.push(...bucket);
      continue;
    }
    const stride = bucket.length / perBin;
    for (let k = 0; k < perBin; k++) out.push(bucket[Math.floor(k * stride)]!);
  }
  return out.sort((a, b) => a - b);
}

// --- release gates ----------------------------------------------------------

export interface Report {
  n: number;
  ece: number;
  brier: number;
  reliability: number;
  resolution: number;
  /** Bins whose claimed probability sits outside their Wilson interval. */
  offDiagonalBins: number;
}

export function report(pairs: readonly Pair[], binCount = 10): Report {
  const m = murphy(pairs, binCount);
  return {
    n: pairs.length,
    ece: ece(pairs, binCount),
    brier: brier(pairs),
    reliability: m.reliability,
    resolution: m.resolution,
    offDiagonalBins: reliabilityTable(pairs, binCount).filter((b) => b.offDiagonal).length,
  };
}

export interface Gate {
  /** Maximum tolerable reliability term. Scale-free and far less noisy than ECE. */
  maxReliability: number;
  /** Minimum resolution — the model must still be informative, not just humble. */
  minResolution: number;
  /** Minimum sample size before the gate is allowed to have an opinion. */
  minSamples: number;
}

export interface GateResult {
  pass: boolean;
  reasons: string[];
  report: Report;
}

/**
 * What to gate a model-version bump on. Not accuracy: accuracy is a ranking
 * statistic at a fixed threshold and it moves last. Reliability moves first,
 * silently, and takes your cost model with it.
 */
export function gate(pairs: readonly Pair[], g: Gate): GateResult {
  const r = report(pairs);
  const reasons: string[] = [];
  if (r.n < g.minSamples) {
    reasons.push(`only ${r.n} labelled items; ${g.minSamples} needed to distinguish signal from binning noise`);
  }
  if (r.reliability > g.maxReliability) {
    reasons.push(`reliability ${r.reliability.toFixed(5)} exceeds ${g.maxReliability}`);
  }
  if (r.resolution < g.minResolution) {
    reasons.push(`resolution ${r.resolution.toFixed(4)} below ${g.minResolution}: honest but uninformative`);
  }
  return { pass: reasons.length === 0, reasons, report: r };
}

/**
 * How many labels do you need? Answer it by simulation rather than by a formula
 * you will misremember. Give it two stream generators — the calibration you
 * would accept and the calibration you must catch — and it returns the
 * empirical power of a reliability-term gate at that sample size.
 */
export async function power(
  makeAcceptable: (n: number, seed: number) => Promise<Pair[]>,
  makeBad: (n: number, seed: number) => Promise<Pair[]>,
  n: number,
  trials = 40,
): Promise<{ n: number; falsePositiveRate: number; detectionRate: number; cutoff: number }> {
  const good: number[] = [];
  const bad: number[] = [];
  for (let t = 0; t < trials; t++) {
    good.push(murphy(await makeAcceptable(n, 1000 + t)).reliability);
    bad.push(murphy(await makeBad(n, 1000 + t)).reliability);
  }
  // Cutoff at the 95th percentile of the acceptable stream: a 5% false alarm
  // budget, chosen first, so the detection rate is an honest number.
  const cutoff = [...good].sort((a, b) => a - b)[Math.floor(0.95 * (trials - 1))]!;
  return {
    n,
    cutoff,
    falsePositiveRate: good.filter((x) => x > cutoff).length / trials,
    detectionRate: bad.filter((x) => x > cutoff).length / trials,
  };
}
