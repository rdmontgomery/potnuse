import { useState } from 'react';
import {
  diatonicTriadMidi,
  diatonicTriadPcs,
  romanFor,
  triadQuality,
  ROMAN_NUMERALS,
  QUALITY_LABEL,
} from '@/lib/music/triads';
import { PITCH_NAMES, mod12 } from '@/lib/music/pitchClass';
import ChordStaff from './ChordStaff';

const VEX_LETTERS = ['c', 'c#', 'd', 'd#', 'e', 'f', 'f#', 'g', 'g#', 'a', 'a#', 'b'];

function midiToVexKey(midi: number): string {
  const pc = mod12(midi);
  const octave = Math.floor(midi / 12) - 1;
  return `${VEX_LETTERS[pc]}/${octave}`;
}

// Derive for Module 4. The triad lives on a treble staff now — the
// notation native to chord-as-stack-of-thirds, in a way the clock's
// pc-set view never quite is. The Roman numeral prints above the
// staff, the spelling and quality print below. The clock is still
// fine for orbit-and-symmetry views; this module wanted the staff.

export default function Module4Derive() {
  const [degree, setDegree] = useState(0);
  const triad = diatonicTriadPcs(degree);
  const midis = diatonicTriadMidi(degree);
  const vexKeys = midis.map(midiToVexKey);
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

      <div className="m4-staff-wrap">
        <ChordStaff
          pitches={vexKeys}
          label={romanFor(degree)}
          size={260}
          ariaLabel={`${romanFor(degree)} triad: ${triad.map((pc) => PITCH_NAMES[pc]).join(', ')}`}
        />
      </div>

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
