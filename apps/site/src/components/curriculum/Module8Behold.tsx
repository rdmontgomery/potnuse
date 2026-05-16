import { useEffect, useRef, useState } from 'react';
import { minimalVoiceLeading } from '@/lib/music/voiceLeading';
import {
  PITCH_NAMES,
  type PitchClass,
} from '@/lib/music/pitchClass';

// Behold for Module 8. A four-chord progression (I → IV → V → I in C)
// rendered as voice-leading tables: each transition gets a small
// diagram showing which voice moves where and by how much. The total
// semitone cost surfaces alongside — the "geodesic length" claim from
// the orbifold view, made arithmetic.

interface Triad {
  label: string;
  pcs: readonly PitchClass[];
}

const PROGRESSION: readonly Triad[] = [
  { label: 'I', pcs: [0, 4, 7] }, // C E G
  { label: 'IV', pcs: [5, 9, 0] }, // F A C
  { label: 'V', pcs: [7, 11, 2] }, // G B D
  { label: 'I', pcs: [0, 4, 7] }, // C E G
];

const STAGE_MS = 2200;

function VoiceArrow({ motion }: { motion: number }) {
  if (motion === 0) {
    return <span className="m8-arrow stay">●</span>;
  }
  const sign = motion > 0 ? '↑' : '↓';
  return (
    <span className="m8-arrow">
      {sign} {Math.abs(motion)}
    </span>
  );
}

export default function Module8Behold() {
  const wrapRef = useRef<HTMLDivElement>(null);
  const [i, setI] = useState(0);
  const [running, setRunning] = useState(false);
  const timerRef = useRef<number | null>(null);

  useEffect(() => {
    if (!running) return;
    timerRef.current = window.setInterval(() => {
      setI((x) => (x + 1) % (PROGRESSION.length - 1));
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

  const source = PROGRESSION[i];
  const target = PROGRESSION[i + 1];
  const vl = minimalVoiceLeading(source.pcs, target.pcs);

  return (
    <div ref={wrapRef} className="m8-behold">
      <div className="m8-vl-header">
        <span className="m8-vl-chord">{source.label}</span>
        <span className="m8-vl-arrow-big">→</span>
        <span className="m8-vl-chord">{target.label}</span>
      </div>
      <div className="m8-vl-table">
        {vl.moves.map((m, j) => (
          <div key={j} className="m8-vl-row">
            <span className="m8-vl-pitch">{PITCH_NAMES[m.from]}</span>
            <VoiceArrow motion={m.motion} />
            <span className="m8-vl-pitch">{PITCH_NAMES[m.to]}</span>
          </div>
        ))}
      </div>
      <div className="m8-vl-cost">
        <span className="m8-vl-cost-label">total motion</span>
        <span className="m8-vl-cost-value">{vl.totalMotion} st</span>
      </div>
      <p className="m8-behold-caption">
        Each transition has a <em>minimal voice leading</em> — the
        assignment of voices that moves the smallest total distance.
        I → IV costs 2 semitones; V → I costs the same. That's
        Tymoczko's geodesic: the shortest path in chord-space.
      </p>
    </div>
  );
}
