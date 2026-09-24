/**
 * Two charts for the field report, as standalone SVG on a light surface so they
 * paste into GitHub in either theme.
 *
 * Palette: orange #eb6834 (a planted defect) / blue #2a78d6 (clean), validated
 * all-pairs against a white surface — CVD delta-E 24.7, normal-vision 33.6.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { reliabilityTable } from '../src/eval.ts';
import type { Pair } from '../src/calibration.ts';

type Obs = { row: number; probe: string; scope: string; column: string | null; p: number; y: 0 | 1; tier: string };
const obs: Obs[] = JSON.parse(readFileSync(new URL('./pairs.json', import.meta.url), 'utf8'));
const A = obs.filter((o) => o.tier === 'A');

const DEFECT = '#eb6834';
const CLEAN = '#2a78d6';
const INK = '#1c1b19';
const MUTED = '#6b6862';
const GRID = '#e4e2dd';

const css = `
  text { font-family: ui-monospace, "SF Mono", Menlo, monospace; fill: ${MUTED}; }
  .t { font-size: 12px; } .mid { text-anchor: middle; } .end { text-anchor: end; }
  .title { font-size: 14px; fill: ${INK}; font-weight: 600; }
  .sub { font-size: 11.5px; fill: ${MUTED}; }
  .grid { stroke: ${GRID}; stroke-width: 1; }
  .axis { stroke: #b9b5ad; stroke-width: 1.4; }
  .ref { stroke: ${MUTED}; stroke-width: 1.4; stroke-dasharray: 4 4; fill: none; }
`;

const n2 = (v: number) => Math.round(v * 100) / 100;

// --- chart 1: reliability diagram -------------------------------------------

function reliability(): string {
  const W = 680, H = 456, M = { t: 84, r: 30, b: 58, l: 70 };
  const PW = W - M.l - M.r, PH = H - M.t - M.b;
  const sx = (v: number) => M.l + v * PW;
  const sy = (v: number) => M.t + (1 - v) * PH;
  const ticks = [0, 0.25, 0.5, 0.75, 1];

  const table = reliabilityTable(A.map(({ p, y }): Pair => ({ p, y })));
  const pts = table.filter((b) => b.count > 0);

  const marks = pts
    .map((b) => {
      const r = 3 + Math.sqrt(b.count) * 0.55;
      return (
        `<line x1="${n2(sx(b.meanP))}" y1="${n2(sy(b.interval.lo))}" x2="${n2(sx(b.meanP))}" y2="${n2(sy(b.interval.hi))}" stroke="${DEFECT}" stroke-width="1.6" opacity="0.5" />` +
        `<circle cx="${n2(sx(b.meanP))}" cy="${n2(sy(b.meanY))}" r="${n2(r)}" fill="${DEFECT}" stroke="#fff" stroke-width="1.8">` +
        `<title>claimed ${b.meanP.toFixed(2)} · happened ${b.meanY.toFixed(2)} · n=${b.count}</title></circle>`
      );
    })
    .join('');

  const labels = pts
    .filter((b) => b.count >= 20)
    .map((b) => {
      // Flip the count below the dot near the top of the plot, where a label
      // above it would land in the subtitle.
      const dy = b.meanY > 0.8 ? 22 : -15;
      return `<text x="${n2(sx(b.meanP))}" y="${n2(sy(b.meanY)) + dy}" class="t mid" fill="${INK}">n=${b.count}</text>`;
    })
    .join('');

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}">
  <style>${css}</style>
  <rect width="${W}" height="${H}" fill="#fff" />
  <text x="${M.l}" y="26" class="title">Jev on a data-quality task: what it claimed vs what happened</text>
  <text x="${M.l}" y="44" class="sub">580 labelled judgments, 28 real defects. Bars are 95% intervals; dot area is bin size.</text>
  ${ticks.map((t) => `<line x1="${n2(sx(t))}" y1="${M.t}" x2="${n2(sx(t))}" y2="${M.t + PH}" class="grid" /><line x1="${M.l}" y1="${n2(sy(t))}" x2="${M.l + PW}" y2="${n2(sy(t))}" class="grid" />`).join('')}
  <path class="ref" d="M${n2(sx(0))} ${n2(sy(0))} L${n2(sx(1))} ${n2(sy(1))}" />
  <text x="${n2(sx(0.60))}" y="${n2(sy(0.66))}" class="t" fill="${MUTED}">honest would be this line</text>
  <line x1="${M.l}" y1="${M.t + PH}" x2="${M.l + PW}" y2="${M.t + PH}" class="axis" />
  <line x1="${M.l}" y1="${M.t}" x2="${M.l}" y2="${M.t + PH}" class="axis" />
  ${ticks.map((t) => `<text x="${n2(sx(t))}" y="${M.t + PH + 20}" class="t mid">${t}</text><text x="${M.l - 10}" y="${n2(sy(t)) + 4}" class="t end">${t}</text>`).join('')}
  <text x="${n2(M.l + PW / 2)}" y="${H - 14}" class="t mid">probability Jev reported</text>
  <text x="16" y="${n2(M.t + PH / 2)}" class="t mid" transform="rotate(-90 16 ${n2(M.t + PH / 2)})">fraction that were real defects</text>
  ${marks}${labels}
</svg>`;
}

// --- chart 2: per-probe separation ------------------------------------------

function separation(): string {
  const probes = [...new Set(A.map((o) => o.probe))].sort((a, b) => {
    const gap = (p: string) => {
      const s = A.filter((o) => o.probe === p);
      const pos = s.filter((o) => o.y === 1).map((o) => o.p);
      const neg = s.filter((o) => o.y === 0).map((o) => o.p);
      return (pos.length ? Math.min(...pos) : 0) - (neg.length ? Math.max(...neg) : 0);
    };
    return gap(b) - gap(a);
  });

  const rowH = 34;
  const W = 720, M = { t: 92, r: 24, b: 56, l: 250 };
  const PH = probes.length * rowH;
  const H = M.t + PH + M.b;
  const PW = W - M.l - M.r;
  const sx = (v: number) => M.l + v * PW;

  const rows = probes
    .map((probe, i) => {
      const y = M.t + i * rowH + rowH / 2;
      const s = A.filter((o) => o.probe === probe);
      const dots = s
        .map((o) => {
          const jitter = ((o.row * 37) % 9) - 4;
          return `<circle cx="${n2(sx(o.p))}" cy="${n2(y + jitter * 0.9)}" r="${o.y === 1 ? 5 : 3.4}" fill="${o.y === 1 ? DEFECT : CLEAN}" fill-opacity="${o.y === 1 ? 0.95 : 0.4}" stroke="#fff" stroke-width="1"><title>${probe} row ${o.row}${o.column ? ' · ' + o.column : ''} · p=${o.p.toFixed(2)} · ${o.y === 1 ? 'planted defect' : 'clean'}</title></circle>`;
        })
        .join('');
      const pos = s.filter((o) => o.y === 1).map((o) => o.p);
      const neg = s.filter((o) => o.y === 0).map((o) => o.p);
      const inverted = pos.length > 0 && neg.length > 0 && Math.min(...pos) < Math.max(...neg);
      return (
        `<line x1="${M.l}" y1="${n2(y)}" x2="${M.l + PW}" y2="${n2(y)}" class="grid" />` +
        `<text x="${M.l - 12}" y="${n2(y) + 4}" class="t end" fill="${inverted ? DEFECT : INK}">${probe}</text>` +
        dots
      );
    })
    .join('');

  const ticks = [0, 0.25, 0.5, 0.7, 0.9, 1];
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}">
  <style>${css}</style>
  <rect width="${W}" height="${H}" fill="#fff" />
  <text x="24" y="26" class="title">Does each probe separate the planted defects from everything else?</text>
  <text x="24" y="44" class="sub">One dot per judgment. Orange = a defect messy.sql planted. Blue = clean.</text>
  ${ticks.map((t) => `<line x1="${n2(sx(t))}" y1="${M.t}" x2="${n2(sx(t))}" y2="${M.t + PH}" class="grid" />`).join('')}
  <line x1="${n2(sx(0.9))}" y1="${M.t - 6}" x2="${n2(sx(0.9))}" y2="${M.t + PH}" stroke="${INK}" stroke-width="1.4" stroke-dasharray="4 3" />
  <text x="${n2(sx(0.9))}" y="${M.t - 12}" class="t mid" fill="${INK}">0.90</text>
  <line x1="${n2(sx(0.7))}" y1="${M.t - 6}" x2="${n2(sx(0.7))}" y2="${M.t + PH}" stroke="${MUTED}" stroke-width="1.2" stroke-dasharray="2 3" />
  <text x="${n2(sx(0.7))}" y="${M.t - 12}" class="t mid">0.70 default</text>
  ${rows}
  ${ticks.map((t) => `<text x="${n2(sx(t))}" y="${M.t + PH + 22}" class="t mid">${t}</text>`).join('')}
  <text x="${n2(M.l + PW / 2)}" y="${H - 14}" class="t mid">probability Jev reported</text>
</svg>`;
}

writeFileSync(new URL('./reliability.svg', import.meta.url), reliability());
writeFileSync(new URL('./separation.svg', import.meta.url), separation());
console.log('wrote reliability.svg and separation.svg');
