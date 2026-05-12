import { useEffect, useRef, useState } from 'react';
import { useEsperStore } from './state';
import type { LetterId, SpriteKind } from './letters';

// The wandering layer. Pixel-art GIF sprites enter at one margin of
// the article, walk across at a random vertical position within the
// reader's current viewport, exit at the other margin. The reader
// can grab one and drag it onto a mailbox in the prose; on drop,
// the SpriteManager calls `dropOnMailbox`, which opens the mailbox's
// home letter on first hit and a random unread letter thereafter.
//
// Render path: each active sprite is a DOM <img>. The rAF loop
// updates each img's transform every frame; React re-renders only
// when the live set of sprites changes (spawn / exit / delivery).
// GIFs animate natively (no manual frame stepping).
//
// The layer paints in front of text (z-index above the article) so
// pointer events on the img Just Work. Direct setPointerCapture on
// the img keeps the gesture alive when the pointer leaves the
// sprite.

type SpriteId = number;

const SPRITES: Record<
  Exclude<SpriteKind, 'chocobo'>,
  { src: string; w: number; h: number }
> = {
  mog: { src: '/sprites/mog-walk.gif', w: 32, h: 44 },
};

// Pixel sprites are small natively; render at 1× (half the size of the
// first wandering pass). Small enough to feel ambient, big enough to grab.
const SCALE = 1;

type WanderKind = keyof typeof SPRITES;

type Sprite = {
  id: SpriteId;
  kind: WanderKind;
  /** article-local coords, top-left of the sprite */
  x: number;
  y: number;
  /** px/sec on the x axis; sign also controls horizontal flip */
  vx: number;
  /** sprite continues until x crosses this; positive vx exits at +exitX */
  exitX: number;
  /** when set, sprite is being held by this pointer */
  draggedBy: number | null;
};

const KINDS: WanderKind[] = ['mog'];

const SPAWN_DELAY_FIRST = 4000;
const SPAWN_DELAY_MIN = 9000;
const SPAWN_DELAY_MAX = 18000;
const SPRITE_SPEED_MIN = 45;
const SPRITE_SPEED_MAX = 95;
const SPRITE_PAD = 80;

export function SpriteManager() {
  const spritesRef = useRef<Sprite[]>([]);
  const idRef = useRef(0);
  const dragRef = useRef<{ id: SpriteId; pointerId: number } | null>(null);
  const elRefs = useRef<Map<SpriteId, HTMLImageElement>>(new Map());
  const lastSyncedIds = useRef<SpriteId[]>([]);
  const [spriteIds, setSpriteIds] = useState<SpriteId[]>([]);
  const dropOnMailbox = useEsperStore((s) => s.dropOnMailbox);

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
      const def = SPRITES[kind];

      idRef.current += 1;
      spritesRef.current.push({
        id: idRef.current,
        kind,
        x: fromLeft ? -SPRITE_PAD : articleW + SPRITE_PAD,
        y,
        vx: fromLeft ? speed : -speed,
        exitX: fromLeft
          ? articleW + SPRITE_PAD
          : -SPRITE_PAD - def.w * SCALE,
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

  // ─────── Step + transform-write loop ───────
  useEffect(() => {
    let raf = 0;
    let last = performance.now();

    function frame(now: number) {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;

      let removed = false;
      const next: Sprite[] = [];
      for (const s of spritesRef.current) {
        if (s.draggedBy != null) {
          next.push(s);
          continue;
        }
        const nx = s.x + s.vx * dt;
        if ((s.vx > 0 && nx > s.exitX) || (s.vx < 0 && nx < s.exitX)) {
          removed = true;
          continue;
        }
        s.x = nx;
        next.push(s);
      }
      spritesRef.current = next;
      if (removed) syncIds();

      const article = document.querySelector('.cfe-article') as HTMLElement | null;
      let articleLeft = 0;
      let articleTop = 0;
      if (article) {
        const ar = article.getBoundingClientRect();
        articleLeft = ar.left;
        articleTop = ar.top;
      }

      for (const s of next) {
        const el = elRefs.current.get(s.id);
        if (!el) continue;
        const vx = s.x + articleLeft;
        const vy = s.y + articleTop;
        // GIFs are drawn facing left; flip when traveling right.
        const flip = s.vx > 0 ? -1 : 1;
        el.style.transform = `translate3d(${Math.round(vx)}px, ${Math.round(vy)}px, 0) scaleX(${flip})`;
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
    const def = SPRITES[s.kind];
    s.x = ev.clientX - r.left - (def.w * SCALE) / 2;
    s.y = ev.clientY - r.top - (def.h * SCALE) / 2;
  }

  function onPointerUp(spriteId: SpriteId, ev: React.PointerEvent) {
    if (!dragRef.current || dragRef.current.pointerId !== ev.pointerId) return;
    if (dragRef.current.id !== spriteId) return;
    dragRef.current = null;

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
      const home = elt.dataset.mailboxLetterId as LetterId;
      const before = useEsperStore.getState().mailboxLetters[home];
      dropOnMailbox(home);
      const after = useEsperStore.getState().mailboxLetters[home];
      if (!before && after && 'vibrate' in navigator) navigator.vibrate(200);
      spritesRef.current = spritesRef.current.filter((sp) => sp.id !== spriteId);
      syncIds();
      return;
    }

    const s = spritesRef.current.find((sp) => sp.id === spriteId);
    if (s) s.draggedBy = null;
  }

  return (
    <div className="cfe-sprite-layer" aria-hidden="true">
      {spriteIds.map((id) => {
        const s = spritesRef.current.find((sp) => sp.id === id);
        if (!s) return null;
        const def = SPRITES[s.kind];
        return (
          <img
            key={id}
            src={def.src}
            alt=""
            draggable={false}
            className={`cfe-sprite cfe-sprite-${s.kind}`}
            ref={(el) => {
              if (el) elRefs.current.set(id, el);
              else elRefs.current.delete(id);
            }}
            style={{
              width: `${def.w * SCALE}px`,
              height: `${def.h * SCALE}px`,
            }}
            onPointerDown={(ev) => onPointerDown(id, ev)}
            onPointerMove={(ev) => onPointerMove(id, ev)}
            onPointerUp={(ev) => onPointerUp(id, ev)}
            onPointerCancel={(ev) => onPointerUp(id, ev)}
          />
        );
      })}
    </div>
  );
}
