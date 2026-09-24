/**
 * Reference implementation for the calibration-loop skill.
 *
 * Self-contained on purpose: no imports, so it can be copied into any
 * TypeScript/JavaScript codebase and adapted. Every function is small enough to
 * port to Python or SQL by reading it.
 *
 * The pieces, in the order a request meets them:
 *   serving     applyCalibration, thresholdFromCosts, decide
 *   queue       selectForReview (acted-on items + a weighted random audit)
 *   refit       fitPlatt, fitTemperature, compareOnHoldout
 *   checks      reliability (weighted Murphy terms + ECE)
 *   drift       psi (label-free; an alarm, not a calibration test)
 *   testing     calibratedMock (a fake model whose honesty you set exactly)
 */

// --- basics -----------------------------------------------------------------

export const logit = (p: number) => {
  const q = Math.min(1 - 1e-6, Math.max(1e-6, p));
  return Math.log(q / (1 - q));
};
export const sigmoid = (x: number) => 1 / (1 + Math.exp(-x));

/** One labelled judgment. `weight` is 1 for items reviewed because they were
 *  acted on, and 1/auditRate for items that came through the random audit. */
export interface Labelled {
  question: string;
  raw: number; // the probability the model reported
  y: 0 | 1; // what a person decided was true
  weight?: number;
}

// --- serving ----------------------------------------------------------------

/** One row per question definition on one model version: see calibrationKey.
 *  Yes/no questions get a slope and intercept on the logit (Platt); choice
 *  questions get a single temperature, a good first fix but not a general one. */
export type CalibrationRow =
  | { kind: 'platt'; slope: number; intercept: number; fittedOn: number; modelVersion: string }
  | { kind: 'temperature'; temperature: number; fittedOn: number; modelVersion: string };

/**
 * The key a calibration row lives under. Rewording a question makes it a new
 * forecaster even if its id is unchanged, and a new model version bends
 * differently, so both go into the key. `definition` is whatever defines the
 * question: instructions, criteria, options.
 */
export function calibrationKey(questionId: string, definition: unknown, modelVersion: string): string {
  return `${questionId}:${hash01(JSON.stringify(definition)).toString(36).slice(2, 10)}:${modelVersion}`;
}

export function applyCalibration(row: CalibrationRow | undefined, raw: number): number {
  if (!row || row.kind !== 'platt') return raw; // unfitted: pass through, and say so in the log
  return sigmoid(row.slope * logit(raw) + row.intercept);
}

/** Choice distributions: divide the logits by one temperature and renormalize. */
export function applyTemperature(probs: Record<string, number>, temperature: number): Record<string, number> {
  const keys = Object.keys(probs);
  const z = keys.map((k) => Math.log(Math.max(1e-12, probs[k]!)) / temperature);
  const m = Math.max(...z);
  const e = z.map((v) => Math.exp(v - m));
  const s = e.reduce((a, b) => a + b, 0);
  return Object.fromEntries(keys.map((k, i) => [k, e[i]! / s]));
}

/**
 * The two-by-two, divided. Acting when you shouldn't costs `falsePositive`;
 * not acting when you should costs `falseNegative`; right calls cost nothing.
 * Act when P(event) >= falsePositive / (falsePositive + falseNegative).
 * Only meaningful on a calibrated probability.
 */
export function thresholdFromCosts(costs: { falsePositive: number; falseNegative: number }): number {
  return costs.falsePositive / (costs.falsePositive + costs.falseNegative);
}

export function decide(p: number, threshold: number): boolean {
  return p >= threshold;
}

// --- the annotation queue -----------------------------------------------------

/** FNV-1a, so the audit sample is deterministic and reproducible. */
function hash01(s: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0) / 4294967296;
}

export interface Decision {
  itemId: string;
  question: string;
  raw: number;
  p: number;
  acted: boolean;
}

export interface QueueItem extends Decision {
  reason: 'acted' | 'audit';
  weight: number;
}

/**
 * What to put in front of a person. Everything you acted on, because someone
 * reviews those anyway, plus a random `auditRate` share of EVERYTHING, acted on
 * or not. Without the audit you learn precision forever and recall never.
 *
 * Weights: audit items stand for 1/auditRate items of traffic. Acted-on items
 * that were not also drawn by the audit carry weight 1 but are NOT a random
 * sample; use them for precision, and use only the audit rows (weighted) for
 * any number that should describe all traffic.
 */
