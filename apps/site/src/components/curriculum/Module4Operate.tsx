import { useEffect, useRef, useState } from 'react';
import {
  diatonicTriadMidi,
  diatonicTriadPcs,
  romanFor,
  triadQuality,
  ROMAN_NUMERALS,
  PROGRESSION_I_IV_V_I,
  PROGRESSION_I_VI_IV_V,
} from '@/lib/music/triads';
import { PITCH_NAMES, mod12 } from '@/lib/music/pitchClass';
import { getPiano } from '@/lib/music/audio';
import Z12Clock from './Z12Clock';

// Operate for Module 4. Pick a scale degree to hear its triad in
// isolation, or run one of two stock progressions to feel how the
// chords sound in sequence. Each chord plays for ~1.1s sustained, which
// is long enough to register as a chord but short enough that the
// progression has motion.

const CHORD_S = 1.1;
const GAP_MS = 100; // brief silence between chords in a progression

function midiToTonePitch(midi: number): string {
  const pc = mod12(midi);
  const octave = Math.floor(midi / 12) - 1;
  return `${PITCH_NAMES[pc]}${octave}`;
}

export default function Module4Operate() {
  const [degree, setDegree] = useState(0);
  const [busy, setBusy] = useState(false);
  const timersRef = useRef<number[]>([]);

  useEffect(() => {
    return () => {
      for (const t of timersRef.current) window.clearTimeout(t);
      timersRef.current = [];
    };
  }, []);

  const cancelTimers = () => {
    for (const t of timersRef.current) window.clearTimeout(t);
    timersRef.current = [];
  };

  const playOne = async (d: number) => {
    if (busy) return;
    setBusy(true);
    cancelTimers();
    try {
      const piano = await getPiano();
      const midis = diatonicTriadMidi(d);
      const pitches = midis.map(midiToTonePitch);
      piano.triggerAttackRelease(pitches, CHORD_S, undefined, 0.75);
    } catch (err) {
      console.error('play one failed', err);
    }
    const t = window.setTimeout(() => {
      setBusy(false);
    }, CHORD_S * 1000 + 80);
    timersRef.current.push(t);
  };

  const playProgression = async (degrees: readonly number[]) => {
    if (busy) return;
    setBusy(true);
    cancelTimers();
    let piano;
    try {
      piano = await getPiano();
    } catch (err) {
      console.error('progression load failed', err);
      setBusy(false);
      return;
    }
    const stepMs = CHORD_S * 1000 + GAP_MS;
    for (let i = 0; i < degrees.length; i++) {
      const d = degrees[i];
      const t = window.setTimeout(() => {
        const midis = diatonicTriadMidi(d);
        const pitches = midis.map(midiToTonePitch);
        piano!.triggerAttackRelease(pitches, CHORD_S, undefined, 0.75);
        setDegree(d);
      }, i * stepMs);
      timersRef.current.push(t);
    }
    const finalT = window.setTimeout(() => {
      setBusy(false);
    }, degrees.length * stepMs);
    timersRef.current.push(finalT);
  };

  const triad = diatonicTriadPcs(degree);
  const sorted = [...triad].sort((a, b) => a - b);
  const polygon = [...sorted, sorted[0]];

  return (
    <div className="m4-operate">
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
              onClick={() => {
                if (busy) return;
                setDegree(d);
              }}
              disabled={busy}
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
        ariaLabel={`${romanFor(degree)} triad`}
      />

      <div className="m4-operate-controls">
        <button
          type="button"
          className="m4-operate-play"
          onClick={() => void playOne(degree)}
          disabled={busy}
        >
          play {romanFor(degree)}
        </button>
        <button
          type="button"
          className="m4-operate-prog"
          onClick={() => void playProgression(PROGRESSION_I_IV_V_I)}
          disabled={busy}
        >
          I – IV – V – I
        </button>
        <button
          type="button"
          className="m4-operate-prog"
          onClick={() => void playProgression(PROGRESSION_I_VI_IV_V)}
          disabled={busy}
        >
          I – vi – IV – V
        </button>
      </div>

      <p className="m4-operate-caption">
        The progressions land naturally because their root motion runs
        through generators of Z<sub>12</sub>: I → IV is a perfect fifth
        down, IV → V is a step up, V → I is a fifth down. Module 2 is
        already doing work down here.
      </p>
    </div>
  );
}
