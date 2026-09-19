/**
 * Scoring a stream of (forecast, outcome) pairs.
 *
 * A calibrated model is one where, among the items it called 0.8, it is right
 * about 80% of the time. That is a property of a *stream*, not of a response,
 * which is why you cannot test it with one assertion and why a mock that only
 * fakes the response shape cannot exercise it at all.
 */

export interface Pair {
  /** Forecast probability the model reported, in [0, 1]. */
  p: number;
  /** What actually happened: 1 or 0. */
  y: 0 | 1;
}

/** Mean squared error of the forecast. A strictly proper scoring rule: its
 *  unique minimizer is the true conditional probability, so you cannot game it
 *  by shading your reported confidence. Lower is better. */
export function brier(pairs: readonly Pair[]): number {
  if (pairs.length === 0) return NaN;
  return pairs.reduce((s, { p, y }) => s + (p - y) ** 2, 0) / pairs.length;
}

/** Mean negative log likelihood. Also strictly proper, and unboundedly harsh
 *  about confident mistakes — which is usually the behavior you want to punish. */
export function logLoss(pairs: readonly Pair[], eps = 1e-12): number {
  if (pairs.length === 0) return NaN;
  return (
    -pairs.reduce((s, { p, y }) => {
      const q = Math.min(1 - eps, Math.max(eps, p));
      return s + (y === 1 ? Math.log(q) : Math.log(1 - q));
    }, 0) / pairs.length
  );
}

export interface Bin {
  lo: number;
  hi: number;
  count: number;
  /** Mean forecast in this bin — what the model claimed. */
  meanP: number;
  /** Observed frequency in this bin — what happened. */
  meanY: number;
}

/** Equal-width binning of the forecast axis. The reliability diagram is
 *  `meanP` on x against `meanY` on y; calibration is the diagonal. */
export function bins(pairs: readonly Pair[], count = 10): Bin[] {
  const out: Bin[] = Array.from({ length: count }, (_, i) => ({
    lo: i / count,
    hi: (i + 1) / count,
    count: 0,
    meanP: 0,
    meanY: 0,
  }));
  for (const { p, y } of pairs) {
    const i = Math.min(count - 1, Math.max(0, Math.floor(p * count)));
    const b = out[i]!;
    b.count += 1;
    b.meanP += p;
    b.meanY += y;
  }
  for (const b of out) {
    if (b.count > 0) {
      b.meanP /= b.count;
      b.meanY /= b.count;
    }
  }
  return out;
}

/** Expected calibration error: the bin-weighted gap between claimed and
 *  observed. Zero is the goal. Note that ECE is binning-dependent and can be
 *  driven to zero by a model that always reports the base rate — which is why
 *  it is read next to resolution, never alone. */
export function ece(pairs: readonly Pair[], binCount = 10): number {
  const n = pairs.length;
  if (n === 0) return NaN;
  return bins(pairs, binCount)
    .filter((b) => b.count > 0)
    .reduce((s, b) => s + (b.count / n) * Math.abs(b.meanP - b.meanY), 0);
}

export interface Murphy {
  /** Miscalibration. Lower is better; 0 means the diagram sits on the diagonal. */
  reliability: number;
  /** Discrimination: how far the model's bins depart from the base rate. Higher
   *  is better. A model that always says "60%" has resolution 0 and can still
   *  have perfect reliability. */
  resolution: number;
  /** Irreducible variance of the outcome, base * (1 - base). Not the model's
   *  fault and not improvable. */
  uncertainty: number;
  /** reliability - resolution + uncertainty, which reconstructs the Brier score. */
  brier: number;
  baseRate: number;
}

/** Murphy's three-term decomposition of the Brier score. The useful half of
 *  this whole file: it splits "is the number honest" (reliability) from "is the
 *  number informative" (resolution). RLHF-trained scores can be strong on the
 *  second and arbitrarily bad on the first. */
export function murphy(pairs: readonly Pair[], binCount = 10): Murphy {
  const n = pairs.length;
  const baseRate = pairs.reduce((s, { y }) => s + y, 0) / n;
  const bs = bins(pairs, binCount).filter((b) => b.count > 0);
  let reliability = 0;
  let resolution = 0;
  for (const b of bs) {
    const w = b.count / n;
    reliability += w * (b.meanP - b.meanY) ** 2;
    resolution += w * (b.meanY - baseRate) ** 2;
  }
  const uncertainty = baseRate * (1 - baseRate);
  return {
    reliability,
    resolution,
    uncertainty,
    brier: reliability - resolution + uncertainty,
    baseRate,
  };
}

/** Render a reliability diagram as text, because a number in a test log is
 *  easier to ignore than a crooked line. */
export function diagram(pairs: readonly Pair[], binCount = 10): string {
  const rows = bins(pairs, binCount).map((b) => {
    const label = `${b.lo.toFixed(1)}-${b.hi.toFixed(1)}`;
    if (b.count === 0) return `${label}  ${''.padEnd(22)} n=0`;
    const gap = b.meanY - b.meanP;
    const bar = '#'.repeat(Math.round(b.meanY * 20));
    const sign = gap >= 0 ? '+' : '-';
    return `${label}  ${bar.padEnd(22)} obs=${b.meanY.toFixed(2)} gap=${sign}${Math.abs(gap).toFixed(2)} n=${b.count}`;
  });
  return rows.join('\n');
}
