import { useState } from 'react';
import {
  CANDIDATES,
  STATEMENTS,
  HINGE,
  correctness,
  score,
  type Candidate,
} from './data';

// A driveable re-skin of gepa-viz. The point is not to show you a run — it is
// to hand you the run and let you carve. Click a candidate to read its prompt,
// its reflection, and its Pareto grid; hover any ring segment or grid tile to
// read the statement it stands for, with its true label and this candidate's
// guess. Then light the cut it can never see across.

const C = {
  bg: '#1a1207',
  card: '#231a0c',
  cardLo: '#1f1608',
  border: '#3d2e1a',
  gold: '#e8a838',
  goldDim: '#b87a1e',
  green: '#86b34a',
  red: '#c75c4e',
  brown: '#7a5a30',
  text: '#f0e6d2',
  dim: '#9e8e72',
  muted: '#6b5d48',
  mono: "'JetBrains Mono', ui-monospace, 'SF Mono', monospace",
};

const N = STATEMENTS.length;
const STEP = 360 / N;
const PAD = 1.4;

function polar(cx: number, cy: number, r: number, deg: number): [number, number] {
  const a = ((deg - 90) * Math.PI) / 180;
  return [cx + r * Math.cos(a), cy + r * Math.sin(a)];
}

function segPath(cx: number, cy: number, rO: number, rI: number, d0: number, d1: number) {
  const [ox0, oy0] = polar(cx, cy, rO, d0);
  const [ox1, oy1] = polar(cx, cy, rO, d1);
  const [ix1, iy1] = polar(cx, cy, rI, d1);
  const [ix0, iy0] = polar(cx, cy, rI, d0);
  const large = d1 - d0 > 180 ? 1 : 0;
  return `M${ox0},${oy0} A${rO},${rO} 0 ${large} 1 ${ox1},${oy1} L${ix1},${iy1} A${rI},${rI} 0 ${large} 0 ${ix0},${iy0} Z`;
}

function radii(c: Candidate) {
  if (c.id === 'root') return { rO: 9, rI: 5.2 };
  if (c.kind === 'rejected') return { rO: 4.6, rI: 2.6 };
  return { rO: 8.2, rI: 4.8 };
}

const SHORT: Record<string, string> = { root: 'seed' };
function shortName(c: Candidate) {
  if (SHORT[c.id]) return SHORT[c.id];
  if (c.kind === 'rejected') return '✗';
  return c.id;
}

const isHinge = (i: number) => i === HINGE[0] || i === HINGE[1];

