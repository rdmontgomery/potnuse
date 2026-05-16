import { useState } from 'react';
import {
  CLUSTER_GAPS,
  CLUSTER_PCS,
  C_MAJOR_PCS,
  DIATONIC_GAPS,
  MODE_NAMES,
  gapVariance,
  modeGaps,
  modeTonic,
} from '@/lib/music/diatonic';
import { PITCH_NAMES } from '@/lib/music/pitchClass';
import Z12Clock from './Z12Clock';

const DIATONIC_VAR = gapVariance(DIATONIC_GAPS);
const CLUSTER_VAR = gapVariance(CLUSTER_GAPS);

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

      <div className="m3-evenness">
        <p className="m3-evenness-eyebrow">vs. an alternative 7-subset</p>
        <div className="m3-evenness-row">
          <span className="m3-evenness-label">diatonic</span>
          <div className="m3-gap-pattern">
            {DIATONIC_GAPS.map((g, i) => (
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
          <span className="m3-evenness-var">spread {DIATONIC_VAR.toFixed(2)}</span>
        </div>
        <div className="m3-evenness-row">
          <span className="m3-evenness-label">cluster</span>
          <div className="m3-gap-pattern">
            {CLUSTER_GAPS.map((g, i) => (
              <span
                key={i}
                className={
                  g === 1
                    ? 'm3-gap-cell m3-gap-half'
                    : 'm3-gap-cell m3-gap-leap'
                }
              >
                {g}
              </span>
            ))}
          </div>
          <span className="m3-evenness-var">spread {CLUSTER_VAR.toFixed(2)}</span>
        </div>
        <p className="m3-evenness-caption">
          {`{0, 1, 2, 3, 4, 5, 6}`} is also a 7-subset of Z<sub>12</sub>,
          but its gap pattern crams six half-steps next to each other
          and closes with a six-semitone leap. Spread is the variance
          of the gap sizes — the diatonic minimizes it over every
          possible 7-subset, up to rotation. That's the formal
          statement of "maximally even."
        </p>
      </div>
    </div>
  );
}
