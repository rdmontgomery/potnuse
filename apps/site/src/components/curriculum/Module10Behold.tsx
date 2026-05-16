import { useEffect, useRef, useState } from 'react';
import { SCHENKER_TIERS } from '@/lib/music/schenker';
import { engrave } from '@/lib/pentimento/engrave';

// Behold for Module 10. Auto-cycles through the four Schenkerian
// reduction tiers (foreground → middleground → background → Ursatz),
// re-engraving the chorale phrase at each tier. The label below names
// the current depth; the listener watches elaborations collapse onto
// the structural skeleton.

const STAGE_MS = 2800;

export default function Module10Behold() {
  const wrapRef = useRef<HTMLDivElement>(null);
  const staffRef = useRef<HTMLDivElement>(null);
  const [tier, setTier] = useState(0);
  const [running, setRunning] = useState(false);
  const timerRef = useRef<number | null>(null);

  useEffect(() => {
    if (!running) return;
    timerRef.current = window.setInterval(() => {
      setTier((t) => (t + 1) % SCHENKER_TIERS.length);
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

  // Re-engrave whenever the tier index changes.
  useEffect(() => {
    const el = staffRef.current;
    if (!el) return;
    try {
      engrave(el, SCHENKER_TIERS[tier].song, { tier: 0, compact: true });
    } catch (err) {
      console.error('m10 behold engrave failed', err);
      el.textContent = `engrave error: ${(err as Error).message ?? String(err)}`;
    }
  }, [tier]);

  return (
    <div ref={wrapRef} className="m10-behold">
      <div className="m10-staff-wrap">
        <div ref={staffRef} className="m10-staff" />
      </div>
      <div className="m10-tier-track">
        {SCHENKER_TIERS.map((t, j) => (
          <div
            key={t.id}
            className={`m10-tier-step ${j === tier ? 'active' : ''}`}
          >
            <span className="m10-tier-step-label">{t.label}</span>
          </div>
        ))}
      </div>
      <p className="m10-behold-caption">
        Each layer strips the surface elaboration off the one before.
        By the time we reach the <em>Ursatz</em>, the four bars have
        collapsed into a three-note descent over an I–V–I bass — the
        skeleton Schenker called the deep background of every
        well-formed tonal phrase.
      </p>
    </div>
  );
}
