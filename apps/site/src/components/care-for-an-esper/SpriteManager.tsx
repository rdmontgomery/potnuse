import { useEffect, useRef, useState } from 'react';
import { useEsperStore, type EngagementEvent } from './state';
import type { LetterId, SpriteKind } from './letters';
import { getSpriteBitmap, SPRITE_PX } from './PixelSprite';

// The wandering layer. Pixel-art sprites enter at one margin of the
// article, walk across at a random vertical position within the
// reader's current viewport, exit at the other margin. The reader
// can grab one and drag it onto a mailbox in the prose; on drop,
// the mailbox's letter opens.
//
// Render path: sprites pre-rasterized to ImageBitmaps in an
// OffscreenCanvas (see PixelSprite.tsx), then drawImage'd into a
// viewport-sized <canvas> every frame. Sprite state lives in a ref
// — the rAF loop mutates it directly. React isn't asked to
// re-render per-frame.
//
// Canvas is position: fixed at viewport size. Sprite coords are
// article-local; we translate to viewport-local each frame using
// the article's getBoundingClientRect. This avoids needing a
// canvas big enough to cover the entire (very tall) article — that
// would blow Safari's max canvas size on mobile.
//
// Pointer events: the canvas itself is pointer-events: none so the
// reader can still select text, scroll, click links normally. Each
// active sprite has a tiny invisible DOM hitbox positioned over it
// — those carry pointer-events: auto + touch-action: none, and use
// setPointerCapture so the gesture survives leaving the hitbox.
// The hitboxes are React-managed but their transforms are written
// imperatively from the rAF loop so React doesn't re-render at 60
// fps.

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

// Hitbox is bigger than the bitmap so a thumb can land on it
// reliably. Padding is added on every side.
const HIT_PADDING = 12;
const HIT_PX = SPRITE_PX + HIT_PADDING * 2;

export function SpriteManager() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const spritesRef = useRef<Sprite[]>([]);
  const idRef = useRef(0);
  const bitmapsRef = useRef<Record<string, ImageBitmap>>({});
  const dragRef = useRef<{ id: SpriteId; pointerId: number } | null>(null);
  const hitboxRefs = useRef<Map<SpriteId, HTMLDivElement>>(new Map());
  const lastSyncedIds = useRef<SpriteId[]>([]);
  const [spriteIds, setSpriteIds] = useState<SpriteId[]>([]);
  const recordEvent = useEsperStore((s) => s.recordEvent);

  // Sync the React id list with whatever's in spritesRef.current.
  // Called whenever the live set changes (spawn / exit / delivery).
  function syncIds() {
    const current = spritesRef.current.map((s) => s.id);
    const last = lastSyncedIds.current;
    if (
      current.length !== last.length ||
      current.some((id, i) => id !== last[i])
    ) {
      lastSyncedIds.current = current;
      setSpriteIds(current);
    }
  }

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
      syncIds();
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
      let removed = false;
      const next: Sprite[] = [];
      for (const s of spritesRef.current) {
        const phase = s.framePhase + dt * 1000;
        if (s.draggedBy != null) {
          next.push({ ...s, framePhase: phase });
          continue;
        }
        const nx = s.x + s.vx * dt;
        if ((s.vx > 0 && nx > s.exitX) || (s.vx < 0 && nx < s.exitX)) {
          removed = true;
          continue;
        }
        next.push({ ...s, x: nx, framePhase: phase });
      }
      spritesRef.current = next;
      if (removed) syncIds();

      // Render canvas
      const c = canvasRef.current;
      const article = document.querySelector('.cfe-article') as HTMLElement | null;
      let articleLeft = 0;
      let articleTop = 0;
      if (article) {
        const ar = article.getBoundingClientRect();
        articleLeft = ar.left;
        articleTop = ar.top;
      }
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
          for (const s of next) {
            const vx = s.x + articleLeft;
            const vy = s.y + articleTop;
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

      // Update each hitbox's transform to ride its sprite.
      for (const s of next) {
        const el = hitboxRefs.current.get(s.id);
        if (!el) continue;
        const vx = s.x + articleLeft - HIT_PADDING;
        const vy = s.y + articleTop - HIT_PADDING;
        el.style.transform = `translate3d(${Math.round(vx)}px, ${Math.round(vy)}px, 0)`;
      }

      raf = requestAnimationFrame(frame);
    }
    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  }, []);

  // ─────── Drag handlers ───────

  function onPointerDown(spriteId: SpriteId, ev: React.PointerEvent) {
    const s = spritesRef.current.find((sp) => sp.id === spriteId);
    if (!s) return;
    (ev.currentTarget as Element).setPointerCapture?.(ev.pointerId);
    s.draggedBy = ev.pointerId;
    dragRef.current = { id: spriteId, pointerId: ev.pointerId };
    ev.preventDefault();
  }

  function onPointerMove(spriteId: SpriteId, ev: React.PointerEvent) {
    if (!dragRef.current || dragRef.current.pointerId !== ev.pointerId) return;
    if (dragRef.current.id !== spriteId) return;
    const article = document.querySelector('.cfe-article') as HTMLElement | null;
    if (!article) return;
    const r = article.getBoundingClientRect();
    const s = spritesRef.current.find((sp) => sp.id === spriteId);
    if (!s) return;
    s.x = ev.clientX - r.left - SPRITE_PX / 2;
    s.y = ev.clientY - r.top - SPRITE_PX / 2;
  }

  function onPointerUp(spriteId: SpriteId, ev: React.PointerEvent) {
    if (!dragRef.current || dragRef.current.pointerId !== ev.pointerId) return;
    if (dragRef.current.id !== spriteId) return;
    dragRef.current = null;

    // Hit-test mailbox via elementFromPoint. The hitbox carries
    // pointer-events: auto, but elementFromPoint walks the visual
    // stack — we need to suppress the hitbox itself momentarily so
    // it doesn't always claim the drop.
    const target = ev.currentTarget as HTMLElement;
    const prevPe = target.style.pointerEvents;
    target.style.pointerEvents = 'none';
    let elt: HTMLElement | null = document.elementFromPoint(
      ev.clientX,
      ev.clientY,
    ) as HTMLElement | null;
    target.style.pointerEvents = prevPe;
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
      spritesRef.current = spritesRef.current.filter((sp) => sp.id !== spriteId);
      syncIds();
      return;
    }

    // No drop target — sprite resumes wandering.
    const s = spritesRef.current.find((sp) => sp.id === spriteId);
    if (s) s.draggedBy = null;
  }

  return (
    <>
      <canvas
        ref={canvasRef}
        className="cfe-sprite-canvas"
        aria-hidden="true"
      />
      <div className="cfe-sprite-hits" aria-hidden="true">
        {spriteIds.map((id) => (
          <div
            key={id}
            className="cfe-sprite-hit"
            ref={(el) => {
              if (el) hitboxRefs.current.set(id, el);
              else hitboxRefs.current.delete(id);
            }}
            style={{ width: `${HIT_PX}px`, height: `${HIT_PX}px` }}
            onPointerDown={(ev) => onPointerDown(id, ev)}
            onPointerMove={(ev) => onPointerMove(id, ev)}
            onPointerUp={(ev) => onPointerUp(id, ev)}
            onPointerCancel={(ev) => onPointerUp(id, ev)}
          />
        ))}
      </div>
    </>
  );
}
