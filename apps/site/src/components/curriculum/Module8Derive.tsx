import { useState } from 'react';
import { minimalVoiceLeading } from '@/lib/music/voiceLeading';
import { PITCH_NAMES, type PitchClass } from '@/lib/music/pitchClass';
import {
  diatonicTriadPcs,
  romanFor,
  triadQuality,
  ROMAN_NUMERALS,
} from '@/lib/music/triads';

// Derive for Module 8. Pick any two diatonic triads, see the minimal
// voice leading + total motion. Side benefit: hovering the seven
// degrees reveals that the cheapest moves (PLR distance 1) are between
// triads sharing two pcs — exactly Module 7's neighbors.

const DEGREES: readonly number[] = [0, 1, 2, 3, 4, 5, 6];

function VoiceArrow({ motion }: { motion: number }) {
  if (motion === 0) return <span className="m8-arrow stay">●</span>;
  const sign = motion > 0 ? '↑' : '↓';
  return (
    <span className="m8-arrow">
      {sign} {Math.abs(motion)}
    </span>
  );
}

export default function Module8Derive() {
  const [fromDeg, setFromDeg] = useState(0);
  const [toDeg, setToDeg] = useState(4);

  const fromPcs = diatonicTriadPcs(fromDeg);
  const toPcs = diatonicTriadPcs(toDeg);
  const vl = minimalVoiceLeading(fromPcs, toPcs);

  return (
    <div className="m8-derive">
      <div className="m8-pair-pickers">
        <div className="m8-picker-col">
          <span className="m8-picker-label">from</span>
          <div className="m8-picker-buttons">
            {DEGREES.map((d) => (
              <button
                key={d}
                type="button"
                className={
                  d === fromDeg ? 'm8-picker-btn active' : 'm8-picker-btn'
                }
                onClick={() => setFromDeg(d)}
                aria-pressed={d === fromDeg}
              >
                {ROMAN_NUMERALS[d]}
              </button>
            ))}
          </div>
        </div>
        <div className="m8-picker-col">
          <span className="m8-picker-label">to</span>
          <div className="m8-picker-buttons">
            {DEGREES.map((d) => (
              <button
                key={d}
                type="button"
                className={
                  d === toDeg ? 'm8-picker-btn active' : 'm8-picker-btn'
                }
                onClick={() => setToDeg(d)}
                aria-pressed={d === toDeg}
              >
                {ROMAN_NUMERALS[d]}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="m8-vl-header">
        <span className="m8-vl-chord">{romanFor(fromDeg)}</span>
        <span className="m8-vl-arrow-big">→</span>
        <span className="m8-vl-chord">{romanFor(toDeg)}</span>
      </div>
      <div className="m8-vl-table">
        {vl.moves.map((m, j) => (
          <div key={j} className="m8-vl-row">
            <span className="m8-vl-pitch">{PITCH_NAMES[m.from]}</span>
            <VoiceArrow motion={m.motion} />
            <span className="m8-vl-pitch">{PITCH_NAMES[m.to]}</span>
          </div>
        ))}
      </div>
      <div className="m8-vl-cost">
        <span className="m8-vl-cost-label">total motion</span>
        <span className="m8-vl-cost-value">{vl.totalMotion} semitone{vl.totalMotion === 1 ? '' : 's'}</span>
      </div>
      <p className="m8-derive-caption">
        The smallest possible total motion between two consonant triads
        is one semitone — exactly the cost of every P, L, or R from
        Module 7. Those involutions are the orbifold's nearest-neighbor
        edges.
      </p>
    </div>
  );
}
