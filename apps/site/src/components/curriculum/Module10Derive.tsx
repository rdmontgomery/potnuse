import { useEffect, useRef, useState } from 'react';
import { SCHENKER_TIERS } from '@/lib/music/schenker';
import { engrave } from '@/lib/pentimento/engrave';

// Derive for Module 10. Manual tier picker. The same four-tier
// reduction stack as Behold, but the listener chooses which layer
// they see and can hold any one indefinitely. The prose explains
// what each tier means.

const TIER_BLURBS: Record<string, string> = {
  foreground:
    'Every authored note. Passing tones, neighbor tones, scale-figure motion — everything that decorates the chord-tone framework.',
  middleground:
    'Strip the inner passing tones; keep the chord tones. The melodic contour survives in coarser strokes.',
  background:
    'One structural note per bar. The phrase is a four-note line over a four-chord bass arpeggiation.',
  ursatz:
    'The deep skeleton. A 3-line Urlinie (E – D – C in the soprano) over a Bassbrechung (C – G – C). Three notes, three notes, one tonal phrase.',
};

export default function Module10Derive() {
  const [tier, setTier] = useState(0);
  const staffRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = staffRef.current;
    if (!el) return;
    try {
      engrave(el, SCHENKER_TIERS[tier].song, { tier: 0, compact: true });
    } catch (err) {
      console.error('m10 derive engrave failed', err);
      el.textContent = `engrave error: ${(err as Error).message ?? String(err)}`;
    }
  }, [tier]);

  const current = SCHENKER_TIERS[tier];

  return (
    <div className="m10-derive">
      <div className="m10-tier-row">
        <span className="m10-tier-label">tier</span>
        <div className="m10-tier-buttons">
          {SCHENKER_TIERS.map((t, j) => (
            <button
              key={t.id}
              type="button"
              className={j === tier ? 'm10-tier-btn active' : 'm10-tier-btn'}
              onClick={() => setTier(j)}
              aria-pressed={j === tier}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>
      <div className="m10-staff-wrap">
        <div ref={staffRef} className="m10-staff" />
      </div>
      <p className="m10-derive-caption">
        <strong>{current.label}.</strong> {TIER_BLURBS[current.id]}
      </p>
    </div>
  );
}
