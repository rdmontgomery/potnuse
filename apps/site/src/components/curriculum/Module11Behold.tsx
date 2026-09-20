import { useEffect, useMemo, useRef, useState } from 'react';
import {
  choraleHistogram,
  makeRng,
  orderStrength,
  thermalize,
} from '@/lib/music/activeMatter';
import { PITCH_NAMES } from '@/lib/music/pitchClass';

// Behold for Module 11. Animate the temperature rising from 0 to a
// large value over a few seconds, sampling a noisy version of the
// chorale's pc histogram at each step and reading out the inferred
// key + best correlation. At low T the key is locked; at high T the
// reading wobbles between candidates.

const T_STEPS = 28;
const T_MAX = 4.0;
const STAGE_MS = 280;

export default function Module11Behold() {
  const wrapRef = useRef<HTMLDivElement>(null);
  const [t, setT] = useState(0);
  const [running, setRunning] = useState(false);
  const directionRef = useRef<1 | -1>(1);
  const timerRef = useRef<number | null>(null);
  const cold = useMemo(() => choraleHistogram(), []);
  // Keep a fresh RNG each frame so the noise is dynamic without
  // de-syncing the visual.
  const rngRef = useRef(makeRng(42));

  useEffect(() => {
    if (!running) return;
    timerRef.current = window.setInterval(() => {
      setT((cur) => {
        let next = cur + directionRef.current;
        if (next >= T_STEPS) {
          directionRef.current = -1;
          next = T_STEPS - 1;
        } else if (next <= 0) {
          directionRef.current = 1;
          next = 1;
        }
        return next;
      });
    }, STAGE_MS);
    return () => {
      if (timerRef.current != null) {
        window.clearInterval(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [running]);

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

  const temperature = (t / T_STEPS) * T_MAX;
  const noisy = thermalize(cold, temperature, rngRef.current);
  const { best, margin } = orderStrength(noisy);

  // Visual strength: correlation maps onto a 0..1 width for a bar.
  const strength = Math.max(0, best.correlation);
  const ambiguity = Math.max(0, Math.min(1, 1 - margin / 0.2));

  return (
    <div ref={wrapRef} className="m11-behold">
      <div className="m11-readout">
        <div className="m11-readout-row">
          <span className="m11-readout-label">T</span>
          <div className="m11-readout-bar">
            <div
              className="m11-readout-fill m11-thermo"
              style={{ width: `${(t / T_STEPS) * 100}%` }}
            />
          </div>
          <span className="m11-readout-value">{temperature.toFixed(2)}</span>
        </div>
        <div className="m11-readout-row">
          <span className="m11-readout-label">|order|</span>
          <div className="m11-readout-bar">
            <div
              className="m11-readout-fill m11-order"
              style={{ width: `${strength * 100}%` }}
            />
          </div>
          <span className="m11-readout-value">{best.correlation.toFixed(2)}</span>
        </div>
      </div>

      <div className="m11-key-card">
        <span className="m11-key-card-label">inferred key</span>
        <span className="m11-key-card-name">
          {PITCH_NAMES[best.tonic]} {best.mode}
        </span>
        <span
          className="m11-key-card-margin"
          style={{ opacity: 1 - ambiguity * 0.7 }}
        >
          margin {margin.toFixed(3)}
        </span>
      </div>

      <p className="m11-behold-caption">
        At low temperature the chorale's tonal field is locked — C
        major with a wide margin. As T rises, noise leaks into the pc
        histogram, the margin between first and second place
        collapses, and the inferred key starts flipping. That's the
        order parameter breaking down at the critical point.
      </p>
    </div>
  );
}
