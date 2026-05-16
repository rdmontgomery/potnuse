import { useState } from 'react';
import { CHROMATIC_CHORDS, type Origin } from '@/lib/music/chromatic';
import ChordStaff from './ChordStaff';

// Derive for Module 6. A chord browser grouped by origin
// (tonicization / mixture / neapolitan). Pick a chord, see its
// notation, hear its full label and a one-line pedagogical note.

const ORIGIN_LABEL: Record<Origin, string> = {
  tonicization: 'secondary dominants',
  mixture: 'modal mixture',
  neapolitan: 'neapolitan',
};

export default function Module6Derive() {
  const [chordId, setChordId] = useState(CHROMATIC_CHORDS[0].id);
  const chord =
    CHROMATIC_CHORDS.find((c) => c.id === chordId) ?? CHROMATIC_CHORDS[0];

  const groups: Origin[] = ['tonicization', 'mixture', 'neapolitan'];

  return (
    <div className="m6-derive">
      <div className="m6-chord-grid">
        {groups.map((origin) => (
          <div key={origin} className="m6-chord-col">
            <span className="m6-chord-origin">{ORIGIN_LABEL[origin]}</span>
            <div className="m6-chord-buttons">
              {CHROMATIC_CHORDS.filter((c) => c.origin === origin).map((c) => (
                <button
                  key={c.id}
                  type="button"
                  className={
                    c.id === chordId
                      ? 'm6-chord-btn active'
                      : 'm6-chord-btn'
                  }
                  onClick={() => setChordId(c.id)}
                  aria-pressed={c.id === chordId}
                >
                  {c.label}
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>

      <div className="m6-derive-staff">
        <ChordStaff
          pitches={chord.vexKeys}
          label={chord.label}
          size={260}
          ariaLabel={chord.longLabel}
        />
      </div>

      <p className="m6-derive-caption">
        <strong>{chord.label}</strong> — <em>{chord.longLabel}.</em>{' '}
        {chord.blurb}
      </p>
    </div>
  );
}
