import { useEffect, useRef } from 'react';
import {
  findMailboxAt,
  Mailbox,
  PROSE_LINES,
  SPRITE_GLYPHS,
  Stage,
  useDelivery,
  useWalkingSprites,
} from '../shared';

const LETTERS = ['cid', 'terra'];
const PULL_RADIUS = 60;
const PULL_AMOUNT = 12; // max px translate per letter

export default function Exp10MagnetLetters() {
  const stageRef = useRef<HTMLDivElement | null>(null);
  const { sprites, setSprites } = useWalkingSprites(stageRef, {
    spritePad: 40,
  });
  const { opened, open, reset, count } = useDelivery(LETTERS);

  // Each letter is wrapped in a span; we keep refs and mutate
  // transforms imperatively per frame to avoid React re-rendering
  // hundreds of nodes.
  const letterRefs = useRef<HTMLSpanElement[]>([]);

  useEffect(() => {
    let raf = 0;
    function tick() {
      const stage = stageRef.current;
      if (!stage) {
        raf = requestAnimationFrame(tick);
        return;
      }
      const sr = stage.getBoundingClientRect();
      // Build sprite centers in stage-local coords once per frame
      const spriteCenters: Array<{ x: number; y: number }> = [];
      for (const s of sprites) {
        if (s.state === 'held') continue;
        spriteCenters.push({ x: s.x + 30, y: s.y + 12 });
      }
      for (const node of letterRefs.current) {
        if (!node) continue;
        const r = node.getBoundingClientRect();
        const cx = r.left - sr.left + r.width / 2;
        const cy = r.top - sr.top + r.height / 2;
        let ox = 0;
        let oy = 0;
        for (const sp of spriteCenters) {
          const dx = cx - sp.x;
          const dy = cy - sp.y;
          const d = Math.hypot(dx, dy);
          if (d > 0 && d < PULL_RADIUS) {
            const fall = 1 - d / PULL_RADIUS;
            ox += (dx / d) * fall * PULL_AMOUNT;
            oy += (dy / d) * fall * PULL_AMOUNT;
          }
        }
        node.style.transform = `translate(${ox.toFixed(1)}px, ${oy.toFixed(1)}px)`;
      }
      raf = requestAnimationFrame(tick);
    }
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [sprites]);

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

  letterRefs.current = [];
  let letterIndex = 0;
  function makeLetterRef(node: HTMLSpanElement | null) {
    if (node) letterRefs.current.push(node);
  }

  return (
    <Stage
      index={9}
      title="magnetic letters"
      blurb={`Each glyph leans toward a passing sprite by up to ${PULL_AMOUNT} px. Per-letter, not per-word — bigger than 4 px so the wake actually reads.`}
      delivered={count}
      onReset={() => {
        reset();
        setSprites([]);
      }}
      stageRef={stageRef}
    >
      <div className="sbs-prose">
        {PROSE_LINES.map((line, i) => {
          const chars = Array.from(line);
          return (
            <div key={i}>
              <p>
                {chars.map((c, ci) => {
                  letterIndex += 1;
                  return (
                    <span
                      key={ci}
                      ref={makeLetterRef}
                      className="sbs-letter"
                      style={{ display: 'inline-block', willChange: 'transform' }}
                    >
                      {c === ' ' ? ' ' : c}
                    </span>
                  );
                })}
              </p>
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
      <span hidden>{letterIndex}</span>
    </Stage>
  );
}
