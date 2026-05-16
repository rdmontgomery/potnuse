import { useEffect, useMemo, useRef, useState } from 'react';
import { BWV269 } from '@/lib/music/bwv269';
import { engrave } from '@/lib/pentimento/engrave';
import {
  mod12,
  pcName,
  pitchClassOf,
  transpose,
  type PitchClass,
} from '@/lib/music/pitchClass';
import Z12Clock from './Z12Clock';
import type { PNote, Song } from '@/lib/pentimento/types';

// Major-mode diatonic offsets from the tonic. The clock highlights these
// once they're transposed by the current key offset.
const MAJOR_SCALE: readonly number[] = [0, 2, 4, 5, 7, 9, 11];

const KEY_NAMES: readonly string[] = [
  'C',
  'C♯ / D♭',
  'D',
  'D♯ / E♭',
  'E',
  'F',
  'F♯ / G♭',
  'G',
  'G♯ / A♭',
  'A',
  'A♯ / B♭',
  'B',
];

// Shift every authored pitch by n semitones at the VexFlow-string level.
// engrave reads PNote.pitch directly; cloning the song with shifted strings
// keeps the engraver oblivious to transposition and lets it draw the new
// key signature's accidentals naturally.
const LETTERS = ['c', 'c#', 'd', 'd#', 'e', 'f', 'f#', 'g', 'g#', 'a', 'a#', 'b'];

function transposePitchString(p: string, n: number): string {
  const [head, oct] = p.split('/');
  const pc = pitchClassOf(p);
  const newPc = mod12(pc + n);
  const newOctOffset = Math.floor((pc + n) / 12);
  const newOct = Number(oct) + newOctOffset;
  return `${LETTERS[newPc]}/${newOct}`;
}

function transposeSong(song: Song, n: number): Song {
  if (n === 0) return song;
  return {
    ...song,
    notes: song.notes.map((note) => ({
      ...note,
      pitch: transposePitchString(note.pitch, n),
    })),
  };
}

export default function Module0Operate() {
  const staffRef = useRef<HTMLDivElement>(null);
  const [t, setT] = useState(0);

  const transposed = useMemo(() => transposeSong(BWV269, t), [t]);

  useEffect(() => {
    const el = staffRef.current;
    if (!el) return;
    try {
      engrave(el, transposed, {
        tier: 0,
        compact: false,
        noteAnnotator: (n: PNote) => String(pitchClassOf(n.pitch)),
      });
    } catch (err) {
      console.error('module 0 engrave failed', err);
      el.textContent = `engrave error: ${(err as Error).message ?? String(err)}`;
    }
  }, [transposed]);

  const keyPcs: PitchClass[] = MAJOR_SCALE.map((s) => mod12(s + t));
  const keyName = KEY_NAMES[mod12(t)];

  return (
    <div className="m0-operate">
      <div className="m0-operate-staff-wrap">
        <div ref={staffRef} className="m0-operate-staff" />
      </div>

      <div className="m0-operate-bottom">
        <div className="m0-operate-slider">
          <label htmlFor="m0-transpose-slider" className="m0-operate-key">
            <span className="m0-operate-keylabel">key</span>
            <span className="m0-operate-keyname">{keyName} major</span>
          </label>
          <input
            id="m0-transpose-slider"
            type="range"
            min={-6}
            max={6}
            step={1}
            value={t}
            onChange={(e) => setT(Number(e.target.value))}
          />
          <div className="m0-operate-ticks">
            <span>−6</span>
            <span>0</span>
            <span>+6</span>
          </div>
        </div>

        <div className="m0-operate-clock">
          <Z12Clock
            pcs={keyPcs}
            labels="both"
            size={200}
            ariaLabel={`${keyName} major scale on the clock`}
          />
          <p className="m0-operate-clock-caption">
            the pcs lit up are the seven diatonic notes of {pcName(mod12(t))}{' '}
            major. transpose: the whole pattern rotates rigidly.
          </p>
        </div>
      </div>
    </div>
  );
}
