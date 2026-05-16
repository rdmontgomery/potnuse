import { useMemo, useState } from 'react';
import {
  dyadVoiceLeading,
  makeDyad,
  type Dyad,
} from '@/lib/music/voiceLeading';
import { PITCH_NAMES, type PitchClass } from '@/lib/music/pitchClass';

// The 2-voice orbifold rendered as a right triangle, with the unison
// wall as its hypotenuse. The "fundamental domain" of T^2 / S_2 is
// {(x, y) : 0 ≤ x ≤ y ≤ 12}. Each dyad is a point in the triangle;
// voice leadings are paths. Crossing voices reflects off the wall.
//
// Tymoczko's claim made geometric: the orbifold metric on this space
// matches the voice-leading metric exactly. A straight line between
// two dyads (in this triangle) has length equal to the parallel
// voice leading cost. A path that bounces off the unison wall has
// length equal to the crossed voice leading cost. The geodesic — the
// shortest — is the minimal voice leading.

const PCS: readonly PitchClass[] = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11];

// Famous dyads to label on the map. Keep the set small so the
// triangle reads cleanly.
const LANDMARKS: { dyad: Dyad; label: string }[] = [
  { dyad: makeDyad(0, 0), label: 'C–C' },
  { dyad: makeDyad(0, 4), label: 'C–E' },
  { dyad: makeDyad(0, 7), label: 'C–G' },
  { dyad: makeDyad(0, 6), label: 'C–F♯' },
  { dyad: makeDyad(0, 11), label: 'C–B' },
  { dyad: makeDyad(3, 7), label: 'E♭–G' },
  { dyad: makeDyad(5, 11), label: 'F–B' },
];

// SVG canvas geometry. The fundamental domain is the triangle with
// vertices (0, 0), (12, 12), (0, 12). We pad slightly so labels at
// the corners don't clip.
const PAD = 26;
const CELL = 22;
const SIZE = PAD * 2 + 12 * CELL; // ~308

function toSvg(d: { x: number; y: number }): { sx: number; sy: number } {
  // x runs left-to-right (lower voice), y runs top-to-bottom (upper voice).
  // We flip y so higher pitches sit higher in the visual.
  return {
    sx: PAD + d.x * CELL,
    sy: PAD + (12 - d.y) * CELL,
  };
}

function dyadName(d: Dyad): string {
  return `${PITCH_NAMES[Math.round(d.a) % 12]}–${PITCH_NAMES[Math.round(d.b) % 12]}`;
}

