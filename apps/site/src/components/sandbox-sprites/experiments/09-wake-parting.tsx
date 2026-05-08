import { useEffect, useRef, useState } from 'react';
import {
  findMailboxAt,
  Mailbox,
  PROSE_LINES,
  SPRITE_GLYPHS,
  Stage,
  useDelivery,
  useWalkingSprites,
} from '../shared';

// Each prose line is a strip. The sprite's vertical position picks
// which strip is "active". On that strip, glyphs to the left of the
// sprite shift up, glyphs to the right shift down — a wake.

const LETTERS = ['cid', 'terra'];

export default function Exp09WakeParting() {
  const stageRef = useRef<HTMLDivElement | null>(null);
  const lineRefs = useRef<Array<HTMLDivElement | null>>([]);
  const { sprites, setSprites } = useWalkingSprites(stageRef, {
    spritePad: 40,
  });
  const { opened, open, reset, count } = useDelivery(LETTERS);

  // Track each line's stage-local rect so we can decide which one
  // the sprite is crossing.
  const [lineRects, setLineRects] = useState<Array<{ top: number; bottom: number }>>([]);

  useEffect(() => {
    function measure() {
      const stage = stageRef.current;
      if (!stage) return;
      const sr = stage.getBoundingClientRect();
      const next: Array<{ top: number; bottom: number }> = [];
      lineRefs.current.forEach((el) => {
        if (!el) {
          next.push({ top: 0, bottom: 0 });
          return;
        }
        const r = el.getBoundingClientRect();
        next.push({ top: r.top - sr.top, bottom: r.bottom - sr.top });
      });
      setLineRects(next);
    }
    measure();
    const ro = new ResizeObserver(measure);
    if (stageRef.current) ro.observe(stageRef.current);
    return () => ro.disconnect();
  }, []);

  // Compute split-x per line based on closest sprite on that line.
  // null means line is not parted.
  const partings = new Array<{ x: number; intensity: number } | null>(
    PROSE_LINES.length,
  ).fill(null);
  for (let i = 0; i < PROSE_LINES.length; i++) {
    const lr = lineRects[i];
    if (!lr) continue;
    let best: { x: number; intensity: number } | null = null;
    for (const s of sprites) {
      if (s.state !== 'walking') continue;
      const sy = s.y + 12;
      if (sy < lr.top - 6 || sy > lr.bottom + 6) continue;
      const sx = s.x + 30;
      // Closer-to-line-center = stronger parting
      const center = (lr.top + lr.bottom) / 2;
      const intensity = 1 - Math.min(1, Math.abs(sy - center) / ((lr.bottom - lr.top) / 2 + 6));
      if (!best || intensity > best.intensity) {
        best = { x: sx, intensity };
      }
    }
    partings[i] = best;
  }

  function onPointerDown(id: number, ev: React.PointerEvent) {
    (ev.target as Element).setPointerCapture?.(ev.pointerId);
    setSprites((s) =>
      s.map((sp) => (sp.id === id ? { ...sp, state: 'held' } : sp)),
    );
    ev.preventDefault();
  }
  function onPointerMove(id: number, ev: React.PointerEvent) {
    const stage = stageRef.current;
    if (!stage) return;
    const r = stage.getBoundingClientRect();
    setSprites((s) =>
      s.map((sp) =>
        sp.id === id && sp.state === 'held'
          ? { ...sp, x: ev.clientX - r.left - 30, y: ev.clientY - r.top - 12 }
          : sp,
      ),
    );
  }
  function onPointerUp(id: number, ev: React.PointerEvent) {
    const target = ev.currentTarget as HTMLElement;
    const mb = findMailboxAt(stageRef.current, ev.clientX, ev.clientY, target);
    if (mb) {
      open(mb.dataset.mailboxLetterId!);
      setSprites((s) => s.filter((sp) => sp.id !== id));
      return;
    }
    setSprites((s) =>
      s.map((sp) => (sp.id === id ? { ...sp, state: 'walking' } : sp)),
    );
  }

  return (
    <Stage
      index={9}
      title="wake parting"
      blurb="Words on the line a sprite is crossing split — left half lifts, right half drops. Cheap parlour trick."
      delivered={count}
      onReset={() => {
        reset();
        setSprites([]);
      }}
      stageRef={stageRef}
    >
      <div className="sbs-prose">
        {PROSE_LINES.map((line, i) => {
          const part = partings[i];
          return (
            <div
              key={i}
              ref={(el) => {
                lineRefs.current[i] = el;
              }}
              className={'sbs-line' + (part ? ' is-parted' : '')}
            >
              <ParfedLine
                text={line}
                splitX={part?.x ?? null}
                intensity={part?.intensity ?? 0}
              />
              {i === 1 && (
                <div className="sbs-mb-row">
                  <Mailbox letterId="cid" opened={opened.has('cid')} />
                </div>
              )}
              {i === 3 && (
                <div className="sbs-mb-row">
                  <Mailbox letterId="terra" opened={opened.has('terra')} />
                </div>
              )}
            </div>
          );
        })}
      </div>
      <div className="sbs-sprites" aria-hidden="true">
        {sprites.map((s) => (
          <div
            key={s.id}
            className={'sbs-sprite' + (s.state === 'held' ? ' is-held' : '')}
            style={{
              transform: `translate3d(${s.x}px, ${s.y}px, 0)`,
              color: `var(--sbs-${s.kind})`,
            }}
            onPointerDown={(e) => onPointerDown(s.id, e)}
            onPointerMove={(e) => onPointerMove(s.id, e)}
            onPointerUp={(e) => onPointerUp(s.id, e)}
            onPointerCancel={(e) => onPointerUp(s.id, e)}
          >
            {SPRITE_GLYPHS[s.kind]}
          </div>
        ))}
      </div>
    </Stage>
  );
}

// Render a line as two halves above/below when parted. We estimate
// the cut character from splitX as a proportion of the rendered
// width — cheap parlour trick rather than a measured layout.
function ParfedLine({
  text,
  splitX,
  intensity,
}: {
  text: string;
  splitX: number | null;
  intensity: number;
}) {
  const ref = useRef<HTMLParagraphElement | null>(null);
  const active = splitX != null && intensity >= 0.05;
  if (!active) return <p ref={ref}>{text}</p>;
  const w = ref.current?.offsetWidth ?? 1;
  const frac = Math.max(0, Math.min(1, splitX! / w));
  const cut = Math.round(frac * text.length);
  const left = text.slice(0, cut);
  const right = text.slice(cut);
  const lift = -8 * intensity;
  const drop = 8 * intensity;
  return (
    <p ref={ref}>
      <span
        className="sbs-wake-half"
        style={{ transform: `translateY(${lift}px)` }}
      >
        {left}
      </span>
      <span
        className="sbs-wake-half"
        style={{ transform: `translateY(${drop}px)` }}
      >
        {right}
      </span>
    </p>
  );
}
