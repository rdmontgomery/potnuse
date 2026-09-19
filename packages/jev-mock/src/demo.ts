/**
 * Every number quoted in the accompanying write-up, regenerated.
 *
 *   pnpm --filter @rdm/jev-mock demo
 */

import {
  abstainBand,
  applyRecalibration,
  gate,
  isotonic,
  platt,
  power,
  reliabilityTable,
  split,
  brier,
  calibratedJev,
  type Costs,
  diagram,
  ece,
  evaluate,
  logLoss,
  murphy,
  type Pair,
  rng,
  shapeOnlyJev,
  sweep,
  threshold,
} from './index.ts';

const question = {
  urgent: { type: 'boolean', instructions: 'Does this convey urgency?' },
} as const;

async function streamOf(temperature: number, n: number, seed = 42): Promise<Pair[]> {
  const mock = calibratedJev({ seed, temperature });
  for (let i = 0; i < n; i++) await mock.decide(`ticket ${i}`, question);
  return mock.log.map((o) => o.pair);
}

const f = (x: number, d = 4) => x.toFixed(d).padStart(d + 3);

console.log('\n--- one call, three question types --------------------------------');
const { answers, usage } = await calibratedJev({ seed: 3 }).decide(
  'Help! My payouts have been failing for 3 days.',
  {
    urgent: { type: 'boolean', instructions: 'Does this convey urgency?' },
    team: {
      type: 'choice',
      instructions: 'Which team should handle this?',
      criteria: {
        billing: 'Payments, invoicing, refunds',
        technical: 'Bugs, outages, integrations',
        sales: null,
      },
    },
    anger: {
      type: 'score',
      instructions: 'How frustrated is the customer?',
      criteria: ['Calm', 'Frustrated', 'Very angry'],
    },
  },
);
console.log(JSON.stringify(answers, null, 2));
console.log('usage', usage);

console.log('\n--- the distortion knob (n = 20000) ------------------------------');
console.log('T        ECE     reliability  resolution   Brier   log loss');
for (const [label, t] of [
  ['1.0  ', 1],
  ['0.5  ', 0.5],
  ['2.5  ', 2.5],
] as const) {
  const p = await streamOf(t, 20000);
  const m = murphy(p);
  console.log(
    `${label} ${f(ece(p))}  ${f(m.reliability, 5)}     ${f(m.resolution)}  ${f(brier(p))}  ${f(logLoss(p))}`,
  );
}

console.log('\n--- how much data it takes to see 15% overconfidence -------------');
console.log('n        ECE(honest)  ECE(T=0.5)');
for (const n of [500, 2000, 8000, 20000]) {
  console.log(
    `${String(n).padStart(6)}   ${f(ece(await streamOf(1, n)))}      ${f(ece(await streamOf(0.5, n)))}`,
  );
}

console.log('\n--- reliability diagram, honest vs overconfident (n = 20000) -----');
console.log('honest:');
console.log(diagram(await streamOf(1, 20000)));
console.log('T = 0.5:');
console.log(diagram(await streamOf(0.5, 20000)));

console.log('\n--- threshold from costs vs threshold from a grid search ---------');
const costs: Costs = { falsePositive: 1, falseNegative: 4 };
const honest = await streamOf(1, 20000);
const flat = { lo: 0.5, hi: 0.5, degenerate: true as const };
const derived = { lo: threshold(costs), hi: threshold(costs), degenerate: true as const };
console.log('closed form       t =', threshold(costs).toFixed(2), 'cost/item', f(evaluate(honest, costs, derived).costPerItem));
console.log('grid search       t =', sweep(honest, costs).threshold.toFixed(2), 'cost/item', f(sweep(honest, costs).costPerItem));
console.log('the reflexive 0.5 t = 0.50 cost/item', f(evaluate(honest, costs, flat).costPerItem));

