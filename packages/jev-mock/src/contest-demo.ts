/**
 * Runs the three-model contest and prints every number the write-up quotes.
 *
 *   pnpm --filter @rdm/jev-mock contest
 */
import { contest, shiftPrior } from './contest.ts';
import { platt, isotonic, type Recalibrator } from './eval.ts';
import { brier, ece, murphy, type Pair } from './calibration.ts';
import { evaluate, sweep, threshold } from './policy.ts';
import { rng } from './rng.ts';

const COSTS = { falsePositive: 5, falseNegative: 20 }; // approve abuse $5, deny legit $20
const T = threshold(COSTS); // 0.2
const at = (t: number) => ({ lo: t, hi: t, degenerate: true as const });

const N_FIT_POOL = 20_000;
const N_TEST = 200_000;
const data = contest({ n: N_FIT_POOL + N_TEST, seed: 2026 });
const idx = (a: number, b: number) => Array.from({ length: b - a }, (_, i) => a + i);
const fitIdx = idx(0, N_FIT_POOL);
const testIdx = idx(N_FIT_POOL, N_FIT_POOL + N_TEST);

type Key = 'jevLike' | 'llmLogprob' | 'llmVerbal';
const MODELS: [Key, string][] = [
  ['jevLike', 'Jev-like, trained at 50%'],
  ['llmLogprob', 'LLM, log-probs, cooled'],
  ['llmVerbal', 'LLM, verbalized'],
];

const pairsOf = (ps: number[], ids: number[]): Pair[] => ids.map((i) => ({ p: ps[i]!, y: data.y[i]! }));
const f = (x: number, d = 4) => x.toFixed(d).padStart(d + 3);
const money = (x: number) => ('$' + x.toFixed(3)).padStart(7);
const variance = (ps: number[]) => {
  const m = ps.reduce((a, b) => a + b, 0) / ps.length;
  return ps.reduce((a, b) => a + (b - m) ** 2, 0) / ps.length;
};

function report(label: string, P: Pair[]) {
  const m = murphy(P);
  const c = evaluate(P, COSTS, at(T));
  const best = sweep(P, COSTS);
  console.log(
    `${label.padEnd(40)} reliab ${f(m.reliability, 5)}  resol ${f(m.resolution)}  ECE ${f(ece(P))}` +
      `  cost@0.20 ${money(c.costPerItem)}  best ${money(best.costPerItem)} @ ${best.threshold.toFixed(2)}`,
  );
}

console.log('\n=== the queue ===');
const base = testIdx.reduce((s, i) => s + data.y[i]!, 0) / testIdx.length;
console.log('share legitimate:', f(base), ' prior shift for the Jev-like model:', f(data.priorShift, 3));
console.log('threshold from the costs: approve when P(legit) >=', T.toFixed(2));
const approveAll = testIdx.reduce((s, i) => s + (data.y[i] === 0 ? 5 : 0), 0) / testIdx.length;
console.log('approve everything:', money(approveAll), '  deny everything:', money(base * 20));

console.log('\n=== resolution = Var(p) for a calibrated forecaster, at a 92% base rate ===');
for (const [k, label] of [['oracle', 'oracle'], ['honestJev', 'honest Jev posterior'], ['honestLlm', 'honest LLM posterior']] as const) {
  const ps = testIdx.map((i) => data[k][i]!);
  const P = pairsOf(data[k], testIdx);
  const fine = murphy(P, 100).resolution;
  console.log(`${label.padEnd(22)} Var(p) ${f(variance(ps), 5)}  resolution, 10 bins ${f(murphy(P).resolution, 5)}  100 bins ${f(fine, 5)}  ECE ${f(ece(P))}`);
}

console.log('\n=== before anything: raw outputs at the 0.20 threshold ===');
report('oracle (knows the true probability)', pairsOf(data.oracle, testIdx));
for (const [k, label] of MODELS) report(label, pairsOf(data[k], testIdx));

console.log('\n=== zero labels: move the Jev-like intercept by one number ===');
const shifted = data.jevLike.map((p) => shiftPrior(p, data.priorShift));
report('Jev-like, prior shifted', pairsOf(shifted, testIdx));

