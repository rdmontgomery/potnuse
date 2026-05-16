import { useEffect, useRef, useState } from 'react';
import {
  INTERVAL_LABELS,
  orbit,
  orbitShape,
} from '@/lib/music/intervals';
import { PITCH_NAMES, type PitchClass } from '@/lib/music/pitchClass';
import { getPiano } from '@/lib/music/audio';
import Z12Clock from './Z12Clock';

// Operate for Module 2. Same interval selector as Derive, but with audio:
// "build the orbit" walks through the orbit one pc at a time, sustaining
// each note on the shared piano sampler. The result is the chord/scale
// that interval generates — augmented triad for step 4, diminished
// seventh for step 3, whole-tone scale for step 2, full chromatic cluster
// for step 7. Hearing it adds the missing dimension.

const INTERVALS: readonly number[] = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11];
const START_MIDI = 60; // C4
const STEP_INTERVAL_MS = 520;

function midiToTonePitch(midi: number): string {
  const pc = ((midi % 12) + 12) % 12;
  const octave = Math.floor(midi / 12) - 1;
  return `${PITCH_NAMES[pc]}${octave}`;
}

export default function Module2Operate() {
  const [step, setStep] = useState(7);
  const [visited, setVisited] = useState<PitchClass[]>([]);
  const [building, setBuilding] = useState(false);
  const heldRef = useRef<string[]>([]);
  const timerRef = useRef<number | null>(null);

  const releaseAll = async () => {
    const held = heldRef.current;
    if (held.length === 0) return;
    heldRef.current = [];
    try {
      const piano = await getPiano();
      for (const p of held) {
        try {
          piano.triggerRelease(p);
        } catch {
          /* note already released */
        }
      }
    } catch (err) {
      console.error('release failed', err);
    }
  };

  useEffect(() => {
    return () => {
      if (timerRef.current != null) {
        window.clearInterval(timerRef.current);
        timerRef.current = null;
      }
      void releaseAll();
    };
  }, []);

  const build = async () => {
    if (timerRef.current != null) {
      window.clearInterval(timerRef.current);
      timerRef.current = null;
    }
    await releaseAll();
    setVisited([]);
    setBuilding(true);

    let piano;
    try {
      piano = await getPiano();
    } catch (err) {
      console.error('piano load failed', err);
      setBuilding(false);
      return;
    }

    const orb = orbit(step, 0);
    let i = 0;

    function playNext() {
      if (i >= orb.length) {
        if (timerRef.current != null) {
          window.clearInterval(timerRef.current);
          timerRef.current = null;
        }
        setBuilding(false);
        return;
      }
      const pc = orb[i];
      const pitch = midiToTonePitch(START_MIDI + pc);
      piano!.triggerAttack(pitch);
      heldRef.current.push(pitch);
      setVisited((prev) => [...prev, pc]);
      i += 1;
    }

    playNext();
    timerRef.current = window.setInterval(playNext, STEP_INTERVAL_MS);
  };

  const release = async () => {
    if (timerRef.current != null) {
      window.clearInterval(timerRef.current);
      timerRef.current = null;
    }
    await releaseAll();
    setVisited([]);
    setBuilding(false);
  };

  const fullOrbit = orbit(step, 0);
  const isComplete = visited.length >= fullOrbit.length;
  const polygonPath: PitchClass[] = isComplete
    ? [...visited, visited[0]]
    : visited;
  const hasAudio = building || visited.length > 0;
  const shape = orbitShape(step);

  return (
    <div className="m2-operate">
      <div className="m2-interval-row">
        <span className="m2-interval-label">interval</span>
        <div className="m2-interval-buttons">
          {INTERVALS.map((n) => (
            <button
              key={n}
              type="button"
              className={
                n === step ? 'm2-interval-btn active' : 'm2-interval-btn'
              }
              onClick={() => {
                if (building) return;
                setStep(n);
                setVisited([]);
              }}
              aria-pressed={n === step}
              disabled={building}
            >
              <span className="m2-interval-n">{n}</span>
              <span className="m2-interval-name">{INTERVAL_LABELS[n]}</span>
            </button>
          ))}
        </div>
      </div>

      <Z12Clock
        pcs={visited}
        polygonPath={polygonPath.length >= 2 ? polygonPath : undefined}
        labels="both"
        size={240}
        ariaLabel={`orbit of step ${step} from C, ${visited.length} of ${fullOrbit.length} visited`}
      />

      <div className="m2-operate-controls">
        <button
          type="button"
          className="m2-operate-play"
          onClick={() => void build()}
          disabled={building}
        >
          {building ? 'building…' : 'build the orbit'}
        </button>
        <button
          type="button"
          className="m2-operate-release"
          onClick={() => void release()}
          disabled={!hasAudio}
        >
          release
        </button>
      </div>

      <p className="m2-operate-caption">
        Step {step} from C builds the <strong>{shape}</strong>. Each
        interval grows a different shape: a chord, a scale, or — for the
        four generators — the entire chromatic field.
      </p>
    </div>
  );
}
