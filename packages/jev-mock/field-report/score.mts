import { readFileSync } from 'node:fs';
import {
  brier, ece, murphy, logLoss, reliabilityTable, evaluate, threshold, sweep, platt,
  applyRecalibration, type Pair,
} from '../src/index.ts';

type Obs = { row: number; probe: string; scope: string; column: string | null; p: number; y: 0 | 1; tier: string };
const obs: Obs[] = JSON.parse(readFileSync(new URL('./pairs.json', import.meta.url), 'utf8'));
const pairs = (o: Obs[]): Pair[] => o.map(({ p, y }) => ({ p, y }));

const f = (x: number, d = 4) => (Number.isFinite(x) ? x.toFixed(d) : '—').padStart(d + 3);

function line(label: string, o: Obs[]) {
  if (o.length === 0) return;
  const P = pairs(o);
  const m = murphy(P);
  console.log(
    `${label.padEnd(34)} n=${String(o.length).padStart(4)}  pos=${String(o.reduce((s, x) => s + x.y, 0)).padStart(3)}` +
    `  ECE ${f(ece(P))}  rel ${f(m.reliability, 5)}  res ${f(m.resolution)}  Brier ${f(brier(P))}  logloss ${f(logLoss(P))}`,
  );
}

console.log('\n=== Jev on a real data-quality task: 620 labelled judgments ===\n');
line('all', obs);
line('tier A (trustworthy labels)', obs.filter((o) => o.tier === 'A'));
line('  row scope', obs.filter((o) => o.tier === 'A' && o.scope === 'row'));
line('  value scope', obs.filter((o) => o.tier === 'A' && o.scope === 'value'));
line('tier B (unsafe negatives)', obs.filter((o) => o.tier === 'B'));

console.log('\n--- per probe (tier A) ---');
const byProbe = new Map<string, Obs[]>();
for (const o of obs.filter((x) => x.tier === 'A')) {
  if (!byProbe.has(o.probe)) byProbe.set(o.probe, []);
  byProbe.get(o.probe)!.push(o);
}
for (const [probe, o] of [...byProbe].sort((a, b) => b[1].length - a[1].length)) line('  ' + probe, o);

const A = pairs(obs.filter((o) => o.tier === 'A'));

console.log('\n--- the reliability diagram ---');
console.log('claimed      observed          95% interval      n   flagged?');
for (const b of reliabilityTable(A)) {
  if (b.count === 0) continue;
  console.log(
    `${b.lo.toFixed(1)}-${b.hi.toFixed(1)}   ${f(b.meanY)}   [${b.interval.lo.toFixed(3)}, ${b.interval.hi.toFixed(3)}]  ${String(b.count).padStart(4)}   ${b.offDiagonal ? 'OFF DIAGONAL' : ''}`,
  );
}

console.log('\n--- what the 0.7 default buys, and what it costs ---');
const base = A.reduce((s, p) => s + p.y, 0) / A.length;
console.log('base rate of real defects:', f(base));
for (const t of [0.5, 0.7, 0.9]) {
  const tp = A.filter((p) => p.p >= t && p.y === 1).length;
  const fp = A.filter((p) => p.p >= t && p.y === 0).length;
  const fn = A.filter((p) => p.p < t && p.y === 1).length;
  console.log(
    `threshold ${t.toFixed(2)}   flagged ${String(tp + fp).padStart(3)}   caught ${tp}/${tp + fn}` +
    `   precision ${f(tp / (tp + fp))}   recall ${f(tp / (tp + fn))}`,
  );
}

console.log('\n--- cost-optimal threshold for a profiler ---');
for (const [label, costs] of [
  ['dismiss a flag in 10s vs miss a defect worth 1h  (1:360)', { falsePositive: 1, falseNegative: 360 }],
  ['a gentler 1:20', { falsePositive: 1, falseNegative: 20 }],
  ['symmetric 1:1', { falsePositive: 1, falseNegative: 1 }],
] as const) {
  const t = threshold(costs);
  const at = evaluate(A, costs, { lo: t, hi: t, degenerate: true });
  const best = sweep(A, costs);
  const at07 = evaluate(A, costs, { lo: 0.7, hi: 0.7, degenerate: true });
  console.log(
    `${label.padEnd(56)} t*=${t.toFixed(3)}  cost ${f(at.costPerItem)}   best-possible ${f(best.costPerItem)} @ ${best.threshold.toFixed(2)}   at 0.70: ${f(at07.costPerItem)}`,
  );
}

console.log('\n--- does recalibrating help? (fit on half, score on the other) ---');
const shuffled = [...A];
const cut = Math.floor(shuffled.length / 2);
const fit = shuffled.filter((_, i) => i % 2 === 0);
const test = shuffled.filter((_, i) => i % 2 === 1);
console.log('held-out ECE, raw       ', f(ece(test)), ' reliability', f(murphy(test).reliability, 5));
const fixed = applyRecalibration(test, platt(fit));
console.log('held-out ECE, Platt     ', f(ece(fixed)), ' reliability', f(murphy(fixed).reliability, 5));

console.log('\n--- test-retest: the same question asked twice ---');
const rt: [number, number][] = JSON.parse(readFileSync(new URL('./retest.json', import.meta.url), 'utf8'));
const diffs = rt.map(([a, b]) => Math.abs(a - b));
const mean = diffs.reduce((s, d) => s + d, 0) / diffs.length;
const sorted = [...diffs].sort((a, b) => a - b);
const flips = (t: number) => rt.filter(([a, b]) => (a >= t) !== (b >= t)).length;
console.log('pairs', rt.length);
console.log('mean |p1 - p2|     ', f(mean));
console.log('median             ', f(sorted[Math.floor(sorted.length / 2)]!));
console.log('90th percentile    ', f(sorted[Math.floor(sorted.length * 0.9)]!));
console.log('identical to 1e-9  ', f(diffs.filter((d) => d < 1e-9).length / diffs.length));
console.log('verdict flips at 0.7', flips(0.7), `(${f((flips(0.7) / rt.length) * 100, 2)}%)`);
console.log('verdict flips at 0.5', flips(0.5), `(${f((flips(0.5) / rt.length) * 100, 2)}%)`);
