import { useEffect, useRef, useState } from 'react';
import { MAJOR_PROFILE, MINOR_PROFILE } from '@/lib/music/krumhansl';
import { PITCH_NAMES } from '@/lib/music/pitchClass';

// Behold for Module 9. Side-by-side bar charts of the Krumhansl
// probe-tone profiles for major and minor. Auto-toggles between the
// two on a 3-second beat so the listener sees both shapes, then can
// hold either by tapping.

export default function Module9Behold() {
  const wrapRef = useRef<HTMLDivElement>(null);
  const [mode, setMode] = useState<'major' | 'minor'>('major');
  const [running, setRunning] = useState(false);
  const timerRef = useRef<number | null>(null);

  useEffect(() => {
    if (!running) return;
    timerRef.current = window.setInterval(() => {
      setMode((m) => (m === 'major' ? 'minor' : 'major'));
    }, 3200);
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

  const profile = mode === 'major' ? MAJOR_PROFILE : MINOR_PROFILE;
  const maxVal = Math.max(...profile);

  return (
    <div
      ref={wrapRef}
      className="m9-behold"
      role="button"
      tabIndex={0}
      onClick={() => setMode((m) => (m === 'major' ? 'minor' : 'major'))}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          setMode((m) => (m === 'major' ? 'minor' : 'major'));
        }
      }}
      aria-label={`Krumhansl ${mode} probe-tone profile`}
    >
      <div className="m9-mode-label">
        <span className="m9-mode-name">{mode}</span>
        <span className="m9-mode-sub">probe-tone profile</span>
      </div>
      <div className="m9-bars">
        {profile.map((v, i) => {
          const heightPct = (v / maxVal) * 100;
          const isTonic = i === 0;
          return (
            <div
              key={i}
              className="m9-bar-col"
              aria-label={`pc ${i} (${PITCH_NAMES[i]}): fit ${v.toFixed(2)}`}
            >
              <div
                className={isTonic ? 'm9-bar tonic' : 'm9-bar'}
                style={{ height: `${heightPct}%` }}
                title={`pc ${i}: ${v.toFixed(2)}`}
              >
                <span className="m9-bar-value">{v.toFixed(1)}</span>
              </div>
              <span className="m9-bar-label">{i}</span>
            </div>
          );
        })}
      </div>
      <p className="m9-behold-caption">
        Each bar is a pitch class's <em>fit</em> rating in this key
        context — averaged over hundreds of listeners' probe-tone
        responses. The tonic dominates, the dominant follows, then the
        mediant. The minor profile flattens the third and raises the
        sixth.
      </p>
    </div>
  );
}
