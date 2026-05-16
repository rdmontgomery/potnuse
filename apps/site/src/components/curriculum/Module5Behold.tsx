import { useEffect, useRef, useState } from 'react';
import { diatonicTriadPcs, romanFor } from '@/lib/music/triads';
import {
  FUNCTION_LABEL,
  FUNCTION_SHORT,
  T_PD_D_T,
} from '@/lib/music/functions';
import { PITCH_NAMES } from '@/lib/music/pitchClass';
import Z12Clock from './Z12Clock';

// Behold for Module 5. Cycles through the canonical T → PD → D → T
// progression, showing each chord on the clock and labeling its
// function below. Silent — the audio shows up in Operate where the
// listener triggers it intentionally.

const STAGE_MS = 1700;

export default function Module5Behold() {
  const wrapRef = useRef<HTMLDivElement>(null);
  const [i, setI] = useState(0);
  const [running, setRunning] = useState(false);
  const timerRef = useRef<number | null>(null);

  useEffect(() => {
    if (!running) return;
    timerRef.current = window.setInterval(() => {
      setI((x) => (x + 1) % T_PD_D_T.length);
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

  const slot = T_PD_D_T[i];
  const triad = diatonicTriadPcs(slot.degree);
  const sorted = [...triad].sort((a, b) => a - b);
  const polygon = [...sorted, sorted[0]];

  return (
    <div ref={wrapRef} className="m5-behold">
      <Z12Clock
        pcs={sorted}
        polygonPath={polygon}
        tonicPc={triad[0]}
        labels="both"
        size={240}
        ariaLabel={`${romanFor(slot.degree)} chord, ${FUNCTION_LABEL[slot.fn]} function`}
      />
      <div className="m5-behold-track">
        {T_PD_D_T.map((s, j) => (
          <div
            key={j}
            className={`m5-behold-step ${j === i ? 'active' : ''}`}
          >
            <span className="m5-step-roman">{romanFor(s.degree)}</span>
            <span className="m5-step-fn">{FUNCTION_SHORT[s.fn]}</span>
          </div>
        ))}
      </div>
      <p className="m5-behold-caption">
        Tonic, predominant, dominant, tonic. Same arc in nearly every
        cadenced phrase you've ever heard.
      </p>
    </div>
  );
}
