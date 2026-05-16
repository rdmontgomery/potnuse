import { useState } from 'react';
import {
  INTERVAL_LABELS,
  gcd,
  orbit,
  orbitShape,
  orbitSize,
} from '@/lib/music/intervals';
import { PITCH_NAMES, type PitchClass } from '@/lib/music/pitchClass';
import Z12Clock from './Z12Clock';

// Derive for Module 2. Pick any interval N from 1 to 11; the clock shows
// the orbit of stepping by N from C, the polygon connects the orbit in
// order, and the caption spells out the gcd → orbit-size correspondence.
// Together this turns the abstract claim ("the orbit length is
// 12 / gcd(N, 12)") into a sequence of concrete shapes the user can
// flip through: chromatic, whole-tone, diminished, augmented, tritone,
// fifths.

const INTERVALS: readonly number[] = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11];

export default function Module2Derive() {
  const [step, setStep] = useState<number>(7);

  const fullOrbit = orbit(step, 0);
  const orbitPath: PitchClass[] = [...fullOrbit, fullOrbit[0]];
  const size = orbitSize(step);
  const gcdVal = gcd(step, 12);
  const shape = orbitShape(step);

  return (
    <div className="m2-derive">
      <div className="m2-interval-row">
        <span className="m2-interval-label">interval</span>
        <div className="m2-interval-buttons">
          {INTERVALS.map((n) => (
            <button
              key={n}
              type="button"
              className={n === step ? 'm2-interval-btn active' : 'm2-interval-btn'}
              onClick={() => setStep(n)}
              aria-pressed={n === step}
              aria-label={`step by ${n} semitones (${INTERVAL_LABELS[n]})`}
            >
              <span className="m2-interval-n">{n}</span>
              <span className="m2-interval-name">{INTERVAL_LABELS[n]}</span>
            </button>
          ))}
        </div>
      </div>

      <Z12Clock
        pcs={fullOrbit}
        polygonPath={orbitPath}
        labels="both"
        size={240}
        ariaLabel={`orbit of stepping by ${step} from C`}
      />

      <div className="m2-derive-stats">
        <div className="m2-stat">
          <span className="m2-stat-label">gcd(N, 12)</span>
          <span className="m2-stat-value">{gcdVal}</span>
        </div>
        <div className="m2-stat">
          <span className="m2-stat-label">orbit size</span>
          <span className="m2-stat-value">{size}</span>
        </div>
        <div className="m2-stat">
          <span className="m2-stat-label">shape</span>
          <span className="m2-stat-value m2-stat-shape">{shape}</span>
        </div>
      </div>

      <p className="m2-derive-caption">
        {fullOrbit.map((pc) => PITCH_NAMES[pc]).join(' → ')}
        {' → '}
        <span className="m2-derive-close">{PITCH_NAMES[fullOrbit[0]]}</span>
      </p>
    </div>
  );
}
