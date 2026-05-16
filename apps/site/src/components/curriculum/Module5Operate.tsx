import { useEffect, useRef, useState } from 'react';
import { diatonicTriadMidi, romanFor, triadQuality } from '@/lib/music/triads';
import {
  CHORDS_BY_FUNCTION,
  FUNCTION_LABEL,
  T_PD_D_T,
  type Fn,
} from '@/lib/music/functions';
import { PITCH_NAMES, mod12 } from '@/lib/music/pitchClass';
import { getPiano } from '@/lib/music/audio';

// Operate for Module 5. Four function slots in order (T, PD, D, T).
// Each slot has a dropdown of candidate chords for that function. The
// listener swaps substitutions and hears how the progression
// transforms — vi for I, ii for IV, vii° for V — without losing the
// underlying arc.

const CHORD_S = 1.1;
const GAP_MS = 80;

const SLOT_FNS: readonly Fn[] = T_PD_D_T.map((s) => s.fn);

function midiToTonePitch(midi: number): string {
  const pc = mod12(midi);
  const octave = Math.floor(midi / 12) - 1;
  return `${PITCH_NAMES[pc]}${octave}`;
}

export default function Module5Operate() {
  // Default progression I → IV → V → I from T_PD_D_T's degrees.
  const [degrees, setDegrees] = useState<number[]>(
    T_PD_D_T.map((s) => s.degree),
  );
  const [busy, setBusy] = useState(false);
  const [activeSlot, setActiveSlot] = useState<number | null>(null);
  const timersRef = useRef<number[]>([]);

  useEffect(() => {
    return () => {
      for (const t of timersRef.current) window.clearTimeout(t);
      timersRef.current = [];
    };
  }, []);

  const setSlot = (slotIndex: number, degree: number) => {
    if (busy) return;
    setDegrees((prev) => prev.map((d, i) => (i === slotIndex ? degree : d)));
  };

  const play = async () => {
    if (busy) return;
    for (const t of timersRef.current) window.clearTimeout(t);
    timersRef.current = [];
    setBusy(true);

    let piano;
    try {
      piano = await getPiano();
    } catch (err) {
      console.error('m5 operate load failed', err);
      setBusy(false);
      return;
    }

    const stepMs = CHORD_S * 1000 + GAP_MS;
    for (let i = 0; i < degrees.length; i++) {
      const slotIndex = i;
      const t = window.setTimeout(() => {
        setActiveSlot(slotIndex);
        const midis = diatonicTriadMidi(degrees[slotIndex]);
        const pitches = midis.map(midiToTonePitch);
        piano!.triggerAttackRelease(pitches, CHORD_S, undefined, 0.75);
      }, i * stepMs);
      timersRef.current.push(t);
    }
    const finalT = window.setTimeout(() => {
      setActiveSlot(null);
      setBusy(false);
    }, degrees.length * stepMs);
    timersRef.current.push(finalT);
  };

  return (
    <div className="m5-operate">
      <div className="m5-slot-row">
        {SLOT_FNS.map((fn, slotIndex) => {
          const candidates = CHORDS_BY_FUNCTION[fn];
          const current = degrees[slotIndex];
          return (
            <div
              key={slotIndex}
              className={`m5-slot ${activeSlot === slotIndex ? 'ringing' : ''}`}
            >
              <span className="m5-slot-fn">{FUNCTION_LABEL[fn]}</span>
              <div className="m5-slot-buttons">
                {candidates.map((d) => (
                  <button
                    key={d}
                    type="button"
                    className={
                      d === current
                        ? 'm5-slot-btn active'
                        : 'm5-slot-btn'
                    }
                    onClick={() => setSlot(slotIndex, d)}
                    disabled={busy}
                    aria-pressed={d === current}
                  >
                    <span className="m5-slot-roman">{romanFor(d)}</span>
                    <span className="m5-slot-q">{triadQuality(d)[0]}</span>
                  </button>
                ))}
              </div>
            </div>
          );
        })}
      </div>

      <button
        type="button"
        className="m5-operate-play"
        onClick={() => void play()}
        disabled={busy}
      >
        {busy
          ? 'playing…'
          : `play ${degrees.map((d) => romanFor(d)).join(' – ')}`}
      </button>

      <p className="m5-operate-caption">
        Swap the default progression for substitutions. <code>I → ii → V → vi</code>{' '}
        ends with a deceptive cadence; <code>vi → IV → V → I</code> is the
        50s-pop fingerprint with vi taking the home slot. Same arc,
        different colors.
      </p>
    </div>
  );
}