export function selectForReview(decisions: Decision[], auditRate = 0.03, reviewActed = true): QueueItem[] {
  const out: QueueItem[] = [];
  for (const d of decisions) {
    const audited = hash01(`${d.itemId}\u0000${d.question}`) < auditRate;
    if (audited) out.push({ ...d, reason: 'audit', weight: 1 / auditRate });
    else if (reviewActed && d.acted) out.push({ ...d, reason: 'acted', weight: 1 });
  }
  return out;
}

// --- refitting ----------------------------------------------------------------

/**
 * Platt scaling: fit sigmoid(slope * logit(raw) + intercept). Smoothed targets
 * and a damped Newton step (Platt 1999); without them a small, nearly
 * separable sample on extreme logits diverges.
 */
export function fitPlatt(rows: readonly Labelled[], iterations = 100): { slope: number; intercept: number } {
  const xs = rows.map((r) => logit(r.raw));
  const ws = rows.map((r) => r.weight ?? 1);
  const nPos = rows.reduce((s, r, i) => s + r.y * ws[i]!, 0);
  const nNeg = rows.reduce((s, r, i) => s + (1 - r.y) * ws[i]!, 0);
  const hi = (nPos + 1) / (nPos + 2);
  const lo = 1 / (nNeg + 2);
  const ts = rows.map((r) => (r.y === 1 ? hi : lo));
  const loss = (a: number, b: number) => {
    let l = 0;
    for (let i = 0; i < xs.length; i++) {
      const z = a * xs[i]! + b;
      l += ws[i]! * ((z > 0 ? z + Math.log1p(Math.exp(-z)) : Math.log1p(Math.exp(z))) - ts[i]! * z);
    }
    return l;
  };
  let a = 0;
  let b = Math.log((nPos + 1) / (nNeg + 1));
  let cur = loss(a, b);
  for (let it = 0; it < iterations; it++) {
    let g0 = 0, g1 = 0, h00 = 1e-12, h01 = 0, h11 = 1e-12;
    for (let i = 0; i < xs.length; i++) {
      const mu = sigmoid(a * xs[i]! + b);
      const r = ws[i]! * (mu - ts[i]!);
      const w = ws[i]! * mu * (1 - mu);
      g0 += r * xs[i]!; g1 += r;
      h00 += w * xs[i]! * xs[i]!; h01 += w * xs[i]!; h11 += w;
    }
    const det = h00 * h11 - h01 * h01;
    if (!(det > 0)) break;
    const da = (h11 * g0 - h01 * g1) / det;
    const db = (h00 * g1 - h01 * g0) / det;
    let step = 1;
    let next = loss(a - da, b - db);
    while (!(next <= cur) && step > 1e-10) {
      step /= 2;
      next = loss(a - step * da, b - step * db);
    }
    if (!(next <= cur)) break;
    a -= step * da;
    b -= step * db;
    const gain = cur - next;
    cur = next;
    if (gain < 1e-12 * Math.max(1, Math.abs(cur))) break;
  }
  return { slope: a, intercept: b };
}

/**
 * One temperature for a choice question, by golden-section search on the
 * negative log likelihood of the chosen-correct option.
 */
export function fitTemperature(
  rows: readonly { probs: Record<string, number>; truth: string; weight?: number }[],
): number {
  const nll = (t: number) =>
    rows.reduce((s, r) => s - (r.weight ?? 1) * Math.log(Math.max(1e-12, applyTemperature(r.probs, t)[r.truth] ?? 0)), 0);
  let lo = 0.05, hi = 20;
  const g = (Math.sqrt(5) - 1) / 2;
  let c = hi - g * (hi - lo), d = lo + g * (hi - lo);
  for (let i = 0; i < 80; i++) {
    if (nll(c) < nll(d)) hi = d; else lo = c;
    c = hi - g * (hi - lo);
    d = lo + g * (hi - lo);
  }
  return (lo + hi) / 2;
}

/** Publish a new row only if it beats the old one on rows neither was fit on. */
export function compareOnHoldout(
  holdout: readonly Labelled[],
  current: CalibrationRow | undefined,
  candidate: CalibrationRow,
): { currentBrier: number; candidateBrier: number; publish: boolean } {
  const brier = (row: CalibrationRow | undefined) => {
    let s = 0, w = 0;
    for (const r of holdout) {
      const wt = r.weight ?? 1;
      s += wt * (applyCalibration(row, r.raw) - r.y) ** 2;
      w += wt;
    }
    return s / w;
  };
  const currentBrier = brier(current);
  const candidateBrier = brier(candidate);
  return { currentBrier, candidateBrier, publish: candidateBrier < currentBrier };
}

