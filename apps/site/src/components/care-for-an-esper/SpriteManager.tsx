import { useEffect, useRef } from 'react';
import { useEsperStore, type EngagementEvent } from './state';
import type { LetterId, SpriteKind } from './letters';
import { getSpriteBitmap, SPRITE_PX } from './PixelSprite';

// The wandering layer. Pixel-art sprites enter at one margin of the
// article, walk across at a random vertical position within the
// reader's current viewport, and exit at the other margin. The
// reader can grab one and drag it onto a mailbox in the prose; on
// drop, the mailbox's letter opens.
//
// Render path: sprites pre-rasterized to ImageBitmaps in an
// OffscreenCanvas (see PixelSprite.tsx), then drawImage'd into a
// viewport-sized <canvas> every frame. Sprite state lives in a ref —
// the rAF loop mutates it directly. React isn't asked to re-render
// per-frame.
//
// Canvas is position: fixed at viewport size. Sprite coords are
// article-local; we translate to viewport-local each frame using
// the article's getBoundingClientRect. This avoids needing a
// canvas big enough to cover the entire (very tall) article — that
// would blow the browser's max canvas size on mobile.
//
// Pointer events: canvas has pointer-events: none so the reader can
// still select text, scroll, click links normally. A document-level
// pointerdown listener hit-tests sprites in viewport space. If a
// sprite is under the pointer we take over the gesture and attach
// document-level pointermove + pointerup until release.

type SpriteId = number;

type Sprite = {
  id: SpriteId;
  kind: SpriteKind;
  /** article-local coords, top-left of the sprite bitmap */
  x: number;
  y: number;
  /** px/sec on the x axis */
  vx: number;
  /** sprite continues until x crosses this; positive vx exits at +exitX */
  exitX: number;
  /** ms accumulator for the walk-cycle */
  framePhase: number;
  /** when set, sprite is being held by this pointer */
  draggedBy: number | null;
};

const KINDS: SpriteKind[] = ['moogle', 'tonberry', 'marlboro', 'cactuar'];

const SPAWN_DELAY_FIRST = 4000;
const SPAWN_DELAY_MIN = 9000;
const SPAWN_DELAY_MAX = 18000;
const SPRITE_SPEED_MIN = 45;
const SPRITE_SPEED_MAX = 95;
const SPRITE_PAD = 80;
const FRAME_MS = 220;

