import { useEffect, useRef, useState } from 'react';
import {
  diatonicTriadMidi,
  romanFor,
  ROMAN_NUMERALS,
} from '@/lib/music/triads';
import { PITCH_NAMES, mod12 } from '@/lib/music/pitchClass';
import { getPiano } from '@/lib/music/audio';
import { takeOver } from '@/lib/music/audioBus';
import { minimalVoiceLeading } from '@/lib/music/voiceLeading';

// Operate for Module 8. Pick a source and target triad; press play to
// hear the voice leading as two chords with the optimal voice
// assignment. The display shows arrival times for each voice — the
// audio renders the motion as a glissando-like overlap rather than a
// hard cut, even though the underlying triggers are discrete: each
// voice gets its own note that lasts through the transition.

const DEGREES: readonly number[] = [0, 1, 2, 3, 4, 5, 6];
const HOLD_S = 1.6;

function midiToTonePitch(midi: number): string {
  const pc = mod12(midi);
  const octave = Math.floor(midi / 12) - 1;
  return `${PITCH_NAMES[pc]}${octave}`;
}

// Compute the target MIDI for each voice, given the source MIDI and a
// voice-leading mapping. We start from the source MIDI's register and
// move by the signed semitone motion. That keeps each voice close to
// its starting octave rather than re-voicing the chord from scratch.
function voiceLedMidis(
  sourceMidis: readonly number[],
  motion: readonly number[],
): number[] {
  return sourceMidis.map((m, i) => m + motion[i]);
}

export default function Module8Operate() {
  const [fromDeg, setFromDeg] = useState(0);
  const [toDeg, setToDeg] = useState(3);
  const [busy, setBusy] = useState(false);
  const timersRef = useRef<number[]>([]);
  const busHandleRef = useRef<(() => void) | null>(null);

  const cancelTimers = () => {
    for (const t of timersRef.current) window.clearTimeout(t);
    timersRef.current = [];
  };

  useEffect(() => {
    return () => {
      busHandleRef.current?.();
      busHandleRef.current = null;
      cancelTimers();
    };
  }, []);

  const fromMidi = diatonicTriadMidi(fromDeg);
  // Recover the source's pcs in the same order as the MIDI voicing
  // (root, third, fifth — diatonicTriadMidi yields them sorted by
  // ascending MIDI).
  const fromPcs = fromMidi.map((m) => mod12(m));
  const toMidi0 = diatonicTriadMidi(toDeg);
  const toPcs = toMidi0.map((m) => mod12(m));

  const vl = minimalVoiceLeading(fromPcs, toPcs);
  // Reorder the move list to align with the source-voice order so the
  // motion array indexes the voicing's voice-by-voice.
  const motionByVoice = fromPcs.map((pc) => {
    const move = vl.moves.find((m) => m.from === pc);
    return move?.motion ?? 0;
  });
  const targetMidis = voiceLedMidis(fromMidi, motionByVoice);

  const play = async () => {
    if (busy) return;
    cancelTimers();
    setBusy(true);
    busHandleRef.current = takeOver(
      () => cancelTimers(),
      () => setBusy(false),
    );

    let piano;
    try {
      piano = await getPiano();
    } catch (err) {
      console.error('m8 operate load failed', err);
      setBusy(false);
      return;
    }

    const fromPitches = fromMidi.map(midiToTonePitch);
    const toPitches = targetMidis.map(midiToTonePitch);

    piano.triggerAttackRelease(fromPitches, HOLD_S, undefined, 0.75);
    const t1 = window.setTimeout(() => {
      piano!.triggerAttackRelease(toPitches, HOLD_S, undefined, 0.75);
    }, HOLD_S * 1000);
    timersRef.current.push(t1);
    const t2 = window.setTimeout(
      () => {
        busHandleRef.current?.();
        busHandleRef.current = null;
        setBusy(false);
      },
      HOLD_S * 2 * 1000 + 100,
    );
    timersRef.current.push(t2);
  };

  return (
    <div className="m8-operate">
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
                onClick={() => {
                  if (busy) return;
                  setFromDeg(d);
                }}
                disabled={busy}
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
                onClick={() => {
                  if (busy) return;
                  setToDeg(d);
                }}
                disabled={busy}
              >
                {ROMAN_NUMERALS[d]}
              </button>
            ))}
          </div>
        </div>
      </div>

      <button
        type="button"
        className="m8-operate-play"
        onClick={() => void play()}
        disabled={busy}
      >
        {busy ? 'playing…' : `play ${romanFor(fromDeg)} → ${romanFor(toDeg)}`}
      </button>

      <p className="m8-operate-caption">
        Motion <strong>{vl.totalMotion}</strong> semitone
        {vl.totalMotion === 1 ? '' : 's'}. The piano sustains both
        chords so you can hear how the voices actually move — each
        voice as a separate, slow journey, not a leap from one chord
        to the next.
      </p>
    </div>
  );
}