console.log('\n=== the same loop on all three: Platt on n labels, scored on 200k held out ===');
const SIZES = [50, 100, 200, 400, 1000, 4000];
const REPS = 30;
const curve: Record<string, { n: number; cost: number; reliability: number; resolution: number }[]> = {};
const draw = rng(7);

function fitAndScore(ps: number[], n: number, fitter: (p: Pair[]) => Recalibrator) {
  let cost = 0, rel = 0, res = 0;
  for (let rep = 0; rep < REPS; rep++) {
    const ids = Array.from({ length: n }, () => fitIdx[Math.floor(draw() * fitIdx.length)]!);
    const fn = fitter(pairsOf(ps, ids));
    const P = testIdx.map((i) => ({ p: fn(ps[i]!), y: data.y[i]! }));
    cost += evaluate(P, COSTS, at(T)).costPerItem;
    const m = murphy(P);
    rel += m.reliability;
    res += m.resolution;
  }
  return { n, cost: cost / REPS, reliability: rel / REPS, resolution: res / REPS };
}

console.log('labels'.padEnd(8) + MODELS.map(([, l]) => l.padEnd(34)).join(''));
for (const [k] of MODELS) curve[k] = [];
curve['llmVerbal-iso'] = [];
for (const n of SIZES) {
  const row: string[] = [];
  for (const [k] of MODELS) {
    const s = fitAndScore(data[k], n, platt);
    curve[k]!.push(s);
    row.push(`${money(s.cost)}  rel ${f(s.reliability, 5)} res ${f(s.resolution, 3)}`.padEnd(34));
  }
  curve['llmVerbal-iso']!.push(fitAndScore(data.llmVerbal, n, isotonic));
  console.log(String(n).padEnd(8) + row.join(''));
}

console.log('\n=== verbalized: does a better fitter help? (isotonic, same labels) ===');
for (const s of curve['llmVerbal-iso']!) console.log(`n=${String(s.n).padEnd(6)} cost ${money(s.cost)}  resolution ${f(s.resolution)}`);
const distinct = new Set(testIdx.map((i) => data.llmVerbal[i]!)).size;
console.log('distinct values the verbalized readout ever produces:', distinct);

console.log('\n=== same model, two readouts: what the ties cost ===');
const lp = curve['llmLogprob']!.at(-1)!, vb = curve['llmVerbal']!.at(-1)!;
console.log(`at n=4000   log-probs ${money(lp.cost)}  verbalized ${money(vb.cost)}  gap ${money(vb.cost - lp.cost)} per ticket` +
  `  (${Math.round(((vb.cost - lp.cost) / lp.cost) * 100)}%)`);

console.log('\n=== raw reliability, before any fit (does verbalized start more honest?) ===');
for (const [k, label] of MODELS) console.log(`${label.padEnd(34)} reliability ${f(murphy(pairsOf(data[k], testIdx)).reliability, 5)}`);

console.log('\n=== counting: how many abusive requests came in this week? ===');
// 100 weeks of 2,000 tickets. Summing honest probabilities is counting.
const WEEK = 2000;
const fitJ = platt(pairsOf(data.jevLike, fitIdx.slice(0, 400)));
const weeks = Math.floor(testIdx.length / WEEK);
let errSum = 0, errRaw = 0, errCC = 0, errLLMraw = 0, errOracle = 0, errShift = 0;
for (let w = 0; w < Math.min(100, weeks); w++) {
  const ids = testIdx.slice(w * WEEK, (w + 1) * WEEK);
  const truth = ids.reduce((s, i) => s + (1 - data.y[i]!), 0);
  const sumCal = ids.reduce((s, i) => s + (1 - fitJ(data.jevLike[i]!)), 0);
  const sumRaw = ids.reduce((s, i) => s + (1 - data.jevLike[i]!), 0);
  const cc = ids.reduce((s, i) => s + (fitJ(data.jevLike[i]!) < T ? 1 : 0), 0);
  const llmRaw = ids.reduce((s, i) => s + (1 - data.llmLogprob[i]!), 0);
  const oracle = ids.reduce((s, i) => s + (1 - data.oracle[i]!), 0);
  const shiftedSum = ids.reduce((s, i) => s + (1 - shiftPrior(data.jevLike[i]!, data.priorShift)), 0);
  errOracle += Math.abs(oracle - truth); errShift += Math.abs(shiftedSum - truth);
  errSum += Math.abs(sumCal - truth); errRaw += Math.abs(sumRaw - truth);
  errCC += Math.abs(cc - truth); errLLMraw += Math.abs(llmRaw - truth);
}
const W = Math.min(100, weeks);
console.log(`true abusive per week ~ ${Math.round(WEEK * (1 - base))}`);
console.log(`sum of the TRUE P(abuse), the floor     mean abs error ${(errOracle / W).toFixed(1)} requests`);
console.log(`sum of Jev-like P(abuse), prior shifted mean abs error ${(errShift / W).toFixed(1)}`);
console.log(`sum of Jev-like P(abuse), Platt on 400  mean abs error ${(errSum / W).toFixed(1)}`);
console.log(`count the ones you denied at 0.20     mean abs error ${(errCC / W).toFixed(1)}`);
console.log(`sum of the LLM's raw cooled P(abuse)  mean abs error ${(errLLMraw / W).toFixed(1)}`);
console.log(`sum of Jev-like raw P(abuse), 50% prior mean abs error ${(errRaw / W).toFixed(1)}`);

