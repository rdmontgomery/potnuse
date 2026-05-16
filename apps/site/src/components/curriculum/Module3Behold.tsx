import { useEffect, useRef, useState } from 'react';
import {
  C_MAJOR_PCS,
  MODE_NAMES,
  modeTonic,
} from '@/lib/music/diatonic';
import { PITCH_NAMES } from '@/lib/music/pitchClass';
import Z12Clock from './Z12Clock';

// Behold for Module 3. Seven diatonic notes lit on the clock; the tonic
// ring auto-rotates through the seven scale degrees every ~1.6 seconds,
// labeling each mode as it lands. The set never changes — only the
// starting note does. That's the modes: same set, different anchor.

const STEP_MS = 1600;

export default function Module3Behold() {
  const wrapRef = useRef<HTMLDivElement>(null);
  const [degree, setDegree] = useState(0);
  const [running, setRunning] = useState(false);
  const timerRef = useRef<number | null>(null);

  useEffect(() => {
    if (!running) return;
    timerRef.current = window.setInterval(() => {
      setDegree((d) => (d + 1) % 7);
    }, STEP_MS);
    return () => {
      if (timerRef.current != null) {
        window.clearInterval(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [running]);

  // Start on view; same pattern as Module 0 / Module 2 Behold.
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

  const tonic = modeTonic(degree);
  const modeName = MODE_NAMES[degree];
  const tonicLetter = PITCH_NAMES[tonic];

  return (
    <div
      ref={wrapRef}
      className="m3-behold"
      role="button"
      tabIndex={0}
      onClick={() => setDegree((d) => (d + 1) % 7)}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          setDegree((d) => (d + 1) % 7);
        }
      }}
      aria-label={`diatonic scale on the clock, current mode ${modeName}`}
    >
      <Z12Clock
        pcs={C_MAJOR_PCS}
        tonicPc={tonic}
        labels="both"
        size={260}
        ariaLabel={`C major scale with ${modeName} tonic on ${tonicLetter}`}
      />
      <div className="m3-behold-label">
        <span className="m3-behold-tonic">{tonicLetter}</span>
        <span className="m3-behold-mode">{modeName}</span>
      </div>
      <p className="m3-behold-caption">
        Same seven pitches — the diatonic scale — anchored at a different
        starting note each cycle. The set doesn't move; the tonic does.
      </p>
    </div>
  );
}
