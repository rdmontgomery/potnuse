import { useEffect, useRef, useState } from 'react';
import { orbit } from '@/lib/music/intervals';
import Z12Clock from './Z12Clock';

// Behold for Module 2. The cycle of fifths draws itself: starting at C,
// stepping by 7 semitones, each new pc is added to the polygon until the
// path closes back on C. The resulting 12-pointed star is the visible
// statement of gcd(7, 12) = 1 — fifths reach every pc before returning.
//
// Auto-plays on scroll-into-view (visually only — no audio without user
// gesture). Tapping the clock replays the animation. The Operate block
// further down is where the sound lives.

const FIFTH_STEP = 7;
const TOTAL_STEPS = 12; // gcd(7, 12) = 1, so orbit covers all of Z_12
const STEP_MS = 600;
const HOLD_MS = 2200;

export default function Module2Behold() {
  const wrapRef = useRef<HTMLDivElement>(null);
  const [stepIndex, setStepIndex] = useState(0);
  const [running, setRunning] = useState(false);
  const timerRef = useRef<number | null>(null);

  // The full orbit of stepping by 7 from C. Closed by re-appending the
  // start pc so the polyline returns to its origin on the final tick.
  const fullPath = useRef(orbit(FIFTH_STEP, 0).concat(0));

  // Begin / restart the animation on demand.
  const play = () => {
    if (timerRef.current != null) {
      window.clearInterval(timerRef.current);
      timerRef.current = null;
    }
    setStepIndex(0);
    setRunning(true);
  };

  useEffect(() => {
    if (!running) return;
    timerRef.current = window.setInterval(() => {
      setStepIndex((i) => {
        if (i >= TOTAL_STEPS) {
          // Done — hold the closed star on screen for HOLD_MS, then
          // restart the loop so the page keeps spinning the wheel.
          if (timerRef.current != null) {
            window.clearInterval(timerRef.current);
            timerRef.current = null;
          }
          window.setTimeout(() => play(), HOLD_MS);
          return i;
        }
        return i + 1;
      });
    }, STEP_MS);
    return () => {
      if (timerRef.current != null) {
        window.clearInterval(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [running]);

  // Start once the wheel enters view. Same pattern as Module 0's Behold.
  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    if (typeof IntersectionObserver === 'undefined') {
      play();
      return;
    }
    const obs = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.intersectionRatio > 0.3 && !running) {
            play();
            obs.disconnect();
            return;
          }
        }
      },
      { threshold: [0.3] },
    );
    obs.observe(el);
    return () => obs.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Slice the closed path at the current step. stepIndex+1 vertices →
  // stepIndex line segments. At stepIndex = TOTAL_STEPS the last segment
  // closes the loop back to C.
  const visiblePath = fullPath.current.slice(0, stepIndex + 1);
  const visiblePcs = visiblePath.slice(0, -1).length > 0
    ? visiblePath.slice(0, Math.min(visiblePath.length, TOTAL_STEPS))
    : [0];

  return (
    <div ref={wrapRef} className="m2-behold" onClick={play} role="button" tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          play();
        }
      }}
      aria-label="cycle of fifths drawing itself — tap to replay"
    >
      <Z12Clock
        pcs={visiblePcs}
        polygonPath={visiblePath}
        labels="both"
        size={260}
        ariaLabel="cycle of fifths on the Z_12 clock"
      />
      <p className="m2-behold-caption">
        Step by <strong>7</strong> from C. Twelve steps later, the path closes —
        and it has visited every pitch class. The fifths form a generator
        of Z<sub>12</sub>.
      </p>
    </div>
  );
}
