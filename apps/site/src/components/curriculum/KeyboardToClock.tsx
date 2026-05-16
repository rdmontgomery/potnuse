import { useEffect, useRef, useState } from 'react';
import { getPiano } from '@/lib/music/audio';

// Behold for Module 0. Twelve pitches sit in a horizontal row until the
// section comes into view, at which point they wave one by one into a clock.
// The line wrapping into a circle is the quotient made visible — no labels
// required, the geometry does the teaching.
//
// Tapping the visualization plays a soft C-major triad. That's "sit with it"
// under the doc's audio mandate, deferred behind a click so the browser's
// autoplay policy stays happy.

const VIEW_W = 320;
const VIEW_H = 280;
const DOT_R = 17;
const CIRCLE_CX = VIEW_W / 2;
const CIRCLE_CY = 168;
const CIRCLE_R = 92;
const ROW_Y = 38;
const ROW_LEFT = 26;
const ROW_RIGHT = VIEW_W - 26;
const TRIAD = ['C4', 'E4', 'G4', 'C5'];
const TRIAD_DURATION_SEC = 4.8;

function rowPos(pc: number): { x: number; y: number } {
  const span = ROW_RIGHT - ROW_LEFT;
  return { x: ROW_LEFT + (pc / 11) * span, y: ROW_Y };
}

function clockPos(pc: number): { x: number; y: number } {
  const angle = ((pc * 30 - 90) * Math.PI) / 180;
  return {
    x: CIRCLE_CX + CIRCLE_R * Math.cos(angle),
    y: CIRCLE_CY + CIRCLE_R * Math.sin(angle),
  };
}

export default function KeyboardToClock() {
  const ref = useRef<HTMLDivElement>(null);
  const [wrapped, setWrapped] = useState(false);
  const [hasHeard, setHasHeard] = useState(false);
  const [chiming, setChiming] = useState(false);
  const chimeTimerRef = useRef<number | null>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (typeof IntersectionObserver === 'undefined') {
      setWrapped(true);
      return;
    }
    const obs = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.intersectionRatio > 0.4) {
            setWrapped(true);
            obs.disconnect();
            return;
          }
        }
      },
      { threshold: [0.4] },
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  useEffect(() => {
    return () => {
      if (chimeTimerRef.current != null) {
        window.clearTimeout(chimeTimerRef.current);
        chimeTimerRef.current = null;
      }
    };
  }, []);

  const chime = async () => {
    if (chiming) return;
    setChiming(true);
    setHasHeard(true);
    try {
      const piano = await getPiano();
      piano.triggerAttackRelease(TRIAD, TRIAD_DURATION_SEC, undefined, 0.32);
    } catch (err) {
      console.error('behold chime failed', err);
    }
    chimeTimerRef.current = window.setTimeout(() => {
      setChiming(false);
      chimeTimerRef.current = null;
    }, TRIAD_DURATION_SEC * 1000);
  };

  return (
    <div
      ref={ref}
      className={`kbd-to-clock${chiming ? ' chiming' : ''}`}
      role="button"
      tabIndex={0}
      aria-label="twelve pitches wrapping from a row into a clock — tap to hear a C major triad"
      onClick={chime}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          void chime();
        }
      }}
    >
      <svg
        viewBox={`0 0 ${VIEW_W} ${VIEW_H}`}
        width="100%"
        preserveAspectRatio="xMidYMid meet"
      >
        {/* Ghost clock face. Fades in as the dots land in their places. */}
        <circle
          cx={CIRCLE_CX}
          cy={CIRCLE_CY}
          r={CIRCLE_R + DOT_R + 2}
          fill="none"
          stroke="#3d2e1a"
          strokeWidth={1}
          strokeDasharray="2 4"
          opacity={wrapped ? 0.35 : 0}
          style={{ transition: 'opacity 1.6s ease 0.4s' }}
        />

        {/* Ghost row guide. Fades out as the wrap kicks in. */}
        <line
          x1={ROW_LEFT}
          y1={ROW_Y}
          x2={ROW_RIGHT}
          y2={ROW_Y}
          stroke="#3d2e1a"
          strokeWidth={1}
          strokeDasharray="2 4"
          opacity={wrapped ? 0 : 0.35}
          style={{ transition: 'opacity 1s ease' }}
        />

        {Array.from({ length: 12 }, (_, pc) => {
          const dest = wrapped ? clockPos(pc) : rowPos(pc);
          // Highlight the dots that are part of the C major triad while the
          // chime is sounding. Adds a subtle visual tie between the geometry
          // and the audio without lighting up the whole wheel.
          const isTriadPc = pc === 0 || pc === 4 || pc === 7;
          const lit = chiming && isTriadPc;
          return (
            <g
              key={pc}
              style={{
                transform: `translate(${dest.x.toFixed(2)}px, ${dest.y.toFixed(2)}px)`,
                transition:
                  'transform 1.6s cubic-bezier(.55, 0, .25, 1)',
                transitionDelay: `${pc * 55}ms`,
              }}
            >
              <circle
                r={DOT_R}
                fill={lit ? '#e8a838' : '#fbf6e9'}
                stroke="#3d2e1a"
                strokeWidth={lit ? 1.6 : 1.2}
                style={{
                  transition:
                    'fill 0.4s ease, stroke-width 0.4s ease',
                }}
              />
              <text
                textAnchor="middle"
                dominantBaseline="central"
                fontFamily="var(--font-jetbrains)"
                fontSize={12}
                fontWeight={500}
                fill="#1f1408"
                style={{ pointerEvents: 'none' }}
              >
                {pc}
              </text>
            </g>
          );
        })}
      </svg>
      <p
        className={`kbd-to-clock-hint${hasHeard ? ' hidden' : ''}`}
        aria-hidden={hasHeard}
      >
        tap to hear
      </p>
    </div>
  );
}