// Hand the curve to the figure script.
import { writeFileSync } from 'node:fs';
writeFileSync(new URL('../data/contest-curve.json', import.meta.url), JSON.stringify({ curve, oracle: evaluate(pairsOf(data.oracle, testIdx), COSTS, at(T)).costPerItem, approveAll }));

console.log('\n=== counting with more labels ===');
{
  const fit4k = platt(pairsOf(data.jevLike, fitIdx.slice(0, 4000)));
  let e = 0;
  for (let w = 0; w < W; w++) {
    const ids = testIdx.slice(w * WEEK, (w + 1) * WEEK);
    const truth = ids.reduce((s, i) => s + (1 - data.y[i]!), 0);
    e += Math.abs(ids.reduce((s, i) => s + (1 - fit4k(data.jevLike[i]!)), 0) - truth);
  }
  console.log(`sum of Jev-like P(abuse), Platt on 4000 mean abs error ${(e / W).toFixed(1)}`);
}

console.log('\n=== what resolution buys depends on the prices ===');
console.log('a denied legit request costs $20 throughout; the price of an approved abuse varies');
console.log('abuse costs  threshold   approve-all   oracle    Jev-like   LLM log-probs   LLM verbalized (iso)');
{
  const fits = {
    jev: platt(pairsOf(data.jevLike, fitIdx.slice(0, 4000))),
    lp: platt(pairsOf(data.llmLogprob, fitIdx.slice(0, 4000))),
    vb: isotonic(pairsOf(data.llmVerbal, fitIdx.slice(0, 4000))),
  };
  const cal = {
    jev: testIdx.map((i) => ({ p: fits.jev(data.jevLike[i]!), y: data.y[i]! })),
    lp: testIdx.map((i) => ({ p: fits.lp(data.llmLogprob[i]!), y: data.y[i]! })),
    vb: testIdx.map((i) => ({ p: fits.vb(data.llmVerbal[i]!), y: data.y[i]! })),
    or: pairsOf(data.oracle, testIdx),
  };
  for (const abuse of [5, 20, 50]) {
    const costs = { falsePositive: abuse, falseNegative: 20 };
    const t = threshold(costs);
    const all = testIdx.reduce((s, i) => s + (data.y[i] === 0 ? abuse : 0), 0) / testIdx.length;
    const c = (P: Pair[]) => evaluate(P, costs, at(t)).costPerItem;
    const or = c(cal.or);
    const pct = (x: number) => `${Math.round(((all - x) / (all - or)) * 100)}%`.padStart(4);
    console.log(
      `   $${String(abuse).padEnd(8)} ${t.toFixed(2).padStart(6)}     ${money(all)}    ${money(or)}   ` +
        `${money(c(cal.jev))} ${pct(c(cal.jev))}   ${money(c(cal.lp))} ${pct(c(cal.lp))}   ${money(c(cal.vb))} ${pct(c(cal.vb))}`,
    );
  }
  console.log('(percent = share of the oracle\'s savings over approving everything that each model captures)');
}