console.log('\n--- the same abstain band, honest model vs hot model -------------');
const opCosts: Costs = { falsePositive: 5, falseNegative: 20, escalation: 1 };
const band = abstainBand(opCosts);
console.log('band', band);
for (const [label, t] of [
  ['honest', 1],
  ['T=0.5 ', 0.5],
] as const) {
  const out = evaluate(await streamOf(t, 20000), opCosts, band);
  console.log(
    `${label}  escalated ${(out.escalationRate * 100).toFixed(1)}%  FP ${out.falsePositives}  FN ${out.falseNegatives}  cost/item ${f(out.costPerItem)}`,
  );
}

console.log('\n--- recalibrating a hot vendor in your own layer -----------------');
const spoiled = await streamOf(0.5, 20000);
const held = spoiled.slice(10000, 12000);
console.log('untouched held-out ECE', f(ece(held)));
console.log('labels   iso in-sample   iso held-out   Platt held-out');
for (const nFit of [100, 400, 1000, 4000, 10000]) {
  const fit = spoiled.slice(0, nFit);
  console.log(
    `${String(nFit).padStart(6)}   ${f(ece(applyRecalibration(fit, isotonic(fit))))}        ${f(ece(applyRecalibration(held, isotonic(fit))))}       ${f(ece(applyRecalibration(held, platt(fit))))}`,
  );
}
const { fit: fitHalf, test: testHalf } = split(spoiled);
const fixed = applyRecalibration(testHalf, platt(fitHalf));
console.log('resolution before', f(murphy(testHalf).resolution), 'after', f(murphy(fixed).resolution));

console.log('\n--- bins that are off the diagonal by more than noise ------------');
for (const [label, t] of [['honest', 1], ['T=0.5 ', 0.5]] as const) {
  const table = reliabilityTable(await streamOf(t, 8000));
  console.log(`${label}  ${table.filter((b) => b.offDiagonal).length} of 10 bins flagged`);
}

console.log('\n--- how many labels to catch 15% overconfidence ------------------');
console.log('n       false alarms   detection');
for (const n of [250, 1000, 4000]) {
  const r = await power(
    (k, seed) => streamOf(1, k, seed),
    (k, seed) => streamOf(0.5, k, seed),
    n,
    30,
  );
  console.log(
    `${String(n).padStart(5)}   ${(r.falsePositiveRate * 100).toFixed(0).padStart(6)}%       ${(r.detectionRate * 100).toFixed(0).padStart(5)}%`,
  );
}

console.log('\n--- the release gate --------------------------------------------');
const g = { maxReliability: 0.002, minResolution: 0.08, minSamples: 2000 };
for (const [label, pairs] of [
  ['honest        ', await streamOf(1, 8000)],
  ['overconfident ', await streamOf(0.5, 8000)],
  ['thin sample   ', await streamOf(1, 500)],
  ['always 0.5    ', Array.from({ length: 4000 }, (_, i) => ({ p: 0.5, y: (i % 2) as 0 | 1 }))],
] as const) {
  const r = gate(pairs, g);
  console.log(`${label} ${r.pass ? 'PASS' : 'FAIL'}  ${r.reasons.join('; ')}`);
}

console.log('\n--- and the shape-only mock, for contrast ------------------------');
const shape = shapeOnlyJev({ seed: 11 });
const coin = rng(99);
const shapePairs: Pair[] = [];
for (let i = 0; i < 20000; i++) {
  const { answers: a } = await shape.decide(`ticket ${i}`, question);
  // Nothing ties the forecast to the outcome, so the outcome is a coin flip.
  shapePairs.push({ p: a.urgent.probability, y: coin() < 0.5 ? 1 : 0 });
}
const sm = murphy(shapePairs);
console.log(
  `ECE ${f(ece(shapePairs))}  reliability ${f(sm.reliability, 5)}  resolution ${f(sm.resolution)}  Brier ${f(brier(shapePairs))}`,
);
console.log('Valid JSON. Zero information. Green CI.\n');
