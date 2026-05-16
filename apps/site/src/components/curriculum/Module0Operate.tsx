import { useEffect, useMemo, useRef, useState } from 'react';
import * as Tone from 'tone';
import { BWV269 } from '@/lib/music/bwv269';
import { engrave } from '@/lib/pentimento/engrave';
import {
  mod12,
  pcName,
  pitchClassOf,
  type PitchClass,
} from '@/lib/music/pitchClass';
import { getPiano, stepsToSeconds, toTonePitch } from '@/lib/music/audio';
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
  const [audioState, setAudioState] = useState<'idle' | 'loading' | 'playing'>(
    'idle',
  );
  const playEndRef = useRef<number | null>(null);

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

  // Cancel any pending end-of-playback timer if the component unmounts mid-
  // phrase. The sampler itself is module-scoped; we don't tear it down.
  useEffect(() => {
    return () => {
      if (playEndRef.current != null) {
        window.clearTimeout(playEndRef.current);
        playEndRef.current = null;
      }
    };
  }, []);

  const play = async () => {
    if (audioState !== 'idle') return;
    setAudioState('loading');
    let piano: Tone.Sampler;
    try {
      piano = await getPiano();
    } catch (err) {
      console.error('module 0 audio load failed', err);
      setAudioState('idle');
      return;
    }
    const bpm = transposed.bpm;
    const start = Tone.now() + 0.05;
    let lastEnd = start;
    for (const note of transposed.notes) {
      const onset = start + stepsToSeconds(note.step, bpm);
      const dur = stepsToSeconds(note.dur, bpm);
      const velocity = note.voice === 'bass' ? 0.55 : 0.82;
      piano.triggerAttackRelease(toTonePitch(note.pitch), dur, onset, velocity);
      lastEnd = Math.max(lastEnd, onset + dur);
    }
    setAudioState('playing');
    const tailMs = (lastEnd - Tone.now()) * 1000 + 250;
    playEndRef.current = window.setTimeout(() => {
      setAudioState('idle');
      playEndRef.current = null;
    }, Math.max(500, tailMs));
  };

  const keyPcs: PitchClass[] = MAJOR_SCALE.map((s) => mod12(s + t));
  const keyName = KEY_NAMES[mod12(t)];

  return (
    <div className="m0-operate">
      <div className="m0-operate-staff-wrap">
        <div ref={staffRef} className="m0-operate-staff" />
      </div>

      <div className="m0-operate-bottom">
        <div className="m0-operate-slider">
          <div className="m0-operate-keyrow">
            <label htmlFor="m0-transpose-slider" className="m0-operate-key">
              <span className="m0-operate-keylabel">key</span>
              <span className="m0-operate-keyname">{keyName} major</span>
            </label>
            <button
              type="button"
              className={`m0-operate-play ${audioState}`}
              onClick={play}
              disabled={audioState !== 'idle'}
              aria-label={
                audioState === 'playing' ? 'phrase playing' : 'play phrase'
              }
            >
              {audioState === 'idle'
                ? 'play'
                : audioState === 'loading'
                  ? 'loading…'
                  : 'playing'}
            </button>
          </div>
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
