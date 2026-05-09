import { useEffect, useRef, useState } from 'react';
import {
  Mailbox,
  PROSE_LINES,
  SPRITE_GLYPHS,
  SPRITE_KINDS,
  SPRITE_TINTS,
  Stage,
  useDelivery,
  type SpriteKind,
} from '../shared';

// Sprite layer is a <canvas>. The reader still drags. Hit-test on
// drop uses getBoundingClientRect of DOM mailboxes — the mailbox
// stays a real button so it's accessible.

const LETTERS = ['cid', 'terra'];

type CSprite = {
  id: number;
  kind: SpriteKind;
  x: number;
  y: number;
  vx: number;
  exitX: number;
  held: boolean;
};

export default function Exp11Canvas() {
  const stageRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const spritesRef = useRef<CSprite[]>([]);
  const heldRef = useRef<{ id: number; pointer: number } | null>(null);
  const idRef = useRef(0);
  const { opened, open, reset, count } = useDelivery(LETTERS);
  const [, force] = useState(0);

  // Spawn loop
  useEffect(() => {
    let cancelled = false;
    let t: number | undefined;
    function spawn() {
      if (cancelled) return;
      const stage = stageRef.current;
      if (!stage) {
        t = window.setTimeout(spawn, 800);
        return;
      }
      const w = stage.clientWidth;
      const h = stage.clientHeight;
      const fromLeft = Math.random() < 0.5;
      const speed = 50 + Math.random() * 60;
      const kind = SPRITE_KINDS[Math.floor(Math.random() * SPRITE_KINDS.length)];
      const y = 30 + Math.random() * Math.max(20, h - 80);
      idRef.current += 1;
      spritesRef.current.push({
        id: idRef.current,
        kind,
        x: fromLeft ? -60 : w + 60,
        y,
        vx: fromLeft ? speed : -speed,
        exitX: fromLeft ? w + 60 : -60,
        held: false,
      });
      t = window.setTimeout(spawn, 1500 + Math.random() * 2000);
    }
    t = window.setTimeout(spawn, 500);
    return () => {
      cancelled = true;
      if (t) clearTimeout(t);
    };
  }, []);

  // Animation + render loop
  useEffect(() => {
    let raf = 0;
    let last = performance.now();
    function frame(now: number) {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      // Step
      const next: CSprite[] = [];
      for (const s of spritesRef.current) {
        if (s.held) {
          next.push(s);
          continue;
        }
        const nx = s.x + s.vx * dt;
        if ((s.vx > 0 && nx > s.exitX) || (s.vx < 0 && nx < s.exitX)) continue;
        next.push({ ...s, x: nx });
      }
      spritesRef.current = next;
      // Render
      const c = canvasRef.current;
      const stage = stageRef.current;
      if (c && stage) {
        const w = stage.clientWidth;
        const h = stage.clientHeight;
        const dpr = window.devicePixelRatio || 1;
        if (c.width !== w * dpr || c.height !== h * dpr) {
          c.width = w * dpr;
          c.height = h * dpr;
          c.style.width = `${w}px`;
          c.style.height = `${h}px`;
        }
        const ctx = c.getContext('2d');
        if (ctx) {
          ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
          ctx.clearRect(0, 0, w, h);
          ctx.font = '14px ui-monospace, JetBrains Mono, monospace';
          ctx.textBaseline = 'top';
          for (const s of next) {
            ctx.fillStyle = SPRITE_TINTS[s.kind];
            ctx.globalAlpha = s.held ? 1 : 0.86;
            ctx.fillText(SPRITE_GLYPHS[s.kind], s.x, s.y);
          }
          ctx.globalAlpha = 1;
        }
      }
      raf = requestAnimationFrame(frame);
    }
    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  }, []);

  // Pointer events on the canvas hit-test against sprite rects.
  function spriteAt(localX: number, localY: number) {
    // Iterate in reverse so topmost-drawn wins.
    for (let i = spritesRef.current.length - 1; i >= 0; i--) {
      const s = spritesRef.current[i];
      if (
        localX >= s.x - 6 &&
        localX <= s.x + 60 + 6 &&
        localY >= s.y - 4 &&
        localY <= s.y + 18 + 4
      )
        return s;
    }
    return null;
  }

  function getLocal(ev: React.PointerEvent) {
    const stage = stageRef.current;
    if (!stage) return null;
    const r = stage.getBoundingClientRect();
    return { x: ev.clientX - r.left, y: ev.clientY - r.top };
  }

  function onPointerDown(ev: React.PointerEvent) {
    const local = getLocal(ev);
    if (!local) return;
    const s = spriteAt(local.x, local.y);
    if (!s) return;
    s.held = true;
    s.x = local.x - 30;
    s.y = local.y - 9;
    heldRef.current = { id: s.id, pointer: ev.pointerId };
    canvasRef.current?.setPointerCapture?.(ev.pointerId);
    ev.preventDefault();
  }
  function onPointerMove(ev: React.PointerEvent) {
    if (!heldRef.current || heldRef.current.pointer !== ev.pointerId) return;
    const local = getLocal(ev);
    if (!local) return;
    const s = spritesRef.current.find((sp) => sp.id === heldRef.current!.id);
    if (!s) return;
    s.x = local.x - 30;
    s.y = local.y - 9;
  }
  function onPointerUp(ev: React.PointerEvent) {
    if (!heldRef.current || heldRef.current.pointer !== ev.pointerId) return;
    const stage = stageRef.current;
    if (!stage) return;
    // Hit-test mailboxes via DOM rects.
    const mailboxes = stage.querySelectorAll<HTMLElement>(
      '[data-mailbox-letter-id]',
    );
    for (const mb of mailboxes) {
      const r = mb.getBoundingClientRect();
      if (
        ev.clientX >= r.left &&
        ev.clientX <= r.right &&
        ev.clientY >= r.top &&
        ev.clientY <= r.bottom
      ) {
        open(mb.dataset.mailboxLetterId!);
        spritesRef.current = spritesRef.current.filter(
          (sp) => sp.id !== heldRef.current!.id,
        );
        heldRef.current = null;
        force((n) => n + 1);
        return;
      }
    }
    const s = spritesRef.current.find((sp) => sp.id === heldRef.current!.id);
    if (s) s.held = false;
    heldRef.current = null;
  }

  return (
    <Stage
      index={10}
      title="canvas sprite, DOM mailbox"
      blurb="Sprite drawn to <canvas> for crisp 60 fps motion. Mailbox stays a DOM button."
      delivered={count}
      onReset={() => {
        reset();
        spritesRef.current = [];
      }}
      stageRef={stageRef}
    >
      <div className="sbs-prose">
        {PROSE_LINES.map((line, i) => (
          <div key={i}>
            <p>{line}</p>
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
        ))}
      </div>
      <canvas
        ref={canvasRef}
        className="sbs-canvas"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        style={{ touchAction: 'none' }}
      />
    </Stage>
  );
}
