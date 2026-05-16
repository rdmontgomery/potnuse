import { useState } from 'react';
import {
  C_MAJOR_PCS,
  MODE_NAMES,
  modeGaps,
  modeTonic,
} from '@/lib/music/diatonic';
import { PITCH_NAMES } from '@/lib/music/pitchClass';
import Z12Clock from './Z12Clock';

// Derive for Module 3. Manual mode selector — Ionian through Locrian.
// Picks land on the seven scale degrees of C major; the clock highlights
// the tonic with the outer ring, and the gap pattern row underneath
// shows the rotation of the 2-2-1-2-2-2-1 fingerprint that distinguishes
// the modes from one another.

export default function Module3Derive() {
  const [degree, setDegree] = useState(0);
  const gaps = modeGaps(degree);
  const tonic = modeTonic(degree);

  return (
    <div className="m3-derive">
      <div className="m3-mode-row">
        <span className="m3-mode-label">mode</span>
        <div className="m3-mode-buttons">
          {MODE_NAMES.map((name, d) => (
            <button
              key={name}
              type="button"
              className={d === degree ? 'm3-mode-btn active' : 'm3-mode-btn'}
              onClick={() => setDegree(d)}
              aria-pressed={d === degree}
              aria-label={`${name}, tonic ${PITCH_NAMES[modeTonic(d)]}`}
            >
              <span className="m3-mode-deg">{d + 1}</span>
              <span className="m3-mode-name">{name}</span>
            </button>
          ))}
        </div>
      </div>

      <Z12Clock
        pcs={C_MAJOR_PCS}
        tonicPc={tonic}
        labels="both"
        size={240}
        ariaLabel={`${MODE_NAMES[degree]} mode, tonic ${PITCH_NAMES[tonic]}`}
      />

      <div className="m3-gap-row">
        <span className="m3-gap-label">gaps</span>
        <div className="m3-gap-pattern">
          {gaps.map((g, i) => (
            <span
              key={i}
              className={
                g === 1 ? 'm3-gap-cell m3-gap-half' : 'm3-gap-cell'
              }
            >
              {g}
            </span>
          ))}
        </div>
      </div>

      <p className="m3-derive-caption">
        Every mode shares the same gap multiset — five whole steps and
        two half steps. What changes is <em>where</em> the half steps
        fall relative to the tonic, and that change is what gives each
        mode its color.
      </p>
    </div>
  );
}
