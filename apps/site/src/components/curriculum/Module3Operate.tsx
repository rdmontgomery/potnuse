import { useEffect, useRef, useState } from 'react';
import {
  C_MAJOR_PCS,
  MODE_NAMES,
  modeMidiAscending,
  modeTonic,
} from '@/lib/music/diatonic';
import { PITCH_NAMES, mod12 } from '@/lib/music/pitchClass';
import { getPiano } from '@/lib/music/audio';
import { takeOver } from '@/lib/music/audioBus';
import Z12Clock from './Z12Clock';

// Operate for Module 3. Pick a mode, press play — the piano walks the
// mode ascending from its own tonic within C major. Dorian starts on D,
// Phrygian on E, etc. That's the "same set, different anchor" claim
// from Behold and Derive made audible: every mode here uses the white
// keys, just begins on a different one.

const BASE_C_MIDI = 60; // C4 — Ionian starts here
const NOTE_MS = 380;

function midiToTonePitch(midi: number): string {
  const pc = mod12(midi);
  const octave = Math.floor(midi / 12) - 1;
  return `${PITCH_NAMES[pc]}${octave}`;
}

export default function Module3Operate() {
  const [degree, setDegree] = useState(0);
  const [active, setActive] = useState<number | null>(null);
  const [playing, setPlaying] = useState(false);
  const timerRef = useRef<number | null>(null);
  const busHandleRef = useRef<(() => void) | null>(null);

  const cancelTimer = () => {
    if (timerRef.current != null) {
      window.clearInterval(timerRef.current);
      timerRef.current = null;
    }
  };

  useEffect(() => {
    return () => {
      busHandleRef.current?.();
      busHandleRef.current = null;
      cancelTimer();
    };
  }, []);

  const play = async () => {
    if (playing) return;
    cancelTimer();
    setActive(null);
    setPlaying(true);
    busHandleRef.current = takeOver(
      () => {
        cancelTimer();
      },
      () => {
        setActive(null);
        setPlaying(false);
      },
    );

    let piano;
    try {
      piano = await getPiano();
    } catch (err) {
      console.error('piano load failed', err);
      setPlaying(false);
      return;
    }

    // Walk the mode from its own tonic within C major. Each mode uses
    // the white keys; only the starting note shifts.
    const tonicMidi = BASE_C_MIDI + modeTonic(degree);
    const midis = modeMidiAscending(degree, tonicMidi);
    let i = 0;
    function tick() {
      if (i >= midis.length) {
        cancelTimer();
        window.setTimeout(() => {
          busHandleRef.current?.();
          busHandleRef.current = null;
          setActive(null);
          setPlaying(false);
        }, NOTE_MS);
        return;
      }
      const midi = midis[i];
      piano!.triggerAttackRelease(
        midiToTonePitch(midi),
        NOTE_MS / 1000 + 0.05,
        undefined,
        0.7,
      );
      setActive(mod12(midi));
      i += 1;
    }
    tick();
    timerRef.current = window.setInterval(tick, NOTE_MS);
  };

  // Highlight the currently-sounding pc on top of the diatonic set so
  // the listener sees which note is ringing as the line walks up.
  const lit = [...C_MAJOR_PCS, ...(active != null ? [active] : [])];

  return (
    <div className="m3-operate">
      <div className="m3-mode-row">
        <span className="m3-mode-label">mode</span>
        <div className="m3-mode-buttons">
          {MODE_NAMES.map((name, d) => (
            <button
              key={name}
              type="button"
              className={d === degree ? 'm3-mode-btn active' : 'm3-mode-btn'}
              onClick={() => {
                if (playing) return;
                setDegree(d);
              }}
              disabled={playing}
              aria-pressed={d === degree}
            >
              <span className="m3-mode-deg">{d + 1}</span>
              <span className="m3-mode-name">{name}</span>
            </button>
          ))}
        </div>
      </div>

      <Z12Clock
        pcs={lit}
        tonicPc={modeTonic(degree)}
        labels="both"
        size={240}
        ariaLabel={`${MODE_NAMES[degree]} scale`}
      />

      <button
        type="button"
        className="m3-operate-play"
        onClick={() => void play()}
        disabled={playing}
      >
        {playing
          ? 'playing…'
          : `play ${MODE_NAMES[degree]} from ${PITCH_NAMES[modeTonic(degree)]}`}
      </button>

      <p className="m3-operate-caption">
        Every mode here uses the white keys of C major; only the
        starting note moves. Lydian (F) feels bright thanks to its
        raised fourth (B over F); Phrygian (E) feels dark thanks to its
        lowered second (F over E); Locrian (B) is the unstable one with
        the tritone hanging over the tonic.
      </p>
    </div>
  );
}