export function SpriteManager() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const spritesRef = useRef<Sprite[]>([]);
  const idRef = useRef(0);
  const bitmapsRef = useRef<Record<string, ImageBitmap>>({});
  const dragRef = useRef<{ id: SpriteId; pointerId: number } | null>(null);
  const recordEvent = useEsperStore((s) => s.recordEvent);

  // ─────── Preload bitmaps ───────
  useEffect(() => {
    let cancelled = false;
    (async () => {
      for (const kind of KINDS) {
        for (const f of [0, 1] as const) {
          if (cancelled) return;
          const bm = await getSpriteBitmap(kind, f);
          bitmapsRef.current[`${kind}:${f}`] = bm;
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // ─────── Spawn loop ───────
  useEffect(() => {
    let timer: number | undefined;
    let cancelled = false;

    function scheduleNext(initial = false) {
      const delay = initial
        ? SPAWN_DELAY_FIRST
        : SPAWN_DELAY_MIN + Math.random() * (SPAWN_DELAY_MAX - SPAWN_DELAY_MIN);
      timer = window.setTimeout(spawn, delay);
    }

    function spawn() {
      if (cancelled) return;
      if (document.visibilityState !== 'visible') {
        scheduleNext();
        return;
      }
      const article = document.querySelector('.cfe-article') as HTMLElement | null;
      if (!article) {
        scheduleNext();
        return;
      }
      const articleRect = article.getBoundingClientRect();
      const articleW = articleRect.width;
      const scrollY = window.scrollY;
      const viewportH = window.innerHeight;
      const articleTopAbs = articleRect.top + scrollY;

      const visibleTop = Math.max(scrollY + 80, articleTopAbs);
      const visibleBottom = Math.min(
        scrollY + viewportH - 80,
        articleTopAbs + article.offsetHeight,
      );
      if (visibleBottom <= visibleTop + 40) {
        scheduleNext();
        return;
      }
      const y = visibleTop + Math.random() * (visibleBottom - visibleTop) - articleTopAbs;

      const fromLeft = Math.random() < 0.5;
      const speed =
        SPRITE_SPEED_MIN + Math.random() * (SPRITE_SPEED_MAX - SPRITE_SPEED_MIN);
      const kind = KINDS[Math.floor(Math.random() * KINDS.length)];

      idRef.current += 1;
      spritesRef.current.push({
        id: idRef.current,
        kind,
        x: fromLeft ? -SPRITE_PAD : articleW + SPRITE_PAD,
        y,
        vx: fromLeft ? speed : -speed,
        exitX: fromLeft ? articleW + SPRITE_PAD : -SPRITE_PAD,
        framePhase: Math.random() * FRAME_MS,
        draggedBy: null,
      });
      scheduleNext();
    }

    scheduleNext(true);
    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, []);

  // ─────── Animation + render loop ───────
  useEffect(() => {
    let raf = 0;
    let last = performance.now();

    function frame(now: number) {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;

      // Step
      const next: Sprite[] = [];
      for (const s of spritesRef.current) {
        const phase = s.framePhase + dt * 1000;
        if (s.draggedBy != null) {
          next.push({ ...s, framePhase: phase });
          continue;
        }
        const nx = s.x + s.vx * dt;
        if ((s.vx > 0 && nx > s.exitX) || (s.vx < 0 && nx < s.exitX)) continue;
        next.push({ ...s, x: nx, framePhase: phase });
      }
      spritesRef.current = next;

      // Render
      const c = canvasRef.current;
      if (c) {
        const w = window.innerWidth;
        const h = window.innerHeight;
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

          const article = document.querySelector('.cfe-article') as HTMLElement | null;
          if (article) {
            const ar = article.getBoundingClientRect();
            for (const s of next) {
              const vx = s.x + ar.left;
              const vy = s.y + ar.top;
              if (vx + SPRITE_PX < 0 || vx > w || vy + SPRITE_PX < 0 || vy > h)
                continue;
              const f = (Math.floor(s.framePhase / FRAME_MS) % 2) as 0 | 1;
              const bm = bitmapsRef.current[`${s.kind}:${f}`];
              if (!bm) continue;
              ctx.globalAlpha = s.draggedBy != null ? 1 : 0.92;
              ctx.drawImage(bm, Math.round(vx), Math.round(vy));
            }
            ctx.globalAlpha = 1;
          }
        }
      }
      raf = requestAnimationFrame(frame);
    }
    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  }, []);

  // ─────── Pointer interaction ───────
  useEffect(() => {
    function articleAt(clientX: number, clientY: number) {
      const article = document.querySelector('.cfe-article') as HTMLElement | null;
      if (!article) return null;
      const r = article.getBoundingClientRect();
      // Allow drag-start anywhere — even outside article — but we
      // only hit-test sprites that overlap the cursor.
      return { article, ax: clientX - r.left, ay: clientY - r.top };
    }

    function spriteUnder(clientX: number, clientY: number): Sprite | null {
      const local = articleAt(clientX, clientY);
      if (!local) return null;
      // Iterate in reverse so topmost-drawn wins (later sprites
      // render later → "on top" visually).
      for (let i = spritesRef.current.length - 1; i >= 0; i--) {
        const s = spritesRef.current[i];
        if (
          local.ax >= s.x - 4 &&
          local.ax <= s.x + SPRITE_PX + 4 &&
          local.ay >= s.y - 4 &&
          local.ay <= s.y + SPRITE_PX + 4
        )
          return s;
      }
      return null;
    }

    function onDown(ev: PointerEvent) {
      // Only primary button drags. Right-click etc. pass through.
      if (ev.button !== 0 && ev.pointerType === 'mouse') return;
      const s = spriteUnder(ev.clientX, ev.clientY);
      if (!s) return;
      // Take over the gesture.
      ev.preventDefault();
      s.draggedBy = ev.pointerId;
      dragRef.current = { id: s.id, pointerId: ev.pointerId };
    }

    function onMove(ev: PointerEvent) {
      if (!dragRef.current || dragRef.current.pointerId !== ev.pointerId) return;
      const local = articleAt(ev.clientX, ev.clientY);
      if (!local) return;
      const s = spritesRef.current.find((sp) => sp.id === dragRef.current!.id);
      if (!s) return;
      s.x = local.ax - SPRITE_PX / 2;
      s.y = local.ay - SPRITE_PX / 2;
    }

    function onUp(ev: PointerEvent) {
      if (!dragRef.current || dragRef.current.pointerId !== ev.pointerId) return;
      const id = dragRef.current.id;
      dragRef.current = null;

      // Hit-test mailbox via elementFromPoint. Canvas has
      // pointer-events: none so we don't need to suppress it.
      let elt: HTMLElement | null = document.elementFromPoint(
        ev.clientX,
        ev.clientY,
      ) as HTMLElement | null;
      while (elt && !elt.dataset?.mailboxLetterId) elt = elt.parentElement;

      if (elt && elt.dataset.mailboxLetterId) {
        const letterId = elt.dataset.mailboxLetterId as LetterId;
        const already = useEsperStore.getState().events.has(
          `letter:${letterId}` as EngagementEvent,
        );
        if (!already) {
          recordEvent(`letter:${letterId}` as EngagementEvent);
          if ('vibrate' in navigator) navigator.vibrate(200);
        }
        spritesRef.current = spritesRef.current.filter((sp) => sp.id !== id);
        return;
      }

      // No drop target — sprite resumes wandering.
      const s = spritesRef.current.find((sp) => sp.id === id);
      if (s) s.draggedBy = null;
    }

    document.addEventListener('pointerdown', onDown);
    document.addEventListener('pointermove', onMove);
    document.addEventListener('pointerup', onUp);
    document.addEventListener('pointercancel', onUp);
    return () => {
      document.removeEventListener('pointerdown', onDown);
      document.removeEventListener('pointermove', onMove);
      document.removeEventListener('pointerup', onUp);
      document.removeEventListener('pointercancel', onUp);
    };
  }, [recordEvent]);

  return (
    <canvas
      ref={canvasRef}
      className="cfe-sprite-canvas"
      aria-hidden="true"
    />
  );
}
