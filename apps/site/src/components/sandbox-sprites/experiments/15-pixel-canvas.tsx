import { useEffect, useRef, useState } from 'react';
import {
  Mailbox,
  PROSE_LINES,
  Stage,
  useDelivery,
} from '../shared';
import {
  PIXEL_KINDS,
  getSpriteBitmap,
  type PixelSpriteKind,
} from '../PixelSprite';

// Pixel sprites blitted to a <canvas> via drawImage. Each sprite is
// rendered once to an OffscreenCanvas (in PixelSprite.ts), cached as
// an ImageBitmap, then drawn into the scene each frame. Walk cycle
// runs by swapping bitmaps. DOM mailboxes still work via rect
// hit-test on pointerup.

const LETTERS = ['cid', 'terra'];
const SPRITE_PX = 28; // 14 cells × 2 scale

type CSprite = {
  id: number;
  kind: PixelSpriteKind;
  x: number;
  y: number;
  vx: number;
  exitX: number;
  held: boolean;
  framePhase: number; // ms accumulator for walk cycle
};

export default function Exp15PixelCanvas() {
  const stageRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const spritesRef = useRef<CSprite[]>([]);
  const heldRef = useRef<{ id: number; pointer: number } | null>(null);
  const idRef = useRef(0);
  const bitmapsRef = useRef<Record<string, ImageBitmap>>({});
  const { opened, open, reset, count } = useDelivery(LETTERS);
  const [, force] = useState(0);

  // Preload bitmaps once per kind/frame.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      for (const kind of PIXEL_KINDS) {
        for (const f of [0, 1] as const) {
          if (cancelled) return;
          const bm = await getSpriteBitmap(kind, f, 2);
          bitmapsRef.current[`${kind}:${f}`] = bm;
          force((n) => n + 1);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

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
      const kind =
        PIXEL_KINDS[Math.floor(Math.random() * PIXEL_KINDS.length)];
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
        framePhase: Math.random() * 220,
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
      const next: CSprite[] = [];
      for (const s of spritesRef.current) {
        if (s.held) {
          next.push({ ...s, framePhase: s.framePhase + dt * 1000 });
          continue;
        }
        const nx = s.x + s.vx * dt;
        if ((s.vx > 0 && nx > s.exitX) || (s.vx < 0 && nx < s.exitX)) continue;
        next.push({ ...s, x: nx, framePhase: s.framePhase + dt * 1000 });
      }
      spritesRef.current = next;

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
          ctx.imageSmoothingEnabled = false;
          ctx.clearRect(0, 0, w, h);
          for (const s of next) {
            const f = (Math.floor(s.framePhase / 220) % 2) as 0 | 1;
            const bm = bitmapsRef.current[`${s.kind}:${f}`];
            if (!bm) continue;
            ctx.globalAlpha = s.held ? 1 : 0.92;
            ctx.drawImage(bm, Math.round(s.x), Math.round(s.y));
          }
          ctx.globalAlpha = 1;
        }
      }
      raf = requestAnimationFrame(frame);
    }
    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  }, []);

  function getLocal(ev: React.PointerEvent) {
    const stage = stageRef.current;
    if (!stage) return null;
    const r = stage.getBoundingClientRect();
    return { x: ev.clientX - r.left, y: ev.clientY - r.top };
  }

  function spriteAt(localX: number, localY: number) {
    for (let i = spritesRef.current.length - 1; i >= 0; i--) {
      const s = spritesRef.current[i];
      if (
        localX >= s.x - 4 &&
        localX <= s.x + SPRITE_PX + 4 &&
        localY >= s.y - 4 &&
        localY <= s.y + SPRITE_PX + 4
      )
        return s;
    }
    return null;
  }

  function onPointerDown(ev: React.PointerEvent) {
    const local = getLocal(ev);
    if (!local) return;
    const s = spriteAt(local.x, local.y);
    if (!s) return;
    s.held = true;
    s.x = local.x - SPRITE_PX / 2;
    s.y = local.y - SPRITE_PX / 2;
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
    s.x = local.x - SPRITE_PX / 2;
    s.y = local.y - SPRITE_PX / 2;
  }
  function onPointerUp(ev: React.PointerEvent) {
    if (!heldRef.current || heldRef.current.pointer !== ev.pointerId) return;
    const stage = stageRef.current;
    if (!stage) return;
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
      index={15}
      title="pixel canvas blit"
      blurb="Sprites pre-rendered to ImageBitmaps in an OffscreenCanvas, then blitted via drawImage every frame. Crisp at any DPR, walk-cycle by bitmap swap."
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
