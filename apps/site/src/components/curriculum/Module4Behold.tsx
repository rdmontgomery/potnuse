import { useEffect, useRef, useState } from 'react';
import { C_MAJOR_PCS } from '@/lib/music/diatonic';
import {
  diatonicTriadPcs,
  romanFor,
  triadQuality,
} from '@/lib/music/triads';
import { PITCH_NAMES, type PitchClass } from '@/lib/music/pitchClass';
import Z12Clock from './Z12Clock';

// Behold for Module 4. Cycles through the seven diatonic triads of C
// major, building each one as a root → third → fifth stack on the clock
// and naming the Roman numeral + quality below. The scale stays lit at
// low contrast underneath so the listener sees the chord being chosen
// from a fixed pitch field.

const STAGE_MS = 850;     // root, +third, +fifth
const HOLD_MS = 1200;     // hold the full triad
const STEP_DEGREE_MS = STAGE_MS * 3 + HOLD_MS;

export default function Module4Behold() {
  const wrapRef = useRef<HTMLDivElement>(null);
  const [degree, setDegree] = useState(0);
  const [stack, setStack] = useState(0); // 0, 1, 2, 3 (3 = full + hold)
  const [running, setRunning] = useState(false);
  const stackTimerRef = useRef<number | null>(null);
  const degreeTimerRef = useRef<number | null>(null);

  useEffect(() => {
    if (!running) return;

    // Each degree runs through stack stages 0 → 1 → 2 → 3, then the
    // outer degree timer advances and the stack resets.
    stackTimerRef.current = window.setInterval(() => {
      setStack((s) => (s >= 3 ? 3 : s + 1));
    }, STAGE_MS);

    degreeTimerRef.current = window.setInterval(() => {
      setDegree((d) => (d + 1) % 7);
      setStack(0);
    }, STEP_DEGREE_MS);

    return () => {
      if (stackTimerRef.current != null) {
        window.clearInterval(stackTimerRef.current);
        stackTimerRef.current = null;
      }
      if (degreeTimerRef.current != null) {
        window.clearInterval(degreeTimerRef.current);
        degreeTimerRef.current = null;
      }
    };
  }, [running]);

  // Start once the wheel scrolls into view.
  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    if (typeof IntersectionObserver === 'undefined') {
      setRunning(true);
      return;
    }
    const obs = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.intersectionRatio > 0.3) {
            setRunning(true);
            obs.disconnect();
            return;
          }
        }
      },
      { threshold: [0.3] },
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  // Stack stages: 0 = root only, 1 = root + third, 2 = root + third +
  // fifth, 3 = same as 2 (held).
  const triad = diatonicTriadPcs(degree);
  const litCount = Math.min(stack, 2) + 1;
  const lit: PitchClass[] = triad.slice(0, litCount);
  // After the full triad is built, draw the polygon connecting them.
  const polygon =
    stack >= 2 ? [...triad].sort((a, b) => a - b) : undefined;

  const roman = romanFor(degree);
  const quality = triadQuality(degree);
  const root = PITCH_NAMES[triad[0]];

  return (
    <div ref={wrapRef} className="m4-behold">
      <Z12Clock
        pcs={lit}
        showChord={polygon !== undefined}
        // Use polygonPath to connect them in pc-order rather than build-
        // order, since the chord is a set and the triangle shape should
        // be stable.
        polygonPath={polygon ? [...polygon, polygon[0]] : undefined}
        tonicPc={triad[0]}
        labels="both"
        size={260}
        ariaLabel={`triad ${roman} of C major, stacking thirds from ${root}`}
      />

      {/* Faded scale-degree dots underneath the lit triad so the
          listener sees which diatonic pitches are being skipped. */}
      <div className="m4-behold-scale" aria-hidden>
        {C_MAJOR_PCS.map((pc) => (
          <span
            key={pc}
            className={
              triad.includes(pc) ? 'm4-scale-dot in-chord' : 'm4-scale-dot'
            }
          >
            {PITCH_NAMES[pc]}
          </span>
        ))}
      </div>

      <div className="m4-behold-label">
        <span className="m4-behold-roman">{roman}</span>
        <span className="m4-behold-quality">{quality}</span>
        <span className="m4-behold-spell">{triad.map((pc) => PITCH_NAMES[pc]).join('–')}</span>
      </div>

      <p className="m4-behold-caption">
        Skip one diatonic note, then another. The chord that falls out
        is the triad on that degree. Quality — major, minor, or
        diminished — depends on where the half-steps land.
      </p>
    </div>
  );
}
