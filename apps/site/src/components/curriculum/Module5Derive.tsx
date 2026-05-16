import { useState } from 'react';
import { diatonicTriadPcs, romanFor, triadQuality } from '@/lib/music/triads';
import {
  CHORDS_BY_FUNCTION,
  FUNCTION_BLURB,
  FUNCTION_LABEL,
  FUNCTION_SHORT,
  type Fn,
} from '@/lib/music/functions';
import Z12Clock from './Z12Clock';

const COLUMNS: readonly Fn[] = ['tonic', 'predominant', 'dominant'];

// Derive for Module 5. A three-column function map of the seven
// diatonic triads. Clicking a chord shows it on the clock and prints
// a one-line color description of its role.

export default function Module5Derive() {
  const [degree, setDegree] = useState<number>(0);

  const triad = diatonicTriadPcs(degree);
  const sorted = [...triad].sort((a, b) => a - b);
  const polygon = [...sorted, sorted[0]];

  // Recover the function this degree belongs to so the blurb matches
  // the highlighted chord. (FUNCTION_OF_DEGREE is the inverse table but
  // we recompute via CHORDS_BY_FUNCTION's structure so the source of
  // truth stays in one place.)
  const fn: Fn =
    CHORDS_BY_FUNCTION.tonic.includes(degree)
      ? 'tonic'
      : CHORDS_BY_FUNCTION.predominant.includes(degree)
        ? 'predominant'
        : 'dominant';

  return (
    <div className="m5-derive">
      <div className="m5-fn-grid">
        {COLUMNS.map((column) => (
          <div key={column} className="m5-fn-col">
            <span className="m5-fn-label">
              <span className="m5-fn-short">{FUNCTION_SHORT[column]}</span>
              <span className="m5-fn-name">{FUNCTION_LABEL[column]}</span>
            </span>
            <div className="m5-fn-chords">
              {CHORDS_BY_FUNCTION[column].map((d) => (
                <button
                  key={d}
                  type="button"
                  className={d === degree ? 'm5-fn-btn active' : 'm5-fn-btn'}
                  onClick={() => setDegree(d)}
                  aria-pressed={d === degree}
                >
                  <span className="m5-fn-roman">{romanFor(d)}</span>
                  <span className="m5-fn-q">{triadQuality(d)[0]}</span>
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>

      <Z12Clock
        pcs={sorted}
        polygonPath={polygon}
        tonicPc={triad[0]}
        labels="both"
        size={220}
        ariaLabel={`${romanFor(degree)} chord, ${FUNCTION_LABEL[fn]} function`}
      />

      <p className="m5-derive-caption">
        <strong>{romanFor(degree)}</strong> is{' '}
        <em>{FUNCTION_LABEL[fn]}</em> — {FUNCTION_BLURB[fn]} Substituting
        within a function column gives variations on the same arc.
      </p>
    </div>
  );
}
