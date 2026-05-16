import { useState } from 'react';
import {
  diatonicTriadPcs,
  romanFor,
  triadQuality,
  ROMAN_NUMERALS,
  QUALITY_LABEL,
} from '@/lib/music/triads';
import { PITCH_NAMES } from '@/lib/music/pitchClass';
import Z12Clock from './Z12Clock';

// Derive for Module 4. Manual scale-degree picker. The clock locks the
// triad polygon in place so the listener can compare shapes — major
// triads are isoceles triangles with a long bottom edge, minor flips
// the long edge to the top, diminished is the only one that fits inside
// a tritone (its longest edge is six positions).

export default function Module4Derive() {
  const [degree, setDegree] = useState(0);
  const triad = diatonicTriadPcs(degree);
  const sorted = [...triad].sort((a, b) => a - b);
  const polygon = [...sorted, sorted[0]];
  const quality = triadQuality(degree);

  return (
    <div className="m4-derive">
      <div className="m4-degree-row">
        <span className="m4-degree-label">degree</span>
        <div className="m4-degree-buttons">
          {ROMAN_NUMERALS.map((roman, d) => (
            <button
              key={roman}
              type="button"
              className={
                d === degree ? 'm4-degree-btn active' : 'm4-degree-btn'
              }
              onClick={() => setDegree(d)}
              aria-pressed={d === degree}
            >
              <span className="m4-degree-roman">{roman}</span>
              <span className="m4-degree-quality">
                {triadQuality(d)[0].toUpperCase()}
              </span>
            </button>
          ))}
        </div>
      </div>

      <Z12Clock
        pcs={sorted}
        polygonPath={polygon}
        tonicPc={triad[0]}
        labels="both"
        size={240}
        ariaLabel={`${romanFor(degree)} triad of C major`}
      />

      <div className="m4-derive-info">
        <div className="m4-stat">
          <span className="m4-stat-label">root</span>
          <span className="m4-stat-value">{PITCH_NAMES[triad[0]]}</span>
        </div>
        <div className="m4-stat">
          <span className="m4-stat-label">quality</span>
          <span className="m4-stat-value m4-stat-quality">
            {QUALITY_LABEL[quality]}
          </span>
        </div>
        <div className="m4-stat">
          <span className="m4-stat-label">spelling</span>
          <span className="m4-stat-value">
            {triad.map((pc) => PITCH_NAMES[pc]).join('–')}
          </span>
        </div>
      </div>

      <p className="m4-derive-caption">
        The M-m-m-M-M-m-dim pattern is a fixed fingerprint of major
        keys. Transpose C major to any other key and the qualities at
        each Roman numeral position stay put.
      </p>
    </div>
  );
}
