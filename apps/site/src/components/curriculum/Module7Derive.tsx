import { useState } from 'react';
import {
  apply,
  sharedPcs,
  triadName,
  triadPcs,
  type PLR,
  type Triad,
  type TriadQuality,
} from '@/lib/music/neoRiemannian';
import { PITCH_NAMES, type PitchClass } from '@/lib/music/pitchClass';
import Z12Clock from './Z12Clock';

// Derive for Module 7. Pick a starting triad, pick a transformation,
// see the result. The two clocks live side by side; the polygon
// connects the chord triangle and the shared-pcs are highlighted in
// the right clock so the voice that moves is visible by elimination.

const OPS: readonly PLR[] = ['P', 'L', 'R'];
const ROOTS: readonly PitchClass[] = [0, 2, 4, 5, 7, 9, 11];

const OP_DESCRIPTION: Record<PLR, string> = {
  P: 'parallel — swaps major and minor on the same root',
  L: 'leading-tone exchange — root moves by a major third, shares two pitches',
  R: 'relative — major ↔ relative minor, shares two pitches',
};

export default function Module7Derive() {
  const [root, setRoot] = useState<PitchClass>(0);
  const [quality, setQuality] = useState<TriadQuality>('major');
  const [op, setOp] = useState<PLR>('P');

  const source: Triad = { root, quality };
  const target: Triad = apply(source, op);
  const shared = sharedPcs(source, op);

  const sourcePcs = [...triadPcs(source)].sort((a, b) => a - b);
  const targetPcs = [...triadPcs(target)].sort((a, b) => a - b);

  return (
    <div className="m7-derive">
      <div className="m7-derive-controls">
        <div className="m7-derive-control">
          <span className="m7-derive-label">root</span>
          <div className="m7-derive-buttons">
            {ROOTS.map((r) => (
              <button
                key={r}
                type="button"
                className={r === root ? 'm7-pick active' : 'm7-pick'}
                onClick={() => setRoot(r)}
                aria-pressed={r === root}
              >
                {PITCH_NAMES[r]}
              </button>
            ))}
          </div>
        </div>
        <div className="m7-derive-control">
          <span className="m7-derive-label">quality</span>
          <div className="m7-derive-buttons">
            {(['major', 'minor'] as TriadQuality[]).map((q) => (
              <button
                key={q}
                type="button"
                className={q === quality ? 'm7-pick active' : 'm7-pick'}
                onClick={() => setQuality(q)}
                aria-pressed={q === quality}
              >
                {q}
              </button>
            ))}
          </div>
        </div>
        <div className="m7-derive-control">
          <span className="m7-derive-label">transformation</span>
          <div className="m7-derive-buttons">
            {OPS.map((o) => (
              <button
                key={o}
                type="button"
                className={o === op ? 'm7-pick m7-pick-op active' : 'm7-pick m7-pick-op'}
                onClick={() => setOp(o)}
                aria-pressed={o === op}
              >
                {o}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="m7-derive-pair">
        <div className="m7-derive-side">
          <Z12Clock
            pcs={sourcePcs}
            polygonPath={[...sourcePcs, sourcePcs[0]]}
            tonicPc={source.root}
            labels="both"
            size={180}
            ariaLabel={`${triadName(source)} source triad`}
          />
          <span className="m7-derive-name">{triadName(source)}</span>
        </div>
        <span className="m7-derive-arrow">→ {op} →</span>
        <div className="m7-derive-side">
          <Z12Clock
            pcs={targetPcs}
            polygonPath={[...targetPcs, targetPcs[0]]}
            tonicPc={target.root}
            labels="both"
            size={180}
            ariaLabel={`${triadName(target)} target triad after ${op}`}
          />
          <span className="m7-derive-name">{triadName(target)}</span>
        </div>
      </div>

      <p className="m7-derive-caption">
        <strong>{op}</strong> — {OP_DESCRIPTION[op]}. Shared notes:{' '}
        <em>{shared.map((pc) => PITCH_NAMES[pc]).join(', ')}</em>. The
        one note not in the shared list is the voice that moved.
      </p>
    </div>
  );
}