export default function GepaViz() {
  const [selectedId, setSelectedId] = useState('c4');
  const [hoverEx, setHoverEx] = useState<number | null>(null);
  const [litHinge, setLitHinge] = useState(false);

  const byId = (id: string) => CANDIDATES.find((c) => c.id === id)!;
  const selected = byId(selectedId);
  const corr = correctness(selected);
  const sc = score(selected);

  return (
    <div className="gv-root">
      <style>{CSS}</style>

      <div className="gv-bar">
        <span className="gv-title">gepa-viz · the séance</span>
        <button
          className={litHinge ? 'gv-toggle gv-toggle-on' : 'gv-toggle'}
          onClick={() => setLitHinge((v) => !v)}
        >
          {litHinge ? '◆ the unevidenceable cut is lit' : '◇ light the unevidenceable cut'}
        </button>
      </div>

      <div className="gv-2col">
        {/* ── the lineage ─────────────────────────────── */}
        <div className="gv-tree-wrap">
          <svg viewBox="0 0 100 100" className="gv-tree" role="img" aria-label="GEPA candidate tree">
            {/* edges */}
            {CANDIDATES.filter((c) => c.parent).map((c) => {
              const p = byId(c.parent!);
              const rejected = c.kind === 'rejected';
              return (
                <line
                  key={`e-${c.id}`}
                  x1={p.x}
                  y1={p.y}
                  x2={c.x}
                  y2={c.y}
                  stroke={rejected ? C.brown : C.goldDim}
                  strokeWidth={rejected ? 0.4 : 0.55}
                  strokeDasharray={rejected ? '1.4 1.4' : undefined}
                  opacity={rejected ? 0.7 : 0.9}
                />
              );
            })}

            {/* nodes */}
            {CANDIDATES.map((c) => {
              const { rO, rI } = radii(c);
              const cc = correctness(c);
              const sel = c.id === selectedId;
              const rej = c.kind === 'rejected';
              return (
                <g
                  key={c.id}
                  className="gv-node"
                  onClick={() => setSelectedId(c.id)}
                  role="button"
                  aria-label={`${c.label}, ${score(c).right} of ${N}`}
                >
                  {sel && (
                    <circle cx={c.x} cy={c.y} r={rO + 1.7} fill="none" stroke={C.gold} strokeWidth={0.7} />
                  )}
                  <circle cx={c.x} cy={c.y} r={rI} fill={rej ? '#241a0f' : C.cardLo} />
                  {STATEMENTS.map((_, i) => {
                    const d0 = i * STEP + PAD / 2;
                    const d1 = (i + 1) * STEP - PAD / 2;
                    const lit = hoverEx === i;
                    const dimmed = hoverEx !== null && hoverEx !== i;
                    return (
                      <path
                        key={i}
                        d={segPath(c.x, c.y, rO, rI, d0, d1)}
                        fill={cc[i] ? C.green : C.red}
                        opacity={rej ? (dimmed ? 0.25 : 0.7) : dimmed ? 0.3 : 0.95}
                        stroke={lit ? C.text : litHinge && isHinge(i) ? C.gold : 'none'}
                        strokeWidth={lit ? 0.7 : litHinge && isHinge(i) ? 0.6 : 0}
                        className={litHinge && isHinge(i) ? 'gv-pulse' : undefined}
                        onMouseEnter={() => setHoverEx(i)}
                        onMouseLeave={() => setHoverEx(null)}
                      />
                    );
                  })}
                  {/* hit target */}
                  <circle cx={c.x} cy={c.y} r={rO} fill="transparent" />
                  <text x={c.x} y={c.y + rO + 3.4} className="gv-node-tag" textAnchor="middle">
                    {shortName(c)}
                  </text>
                  {!rej && (
                    <text x={c.x} y={c.y + rO + 6.2} className="gv-node-score" textAnchor="middle">
                      {score(c).right}/{N}
                    </text>
                  )}
                </g>
              );
            })}
          </svg>

          <div className="gv-legend">
            <span><i className="gv-sw" style={{ background: C.green }} /> correct</span>
            <span><i className="gv-sw" style={{ background: C.red }} /> wrong</span>
            <span><i className="gv-line gv-gold" /> accepted lineage</span>
            <span><i className="gv-line gv-dash" /> rejected proposal</span>
          </div>
          <p className="gv-hint-tree">
            Click c1 → c4 → c5 and watch the red tiles move. One of the pair {hingeTag()} never
            greens, in any candidate, ever. That is the cut. Light it.
          </p>
        </div>

        {/* ── the dossier ─────────────────────────────── */}
        <div className="gv-panel">
          <div className="gv-panel-head">
            <span className={`gv-kind gv-kind-${selected.kind}`}>{selected.kind}</span>
            <span className="gv-panel-title">{selected.label}</span>
            <span className="gv-panel-score">
              {sc.right}/{sc.total} · {sc.pct.toFixed(1)}%
            </span>
          </div>

          <div className="gv-prompt">
            {selected.prompt.map((ln, i) => (
              <div key={i} className={`gv-pl gv-pl-${ln.status}`}>
                <span className="gv-gutter">
                  {ln.status === 'add' ? '+' : ln.status === 'remove' ? '−' : ln.status === 'change' ? '~' : ' '}
                </span>
                {ln.text}
              </div>
            ))}
          </div>

          <div className="gv-feedback">
            <span className="gv-fb-label">reflection / ASI</span>
            {selected.feedback}
          </div>

          <div className="gv-grid-label">Pareto grid — every example, this candidate</div>
          <div className="gv-grid">
            {STATEMENTS.map((_, i) => {
              const ok = corr[i];
              const hl = hoverEx === i;
              const hinge = isHinge(i);
              return (
                <button
                  key={i}
                  className={[
                    'gv-cell',
                    ok ? 'gv-ok' : 'gv-no',
                    hl ? 'gv-cell-hl' : '',
                    litHinge && hinge ? 'gv-cell-hinge gv-pulse' : '',
                  ].join(' ')}
                  onMouseEnter={() => setHoverEx(i)}
                  onMouseLeave={() => setHoverEx(null)}
                  onFocus={() => setHoverEx(i)}
                  aria-label={`statement ${i + 1}`}
                >
                  {i + 1}
                  {hinge && <em className="gv-diamond" aria-hidden="true">◆</em>}
                </button>
              );
            })}
          </div>

          <div className="gv-readout">
            {hoverEx === null ? (
              <span className="gv-readout-hint">
                Hover a ring segment or a tile to turn the statement over — text, true label, this
                candidate's guess. You are the one carving now.
              </span>
            ) : (
              <Readout idx={hoverEx} selected={selected} />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function hingeTag() {
  return `#${HINGE[0] + 1}/#${HINGE[1] + 1}`;
}

function Readout({ idx, selected }: { idx: number; selected: Candidate }) {
  const s = STATEMENTS[idx];
  const pred = selected.pred[idx];
  const ok = pred === s.truth;
  const lname = (l: string) => (l === 'R' ? 'relational' : 'reifying');
  return (
    <div className="gv-ro">
      <div className="gv-ro-top">
        <span className="gv-ro-n">statement {idx + 1} of {N}</span>
        {isHinge(idx) && <span className="gv-ro-hinge">◆ the hinge</span>}
        {s.marks.map((m) => (
          <span key={m} className="gv-ro-mark">{m}</span>
        ))}
      </div>
      <div className="gv-ro-text">“{s.text}”</div>
      <div className="gv-ro-labels">
        <span>truth: <b className={s.truth === 'R' ? 'gv-lab-r' : 'gv-lab-f'}>{lname(s.truth)}</b></span>
        <span>guess: <b className={pred === 'R' ? 'gv-lab-r' : 'gv-lab-f'}>{lname(pred)}</b></span>
        <span className={ok ? 'gv-verdict-ok' : 'gv-verdict-no'}>{ok ? '✓ correct' : '✗ wrong'}</span>
      </div>
    </div>
  );
}

const CSS = `
.gv-root {
  width: min(1040px, 92vw);
  margin: 2.6em 0;
  margin-left: 50%;
  transform: translateX(-50%);
  font-family: ${C.mono};
  color: ${C.text};
  background: ${C.bg};
  border: 1px solid ${C.border};
  border-radius: 8px;
  padding: 0.9rem 1rem 1.1rem;
  box-sizing: border-box;
}
.gv-root * { box-sizing: border-box; }
.gv-bar {
  display: flex; align-items: center; justify-content: space-between;
  gap: 0.8rem; flex-wrap: wrap; margin-bottom: 0.7rem;
}
.gv-title { font-size: 0.72rem; letter-spacing: 0.08em; color: ${C.dim}; text-transform: uppercase; }
.gv-toggle {
  font-family: ${C.mono}; font-size: 0.72rem; cursor: pointer;
  background: ${C.cardLo}; color: ${C.dim};
  border: 1px solid ${C.border}; border-radius: 5px; padding: 0.35rem 0.7rem;
  transition: all 0.15s ease;
}
.gv-toggle:hover { color: ${C.text}; border-color: ${C.goldDim}; }
.gv-toggle-on { color: ${C.bg}; background: ${C.gold}; border-color: ${C.gold}; }
.gv-2col { display: grid; grid-template-columns: 1fr; gap: 1rem; }
@media (min-width: 860px) { .gv-2col { grid-template-columns: 1.05fr 1fr; } }

.gv-tree-wrap { display: flex; flex-direction: column; }
.gv-tree { width: 100%; height: auto; display: block; touch-action: manipulation; }
.gv-node { cursor: pointer; }
.gv-node-tag { fill: ${C.dim}; font-family: ${C.mono}; font-size: 2.6px; }
.gv-node-score { fill: ${C.muted}; font-family: ${C.mono}; font-size: 2.4px; }
.gv-pulse { animation: gvpulse 1.5s ease-in-out infinite; }
@keyframes gvpulse { 0%,100% { stroke-opacity: 1; } 50% { stroke-opacity: 0.3; } }

.gv-legend {
  display: flex; flex-wrap: wrap; gap: 0.9rem; margin-top: 0.4rem;
  font-size: 0.66rem; color: ${C.dim};
}
.gv-legend span { display: inline-flex; align-items: center; gap: 0.35rem; }
.gv-sw { width: 9px; height: 9px; border-radius: 2px; display: inline-block; }
.gv-line { width: 16px; height: 0; display: inline-block; }
.gv-gold { border-top: 2px solid ${C.goldDim}; }
.gv-dash { border-top: 2px dashed ${C.brown}; }
.gv-hint-tree { font-size: 0.7rem; line-height: 1.5; color: ${C.muted}; margin: 0.7rem 0 0; }

.gv-panel {
  background: ${C.card}; border: 1px solid ${C.border}; border-radius: 6px;
  padding: 0.85rem 0.9rem; display: flex; flex-direction: column; gap: 0.7rem;
}
.gv-panel-head { display: flex; align-items: baseline; gap: 0.55rem; flex-wrap: wrap; }
.gv-kind {
  font-size: 0.6rem; text-transform: uppercase; letter-spacing: 0.07em;
  padding: 0.12rem 0.4rem; border-radius: 3px; border: 1px solid ${C.border};
}
.gv-kind-seed { color: ${C.dim}; }
.gv-kind-accepted { color: ${C.green}; border-color: ${C.green}; }
.gv-kind-rejected { color: ${C.red}; border-color: ${C.red}; }
.gv-panel-title { font-size: 0.92rem; color: ${C.text}; }
.gv-panel-score { margin-left: auto; font-size: 0.8rem; color: ${C.gold}; }

.gv-prompt {
  background: ${C.cardLo}; border: 1px solid ${C.border}; border-radius: 5px;
  padding: 0.6rem 0.7rem; font-size: 0.72rem; line-height: 1.55; overflow-x: auto;
}
.gv-pl { white-space: pre; color: ${C.dim}; }
.gv-gutter { display: inline-block; width: 1.1ch; color: ${C.muted}; }
.gv-pl-add { color: ${C.gold}; }
.gv-pl-add .gv-gutter { color: ${C.gold}; }
.gv-pl-change { color: ${C.gold}; }
.gv-pl-change .gv-gutter { color: ${C.gold}; }
.gv-pl-remove { color: ${C.muted}; text-decoration: line-through; }

.gv-feedback {
  font-size: 0.74rem; line-height: 1.55; color: ${C.text};
  border-left: 2px solid ${C.goldDim}; padding: 0.1rem 0 0.1rem 0.7rem;
}
.gv-fb-label {
  display: block; font-size: 0.58rem; text-transform: uppercase; letter-spacing: 0.08em;
  color: ${C.muted}; margin-bottom: 0.25rem;
}

.gv-grid-label { font-size: 0.62rem; text-transform: uppercase; letter-spacing: 0.07em; color: ${C.muted}; }
.gv-grid { display: grid; grid-template-columns: repeat(7, 1fr); gap: 4px; }
.gv-cell {
  position: relative; aspect-ratio: 1; border-radius: 4px; cursor: pointer;
  font-family: ${C.mono}; font-size: 0.66rem; color: rgba(0,0,0,0.55);
  border: 1px solid transparent; transition: transform 0.1s ease;
}
.gv-cell:hover { transform: scale(1.08); }
.gv-ok { background: ${C.green}; }
.gv-no { background: ${C.red}; }
.gv-cell-hl { border-color: ${C.text}; }
.gv-cell-hinge { border-color: ${C.gold}; box-shadow: 0 0 0 1px ${C.gold}; }
.gv-diamond {
  position: absolute; top: 1px; right: 2px; font-size: 0.5rem; font-style: normal;
  color: rgba(0,0,0,0.5);
}

.gv-readout { min-height: 4.6rem; }
.gv-readout-hint { font-size: 0.74rem; line-height: 1.5; color: ${C.muted}; font-style: italic; }
.gv-ro { display: flex; flex-direction: column; gap: 0.4rem; }
.gv-ro-top { display: flex; flex-wrap: wrap; align-items: center; gap: 0.4rem; }
.gv-ro-n { font-size: 0.6rem; text-transform: uppercase; letter-spacing: 0.07em; color: ${C.muted}; }
.gv-ro-hinge { font-size: 0.62rem; color: ${C.gold}; }
.gv-ro-mark {
  font-size: 0.6rem; color: ${C.dim}; background: ${C.cardLo};
  border: 1px solid ${C.border}; border-radius: 3px; padding: 0.05rem 0.35rem;
}
.gv-ro-text { font-size: 0.92rem; line-height: 1.4; color: ${C.text}; }
.gv-ro-labels { display: flex; flex-wrap: wrap; gap: 0.9rem; font-size: 0.74rem; color: ${C.dim}; }
.gv-lab-r { color: ${C.green}; }
.gv-lab-f { color: ${C.gold}; }
.gv-verdict-ok { color: ${C.green}; }
.gv-verdict-no { color: ${C.red}; }
`;
