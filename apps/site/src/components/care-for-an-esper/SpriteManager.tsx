import { useEffect, useRef, useState } from 'react';
import { useEsperStore, type EngagementEvent } from './state';
import type { LetterId, SpriteKind } from './letters';

// The wandering layer. Sprites enter at one margin of the article,
// walk slowly across at a random vertical position, exit at the
// other margin. The reader can grab one and drag it onto a mailbox
// inline in the prose; on drop, the mailbox's letter opens.
//
// Sprites are absolutely positioned over the article column, above
// the prose in z-index. They visually walk through the words. The
// article itself is position:relative so sprite coordinates are
// article-local.
//
// Touch parity: handled via Pointer Events with explicit
// setPointerCapture, so a single drag gesture is uniform across
// mouse, pen, and touch.

type SpriteId = number;

type Sprite = {
  id: SpriteId;
  kind: SpriteKind;
  /** article-local coords, top-left corner of sprite glyph */
  x: number;
  y: number;
  /** px/sec on the x axis. y is fixed for the whole traverse. */
  vx: number;
  /** sprite continues until x crosses this; positive vx exits at +exitX */
  exitX: number;
  /** when set, sprite is being dragged; auto-walk paused */
  draggedBy: number | null;
};

const KINDS: SpriteKind[] = ['moogle', 'tonberry', 'marlboro', 'cactuar'];

// Hand-picked ASCII so each kind reads as itself at a glance:
// moogle = pompom critter, tonberry = robed thing with a knife,
// marlboro = tentacled mass, cactuar = vibrating spike.
const SPRITE_GLYPHS: Record<SpriteKind, string> = {
  moogle: '\\(•◡•)/',
  tonberry: '(•_•)†',
  marlboro: ')(◑◡◐)(',
  cactuar: '<I_I>',
  chocobo: '⌒(•ㅅ•)⌒',
};

const SPAWN_DELAY_FIRST = 4000;
const SPAWN_DELAY_MIN = 9000;
const SPAWN_DELAY_MAX = 18000;
const SPRITE_SPEED_MIN = 45;
const SPRITE_SPEED_MAX = 95;
const SPRITE_PAD = 80; // start/exit offset beyond article edge

export function SpriteManager() {
  const [sprites, setSprites] = useState<Sprite[]>([]);
  const idRef = useRef(0);
  const lastTickRef = useRef<number>(performance.now());
  const recordEvent = useEsperStore((s) => s.recordEvent);

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
      // Pause spawning when the tab is hidden — sprites that arrive
      // while the reader is elsewhere just clutter on return.
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

      // Visible Y range, clamped to article bounds
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
      setSprites((s) => [
        ...s,
        {
          id: idRef.current,
          kind,
          x: fromLeft ? -SPRITE_PAD : articleW + SPRITE_PAD,
          y,
          vx: fromLeft ? speed : -speed,
          exitX: fromLeft ? articleW + SPRITE_PAD : -SPRITE_PAD,
          draggedBy: null,
        },
      ]);
      scheduleNext();
    }

    scheduleNext(true);
    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, []);

  // ─────── Animation tick ───────
  useEffect(() => {
    let raf = 0;
    function tick(now: number) {
      const dt = Math.min(0.05, (now - lastTickRef.current) / 1000);
      lastTickRef.current = now;
      setSprites((curr) =>
        curr.flatMap((s) => {
          if (s.draggedBy != null) return [s];
          const nx = s.x + s.vx * dt;
          if ((s.vx > 0 && nx > s.exitX) || (s.vx < 0 && nx < s.exitX)) return [];
          return [{ ...s, x: nx }];
        }),
      );
      raf = requestAnimationFrame(tick);
    }
    lastTickRef.current = performance.now();
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);

  // ─────── Drag handlers ───────
  function articleLocal(ev: React.PointerEvent): { x: number; y: number } | null {
    const article = document.querySelector('.cfe-article') as HTMLElement | null;
    if (!article) return null;
    const r = article.getBoundingClientRect();
    return { x: ev.clientX - r.left, y: ev.clientY - r.top };
  }

  function onPointerDown(spriteId: SpriteId, ev: React.PointerEvent) {
    (ev.target as Element).setPointerCapture?.(ev.pointerId);
    setSprites((s) =>
      s.map((sp) =>
        sp.id === spriteId ? { ...sp, draggedBy: ev.pointerId } : sp,
      ),
    );
    ev.preventDefault();
  }

  function onPointerMove(spriteId: SpriteId, ev: React.PointerEvent) {
    const local = articleLocal(ev);
    if (!local) return;
    setSprites((s) =>
      s.map((sp) =>
        sp.id === spriteId && sp.draggedBy === ev.pointerId
          ? { ...sp, x: local.x - 30, y: local.y - 12 }
          : sp,
      ),
    );
  }

  function onPointerUp(spriteId: SpriteId, ev: React.PointerEvent) {
    // Hit-test: walk ancestors of the element under the pointer
    // looking for [data-mailbox-letter-id]. Need to temporarily
    // hide the sprite from the hit-test or it'll always 'drop on
    // itself' — quickest way is pointer-events:none on the sprite
    // during the up handler.
    const target = ev.currentTarget as HTMLElement;
    target.style.pointerEvents = 'none';
    const elt = document.elementFromPoint(ev.clientX, ev.clientY);
    target.style.pointerEvents = '';
    let mb: HTMLElement | null = elt as HTMLElement | null;
    while (mb && !mb.dataset?.mailboxLetterId) mb = mb.parentElement;

    if (mb && mb.dataset.mailboxLetterId) {
      const letterId = mb.dataset.mailboxLetterId as LetterId;
      // Only fire if not already opened.
      const already = useEsperStore.getState().events.has(
        `letter:${letterId}` as EngagementEvent,
      );
      if (!already) {
        recordEvent(`letter:${letterId}` as EngagementEvent);
        if ('vibrate' in navigator) navigator.vibrate(200);
      }
      setSprites((s) => s.filter((sp) => sp.id !== spriteId));
      return;
    }
    // No drop target — sprite resumes wandering from where it was let go.
    setSprites((s) =>
      s.map((sp) =>
        sp.id === spriteId ? { ...sp, draggedBy: null } : sp,
      ),
    );
  }

  return (
    <div className="cfe-sprites" aria-hidden="true">
      {sprites.map((s) => (
        <div
          key={s.id}
          className={`cfe-sprite cfe-sprite-${s.kind}${
            s.draggedBy != null ? ' is-dragged' : ''
          }`}
          style={{ transform: `translate3d(${s.x}px, ${s.y}px, 0)` }}
          onPointerDown={(ev) => onPointerDown(s.id, ev)}
          onPointerMove={(ev) => onPointerMove(s.id, ev)}
          onPointerUp={(ev) => onPointerUp(s.id, ev)}
          onPointerCancel={(ev) => onPointerUp(s.id, ev)}
        >
          {SPRITE_GLYPHS[s.kind]}
        </div>
      ))}
    </div>
  );
}