export default function Module8Orbifold() {
  const [src, setSrc] = useState<Dyad>(makeDyad(0, 4)); // C-E
  const [tgt, setTgt] = useState<Dyad>(makeDyad(0, 5)); // C-F
  const [editingTarget, setEditingTarget] = useState(false);
  // For a pc-pair picker we track the two voices independently per
  // dyad slot and re-canonicalize on commit.
  const [srcVoices, setSrcVoices] = useState<[PitchClass, PitchClass]>([0, 4]);
  const [tgtVoices, setTgtVoices] = useState<[PitchClass, PitchClass]>([0, 5]);

  const vl = useMemo(() => dyadVoiceLeading(src, tgt), [src, tgt]);

  const setSourceVoice = (i: 0 | 1, pc: PitchClass) => {
    const next: [PitchClass, PitchClass] = [...srcVoices];
    next[i] = pc;
    setSrcVoices(next);
    setSrc(makeDyad(next[0], next[1]));
  };
  const setTargetVoice = (i: 0 | 1, pc: PitchClass) => {
    const next: [PitchClass, PitchClass] = [...tgtVoices];
    next[i] = pc;
    setTgtVoices(next);
    setTgt(makeDyad(next[0], next[1]));
  };

  // SVG coordinates for source, target, and (if crossed) the wall
  // reflection point.
  const srcXY = { x: src.a, y: src.b };
  const tgtXY = { x: tgt.a, y: tgt.b };
  const srcS = toSvg(srcXY);
  const tgtS = toSvg(tgtXY);
  const wallS = vl.reflection
    ? toSvg({ x: vl.reflection.p, y: vl.reflection.p })
    : null;

  // Triangle outline.
  const tri = [toSvg({ x: 0, y: 0 }), toSvg({ x: 12, y: 12 }), toSvg({ x: 0, y: 12 })];
  const triPoints = tri.map((p) => `${p.sx},${p.sy}`).join(' ');

  // Unison wall: the hypotenuse from (0,0) to (12,12). Highlight it
  // so the reflection geometry is legible.
  const wallStart = toSvg({ x: 0, y: 0 });
  const wallEnd = toSvg({ x: 12, y: 12 });

  return (
    <div className="m8-orbifold">
      <svg
        width={SIZE}
        height={SIZE}
        viewBox={`0 0 ${SIZE} ${SIZE}`}
        role="img"
        aria-label="2-voice orbifold (Möbius strip) with the current voice leading drawn"
      >
        {/* Fundamental domain — the right triangle. */}
        <polygon
          points={triPoints}
          fill="#f5efe0"
          stroke="#3d2e1a"
          strokeWidth={1}
        />

        {/* Unison wall: where the two voices coincide. The crossed
            voice leading reflects off this edge. */}
        <line
          x1={wallStart.sx}
          y1={wallStart.sy}
          x2={wallEnd.sx}
          y2={wallEnd.sy}
          stroke="#b87a1e"
          strokeWidth={2}
          strokeDasharray="6 3"
          opacity={0.85}
        />

        {/* Faint grid lines at integer pitches, so the eye can locate
            specific dyads by reading off the axes. */}
        {PCS.map((pc) => {
          const tickX = toSvg({ x: pc, y: 12 });
          const tickXEnd = toSvg({ x: pc, y: pc });
          const tickY = toSvg({ x: 0, y: pc });
          const tickYEnd = toSvg({ x: pc, y: pc });
          return (
            <g key={pc} opacity={0.18}>
              <line
                x1={tickX.sx}
                y1={tickX.sy}
                x2={tickXEnd.sx}
                y2={tickXEnd.sy}
                stroke="#3d2e1a"
                strokeWidth={0.5}
              />
              <line
                x1={tickY.sx}
                y1={tickY.sy}
                x2={tickYEnd.sx}
                y2={tickYEnd.sy}
                stroke="#3d2e1a"
                strokeWidth={0.5}
              />
            </g>
          );
        })}

        {/* Axis labels along the bottom edge (lower voice) and left
            edge (upper voice). */}
        {PCS.map((pc) => {
          const bottom = toSvg({ x: pc, y: -0.5 });
          const left = toSvg({ x: -0.7, y: pc });
          return (
            <g key={`lbl-${pc}`} fontFamily="var(--font-jetbrains)" fontSize={9} fill="#6b5d48">
              <text x={bottom.sx} y={bottom.sy} textAnchor="middle">
                {PITCH_NAMES[pc]}
              </text>
              <text x={left.sx} y={left.sy} textAnchor="middle" dominantBaseline="central">
                {PITCH_NAMES[pc]}
              </text>
            </g>
          );
        })}

        {/* Landmarks: small grey dots for orientation. */}
        {LANDMARKS.map((lm) => {
          const s = toSvg({ x: lm.dyad.a, y: lm.dyad.b });
          return (
            <g key={lm.label} opacity={0.55}>
              <circle cx={s.sx} cy={s.sy} r={3} fill="#6b5d48" />
              <text
                x={s.sx + 5}
                y={s.sy - 4}
                fontFamily="var(--font-jetbrains)"
                fontSize={8}
                fill="#6b5d48"
              >
                {lm.label}
              </text>
            </g>
          );
        })}

        {/* Voice-leading path. For parallel: straight line. For
            crossed: two segments meeting at the unison wall. */}
        {vl.kind === 'parallel' && (
          <line
            x1={srcS.sx}
            y1={srcS.sy}
            x2={tgtS.sx}
            y2={tgtS.sy}
            stroke="#b87a1e"
            strokeWidth={2}
            strokeLinecap="round"
          />
        )}
        {vl.kind === 'crossed' && wallS && (
          <>
            <line
              x1={srcS.sx}
              y1={srcS.sy}
              x2={wallS.sx}
              y2={wallS.sy}
              stroke="#b87a1e"
              strokeWidth={2}
              strokeLinecap="round"
            />
            <line
              x1={wallS.sx}
              y1={wallS.sy}
              x2={tgtS.sx}
              y2={tgtS.sy}
              stroke="#b87a1e"
              strokeWidth={2}
              strokeLinecap="round"
            />
            <circle cx={wallS.sx} cy={wallS.sy} r={3} fill="#b87a1e" />
          </>
        )}

        {/* Source and target dyad markers. */}
        <circle cx={srcS.sx} cy={srcS.sy} r={6} fill="#e8a838" stroke="#3d2e1a" strokeWidth={1.2} />
        <text
          x={srcS.sx + 9}
          y={srcS.sy + 3}
          fontFamily="var(--font-crimson)"
          fontStyle="italic"
          fontSize={11}
          fill="#1f1408"
        >
          {dyadName(src)}
        </text>
        <circle cx={tgtS.sx} cy={tgtS.sy} r={6} fill="#fbf6e9" stroke="#b87a1e" strokeWidth={1.8} />
        <text
          x={tgtS.sx + 9}
          y={tgtS.sy + 3}
          fontFamily="var(--font-crimson)"
          fontStyle="italic"
          fontSize={11}
          fill="#1f1408"
        >
          {dyadName(tgt)}
        </text>
      </svg>

      <div className="m8-orb-pickers">
        <div className="m8-orb-picker">
          <span className="m8-orb-picker-label">source</span>
          {[0, 1].map((vi) => (
            <div key={vi} className="m8-orb-voice">
              <span className="m8-orb-voice-tag">v{vi + 1}</span>
              <div className="m8-orb-pc-row">
                {PCS.map((pc) => (
                  <button
                    key={pc}
                    type="button"
                    className={
                      pc === srcVoices[vi as 0 | 1]
                        ? 'm8-orb-pc active'
                        : 'm8-orb-pc'
                    }
                    onClick={() => setSourceVoice(vi as 0 | 1, pc)}
                    aria-pressed={pc === srcVoices[vi as 0 | 1]}
                  >
                    {PITCH_NAMES[pc]}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
        <div className="m8-orb-picker">
          <span className="m8-orb-picker-label">target</span>
          {[0, 1].map((vi) => (
            <div key={vi} className="m8-orb-voice">
              <span className="m8-orb-voice-tag">v{vi + 1}</span>
              <div className="m8-orb-pc-row">
                {PCS.map((pc) => (
                  <button
                    key={pc}
                    type="button"
                    className={
                      pc === tgtVoices[vi as 0 | 1]
                        ? 'm8-orb-pc active'
                        : 'm8-orb-pc'
                    }
                    onClick={() => setTargetVoice(vi as 0 | 1, pc)}
                    aria-pressed={pc === tgtVoices[vi as 0 | 1]}
                  >
                    {PITCH_NAMES[pc]}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="m8-orb-readout">
        <span className={`m8-orb-kind m8-orb-kind-${vl.kind}`}>
          {vl.kind === 'crossed' ? 'voices cross' : 'voices stay parallel'}
        </span>
        <span className="m8-orb-cost">cost {vl.cost.toFixed(0)} st</span>
      </div>

      <p className="m8-orb-caption">
        Each dyad is a point in this triangle. The dashed orange edge
        is the <em>unison wall</em> — where the two voices coincide.
        A path from one dyad to another, drawn in the triangle, has
        length equal to the voice-leading cost; when the assignment
        crosses voices, the path <em>reflects</em> off the wall
        rather than passing through it. That reflection is the
        orbifold's signature — it's why this space is a Möbius strip
        and not a flat plane.
      </p>
      <p className="m8-orb-caption m8-orb-caption-aside">
        For three voices the picture is a 3D Möbius prism with the
        consonant triads sitting in a band across the middle —
        Tymoczko's <em>The Geometry of Musical Chords</em>{' '}
        (Science, 2006) is the canonical reference.
      </p>
    </div>
  );
}