// --- checks -------------------------------------------------------------------

/**
 * Weighted Murphy decomposition over ten buckets, plus ECE. Reliability: is the
 * number honest (0 is perfect). Resolution: is it informative. Read them
 * together; a model that says the base rate to everything has perfect
 * reliability and zero resolution.
 */
export function reliability(pairs: readonly { p: number; y: 0 | 1; weight?: number }[], buckets = 10) {
  const W = pairs.reduce((s, x) => s + (x.weight ?? 1), 0);
  const base = pairs.reduce((s, x) => s + (x.weight ?? 1) * x.y, 0) / W;
  const b = Array.from({ length: buckets }, () => ({ w: 0, p: 0, y: 0 }));
  for (const x of pairs) {
    const k = Math.min(buckets - 1, Math.floor(x.p * buckets));
    const w = x.weight ?? 1;
    b[k]!.w += w; b[k]!.p += w * x.p; b[k]!.y += w * x.y;
  }
  let rel = 0, res = 0, ece = 0;
  for (const k of b) {
    if (k.w === 0) continue;
    const claimed = k.p / k.w, happened = k.y / k.w, share = k.w / W;
    rel += share * (claimed - happened) ** 2;
    res += share * (happened - base) ** 2;
    ece += share * Math.abs(claimed - happened);
  }
  return { reliability: rel, resolution: res, ece, baseRate: base, n: pairs.length };
}

// --- drift ----------------------------------------------------------------------

/** Population stability index between two samples of raw probabilities. No
 *  labels. Under 0.1 quiet, 0.1-0.25 watch, above 0.25 investigate and pull
 *  fresh labels forward. An alarm, not a calibration test: calibration can
 *  decay with an unchanged histogram, so keep the random audit running. */
export function psi(baseline: readonly number[], current: readonly number[], buckets = 10): number {
  const hist = (xs: readonly number[]) => {
    const h = new Array(buckets).fill(0.5); // Laplace, so empty buckets don't divide by zero
    for (const x of xs) h[Math.min(buckets - 1, Math.floor(x * buckets))] += 1;
    const t = h.reduce((a: number, b: number) => a + b, 0);
    return h.map((v: number) => v / t);
  };
  const a = hist(baseline), c = hist(current);
  return a.reduce((s: number, ai: number, i: number) => s + (c[i]! - ai) * Math.log(c[i]! / ai), 0);
}

// --- testing ----------------------------------------------------------------------

/** Tiny seeded PRNG (mulberry32). */
export function rng(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = Math.imul(s ^ (s >>> 15), s | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * A fake yes/no model whose honesty you set exactly, for testing the decision
 * layer before you have real labels. It draws the belief first and the truth
 * from the belief, so at temperature 1 it is calibrated by construction. Below
 * 1 it reports overconfidently, above 1 underconfidently, while the truth
 * stays where it was. `baseRate` shifts every belief's log-odds so the share
 * of positives matches your traffic.
 */
export function calibratedMock(opts: { seed?: number; temperature?: number; baseRate?: number; spread?: number } = {}) {
  const { seed = 1, temperature = 1, baseRate = 0.5, spread = 2 } = opts;
  const r = rng(seed);
  const gauss = () => Math.sqrt(-2 * Math.log(Math.max(r(), 1e-12))) * Math.cos(2 * Math.PI * r());
  // Centre of the belief distribution, found once so the mean belief ~ baseRate.
  let lo = -20, hi = 20;
  const meanBelief = (c: number) => {
    let s = 0; const n = 2000; const rr = rng(99);
    for (let i = 0; i < n; i++) {
      const z = Math.sqrt(-2 * Math.log(Math.max(rr(), 1e-12))) * Math.cos(2 * Math.PI * rr());
      s += sigmoid(c + spread * z);
    }
    return s / n;
  };
  for (let i = 0; i < 40; i++) { const m = (lo + hi) / 2; if (meanBelief(m) < baseRate) lo = m; else hi = m; }
  const centre = (lo + hi) / 2;
  return () => {
    const belief = sigmoid(centre + spread * gauss());
    const truth: 0 | 1 = r() < belief ? 1 : 0;
    const reported = sigmoid(logit(belief) / temperature);
    return { reported, truth };
  };
}
