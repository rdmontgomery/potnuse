import { useMemo, useRef } from 'react';
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

// Pixel distance threshold below which a pointerdown→up on a dot counts as a
// click and above which it counts as the start of a drag. Anything between
// the two is "drag" and the dot's click is suppressed.
const CLICK_DRAG_PX = 6;

export interface Z12ClockProps {
  // Highlighted pitch classes. Duplicates are tolerated; only their unique
  // mod-12 reductions affect the display.
  pcs?: readonly PitchClass[];
  // Click handler — receives the (mod 12) pc of whichever dot was clicked.
  // Undefined makes the dots non-interactive.
  onPcClick?: (pc: PitchClass) => void;
  // Drag-rotate. Fires every time the drag crosses a 30° boundary, with the
  // signed step (+1 clockwise, -1 counterclockwise). Caller transposes the
  // pcs in response — the clock itself stays presentational.
  onRotateStep?: (step: number) => void;
  // Draw the chord polygon — straight segments connecting consecutive
  // selected pcs. Off by default so the clock reads cleanly when only one
  // pc is lit.
  showChord?: boolean;
  // Draw lines through pcs in a specified order rather than pc-sorted.
  // Used by Module 2 to visualize the orbit of an interval — pass the
  // sequence [0, N, 2N, …] mod 12 to draw the star polygon. Renders as
  // an open polyline; repeat the first pc at the end to close the loop.
  // Takes priority over showChord when both are set.
  polygonPath?: readonly PitchClass[];
  // Draw a dashed line through axisPc and its antipode. Used to visualize the
  // axis of inversion for the reflect operation.
  showAxis?: boolean;
  axisPc?: PitchClass;
  // Highlight one pc as the "tonic" / "root" with a thin outer ring.
  // Independent of pcs — the tonic can be on or off as a selected dot.
  tonicPc?: PitchClass;
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
  onRotateStep,
  showChord = false,
  polygonPath,
  showAxis = false,
  axisPc = 0,
  tonicPc,
  labels = 'numbers',
  size = 220,
  className,
  ariaLabel = 'pitch-class clock',
}: Z12ClockProps) {
  const selected = useMemo(
    () => new Set(pcs.map((pc) => mod12(pc))),
    [pcs],
  );
  const clickable = Boolean(onPcClick);
  const draggable = Boolean(onRotateStep);

  const cx = size / 2;
  const cy = size / 2;
  const dotR = Math.max(11, Math.round(size * 0.075));
  const r = size / 2 - dotR - 6;

  // SVG-level drag tracking. Center-relative angle gets converted to
  // semitones (30° per pc) and the callback fires once per integer step.
  const dragRef = useRef<{
    startAngle: number;
    cumulative: number;
    pointerId: number;
    movedFar: boolean;
    startClientX: number;
    startClientY: number;
  } | null>(null);

  function centerFromEvent(e: React.PointerEvent<SVGSVGElement>): {
    cx: number;
    cy: number;
  } {
    const rect = e.currentTarget.getBoundingClientRect();
    return { cx: rect.left + rect.width / 2, cy: rect.top + rect.height / 2 };
  }

  const onPointerDown = (e: React.PointerEvent<SVGSVGElement>) => {
    if (!draggable) return;
    const { cx: ecx, cy: ecy } = centerFromEvent(e);
    dragRef.current = {
      startAngle: Math.atan2(e.clientY - ecy, e.clientX - ecx),
      cumulative: 0,
      pointerId: e.pointerId,
      movedFar: false,
      startClientX: e.clientX,
      startClientY: e.clientY,
    };
    e.currentTarget.setPointerCapture(e.pointerId);
  };

  const onPointerMove = (e: React.PointerEvent<SVGSVGElement>) => {
    const d = dragRef.current;
    if (!d || d.pointerId !== e.pointerId) return;
    const dx = e.clientX - d.startClientX;
    const dy = e.clientY - d.startClientY;
    if (!d.movedFar && Math.hypot(dx, dy) > CLICK_DRAG_PX) {
      d.movedFar = true;
    }
    const { cx: ecx, cy: ecy } = centerFromEvent(e);
    const a = Math.atan2(e.clientY - ecy, e.clientX - ecx);
    let delta = a - d.startAngle;
    if (delta > Math.PI) delta -= 2 * Math.PI;
    if (delta < -Math.PI) delta += 2 * Math.PI;
    const totalSemitones = Math.round((delta * 6) / Math.PI);
    if (totalSemitones !== d.cumulative) {
      const step = totalSemitones - d.cumulative;
      d.cumulative = totalSemitones;
      onRotateStep?.(step);
    }
  };

  const onPointerUp = (e: React.PointerEvent<SVGSVGElement>) => {
    const d = dragRef.current;
    if (!d || d.pointerId !== e.pointerId) return;
    dragRef.current = null;
    try {
      e.currentTarget.releasePointerCapture(e.pointerId);
    } catch {
      /* already released */
    }
  };

  function dotDragWasFar(): boolean {
    return dragRef.current?.movedFar === true;
  }

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

  // Caller-ordered polyline. Used by orbit visualizations where the path
  // through pcs is not pc-sort order. Renders as polyline (open) so the
  // caller can append the start pc to close the loop only when desired.
  const orbitPoints = useMemo(() => {
    if (!polygonPath || polygonPath.length < 2) return null;
    return polygonPath
      .map((pc) => {
        const p = POSITIONS[mod12(pc)];
        return `${(cx + r * p.x).toFixed(2)},${(cy + r * p.y).toFixed(2)}`;
      })
      .join(' ');
  }, [polygonPath, cx, cy, r]);

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
      style={draggable ? { touchAction: 'none', cursor: 'grab' } : undefined}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
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

      {chordPoints && !orbitPoints && (
        <polygon
          points={chordPoints}
          fill="#e8a838"
          fillOpacity={0.18}
          stroke="#b87a1e"
          strokeWidth={1.2}
        />
      )}

      {orbitPoints && (
        <polyline
          points={orbitPoints}
          fill="none"
          stroke="#b87a1e"
          strokeWidth={1.4}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      )}

      {POSITIONS.map((p, i) => {
        const on = selected.has(i);
        const isTonic = tonicPc !== undefined && mod12(tonicPc) === i;
        const x = cx + r * p.x;
        const y = cy + r * p.y;
        const number = String(i);
        const letter = PITCH_NAMES[i];
        return (
          <g
            key={i}
            transform={`translate(${x.toFixed(2)} ${y.toFixed(2)})`}
            style={{ cursor: clickable ? 'pointer' : 'default' }}
            onClick={
              clickable
                ? (ev) => {
                    // Suppress click if the SVG-level drag moved far enough
                    // to count as a rotate gesture rather than a tap.
                    if (dotDragWasFar()) {
                      ev.preventDefault();
                      ev.stopPropagation();
                      return;
                    }
                    onPcClick!(i);
                  }
                : undefined
            }
            onKeyDown={
              clickable
                ? (e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      onPcClick!(i);
                    }
                  }
                : undefined
            }
            tabIndex={clickable ? 0 : -1}
            role={clickable ? 'button' : undefined}
            aria-pressed={clickable ? on : undefined}
            aria-label={clickable ? `pitch class ${i} (${letter})` : undefined}
          >
            {isTonic && (
              <circle
                r={dotR + 4}
                fill="none"
                stroke="#b87a1e"
                strokeWidth={1.4}
              />
            )}
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
                  style={{ pointerEvents: 'none' }}
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
                  style={{ pointerEvents: 'none' }}
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
                style={{ pointerEvents: 'none' }}
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
