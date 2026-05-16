import { useMemo } from 'react';
import {
  PITCH_NAMES,
  mod12,
  type PitchClass,
} from '@/lib/music/pitchClass';

// One dot per pitch class, evenly spaced around the unit circle. Pitch class
// 0 (C) sits at the top — 12 o'clock — and indices grow clockwise. This
// matches the convention in nearly every pc-set theory textbook.
const POSITIONS: { x: number; y: number }[] = Array.from(
  { length: 12 },
  (_, i) => {
    const deg = i * 30 - 90;
    const rad = (deg * Math.PI) / 180;
    return { x: Math.cos(rad), y: Math.sin(rad) };
  },
);

export interface Z12ClockProps {
  // Highlighted pitch classes. Duplicates are tolerated; only their unique
  // mod-12 reductions affect the display.
  pcs?: readonly PitchClass[];
  // Click handler — receives the (mod 12) pc of whichever dot was clicked.
  // Undefined makes the clock non-interactive.
  onPcClick?: (pc: PitchClass) => void;
  // Draw the chord polygon — straight segments connecting consecutive
  // selected pcs. Off by default so the clock reads cleanly when only one
  // pc is lit.
  showChord?: boolean;
  // Draw a dashed line through axisPc and its antipode. Used to visualize the
  // axis of inversion for the reflect operation.
  showAxis?: boolean;
  axisPc?: PitchClass;
  // What to print inside each dot. Numbers are the Z_12 element; letters are
  // the sharp-spelled note name; "both" stacks them.
  labels?: 'numbers' | 'letters' | 'both';
  // Pixel diameter. The dots and label sizes scale with this.
  size?: number;
  className?: string;
  ariaLabel?: string;
}

export default function Z12Clock({
  pcs = [],
  onPcClick,
  showChord = false,
  showAxis = false,
  axisPc = 0,
  labels = 'numbers',
  size = 220,
  className,
  ariaLabel = 'pitch-class clock',
}: Z12ClockProps) {
  const selected = useMemo(
    () => new Set(pcs.map((pc) => mod12(pc))),
    [pcs],
  );
  const interactive = Boolean(onPcClick);

  const cx = size / 2;
  const cy = size / 2;
  const dotR = Math.max(11, Math.round(size * 0.075));
  const r = size / 2 - dotR - 6;

  // The chord polygon connects dots in pc-order, not click-order, so the
  // shape is a function of the pc-set rather than the user's input history.
  const chordPoints = useMemo(() => {
    if (!showChord || selected.size < 2) return null;
    const pts: string[] = [];
    for (let i = 0; i < 12; i++) {
      if (selected.has(i)) {
        const p = POSITIONS[i];
        pts.push(`${(cx + r * p.x).toFixed(2)},${(cy + r * p.y).toFixed(2)}`);
      }
    }
    return pts.join(' ');
  }, [showChord, selected, cx, cy, r]);

  const axisLine = useMemo(() => {
    if (!showAxis) return null;
    const a = POSITIONS[mod12(axisPc)];
    return {
      x1: cx + (r + dotR + 6) * a.x,
      y1: cy + (r + dotR + 6) * a.y,
      x2: cx - (r + dotR + 6) * a.x,
      y2: cy - (r + dotR + 6) * a.y,
    };
  }, [showAxis, axisPc, cx, cy, r, dotR]);

  return (
    <svg
      role="img"
      aria-label={ariaLabel}
      width={size}
      height={size}
      viewBox={`0 0 ${size} ${size}`}
      className={className}
    >
      <circle
        cx={cx}
        cy={cy}
        r={r + dotR + 4}
        fill="#f5efe0"
        stroke="#3d2e1a"
        strokeWidth={1.2}
      />

      {axisLine && (
        <line
          x1={axisLine.x1}
          y1={axisLine.y1}
          x2={axisLine.x2}
          y2={axisLine.y2}
          stroke="#b87a1e"
          strokeWidth={1}
          strokeDasharray="4 4"
          opacity={0.75}
        />
      )}

      {chordPoints && (
        <polygon
          points={chordPoints}
          fill="#e8a838"
          fillOpacity={0.18}
          stroke="#b87a1e"
          strokeWidth={1.2}
        />
      )}

      {POSITIONS.map((p, i) => {
        const on = selected.has(i);
        const x = cx + r * p.x;
        const y = cy + r * p.y;
        const number = String(i);
        const letter = PITCH_NAMES[i];
        return (
          <g
            key={i}
            transform={`translate(${x.toFixed(2)} ${y.toFixed(2)})`}
            style={{ cursor: interactive ? 'pointer' : 'default' }}
            onClick={interactive ? () => onPcClick!(i) : undefined}
            onKeyDown={
              interactive
                ? (e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      onPcClick!(i);
                    }
                  }
                : undefined
            }
            tabIndex={interactive ? 0 : -1}
            role={interactive ? 'button' : undefined}
            aria-pressed={interactive ? on : undefined}
            aria-label={interactive ? `pitch class ${i} (${letter})` : undefined}
          >
            <circle
              r={dotR}
              fill={on ? '#e8a838' : '#fbf6e9'}
              stroke="#3d2e1a"
              strokeWidth={on ? 1.6 : 1}
            />
            {labels === 'both' ? (
              <>
                <text
                  textAnchor="middle"
                  y={-2}
                  fontFamily="var(--font-jetbrains)"
                  fontSize={Math.round(dotR * 0.7)}
                  fontWeight={on ? 700 : 500}
                  fill="#1f1408"
                >
                  {number}
                </text>
                <text
                  textAnchor="middle"
                  y={dotR * 0.7}
                  fontFamily="var(--font-crimson)"
                  fontStyle="italic"
                  fontSize={Math.round(dotR * 0.55)}
                  fill="#6b5d48"
                >
                  {letter}
                </text>
              </>
            ) : (
              <text
                textAnchor="middle"
                dominantBaseline="central"
                fontFamily={
                  labels === 'letters'
                    ? 'var(--font-crimson)'
                    : 'var(--font-jetbrains)'
                }
                fontStyle={labels === 'letters' ? 'italic' : 'normal'}
                fontSize={Math.round(dotR * 0.85)}
                fontWeight={on ? 700 : 500}
                fill="#1f1408"
              >
                {labels === 'letters' ? letter : number}
              </text>
            )}
          </g>
        );
      })}
    </svg>
  );
}
