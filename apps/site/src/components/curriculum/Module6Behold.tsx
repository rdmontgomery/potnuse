import { useEffect, useRef, useState } from 'react';
import ChordStaff from './ChordStaff';

// Behold for Module 6. A four-chord progression with a secondary
// dominant inserted: I → V/V → V → I. As the animation cycles, the
// borrowed chord (V/V) lights amber and its label calls out that it's
// chromatic. The diatonic chords pass without comment.

interface Frame {
  vexKeys: string[];
  label: string;
  function: string;
  chromatic: boolean;
}

const PROGRESSION: Frame[] = [
  {
    vexKeys: ['c/4', 'e/4', 'g/4'],
    label: 'I',
    function: 'tonic',
    chromatic: false,
  },
  {
    vexKeys: ['d/4', 'f#/4', 'a/4'],
    label: 'V/V',
    function: 'tonicization of V',
    chromatic: true,
  },
  {
    vexKeys: ['g/4', 'b/4', 'd/5'],
    label: 'V',
    function: 'dominant',
    chromatic: false,
  },
  {
    vexKeys: ['c/4', 'e/4', 'g/4'],
    label: 'I',
    function: 'tonic',
    chromatic: false,
  },
];

const STAGE_MS = 1700;

export default function Module6Behold() {
  const wrapRef = useRef<HTMLDivElement>(null);
  const [i, setI] = useState(0);
  const [running, setRunning] = useState(false);
  const timerRef = useRef<number | null>(null);

  useEffect(() => {
    if (!running) return;
    timerRef.current = window.setInterval(() => {
      setI((x) => (x + 1) % PROGRESSION.length);
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

  const frame = PROGRESSION[i];

  return (
    <div ref={wrapRef} className="m6-behold">
      <div className={`m6-behold-staff ${frame.chromatic ? 'chromatic' : ''}`}>
        <ChordStaff
          pitches={frame.vexKeys}
          label={frame.label}
          size={240}
          ariaLabel={`${frame.label}, ${frame.function}`}
        />
      </div>
      <div className="m6-behold-track">
        {PROGRESSION.map((f, j) => (
          <div
            key={j}
            className={[
              'm6-behold-step',
              j === i ? 'active' : '',
              f.chromatic ? 'chromatic' : '',
            ]
              .filter(Boolean)
              .join(' ')}
          >
            <span className="m6-step-label">{f.label}</span>
          </div>
        ))}
      </div>
      <p className="m6-behold-caption">
        <strong>V/V</strong> isn't in C major — its F♯ is borrowed.
        That borrowed leading-tone tilts the ear toward G, then V
        catches the fall and lands on I.
      </p>
    </div>
  );
}
