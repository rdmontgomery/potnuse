import { useEffect, useMemo, useRef, useState } from 'react';
import {
  prepareRichInline,
  walkRichInlineLineRanges,
  materializeRichInlineLineRange,
  type RichInlineItem,
} from '@chenglou/pretext/rich-inline';
import {
  findMailboxAt,
  Mailbox,
  PROSE_LINES,
  SPRITE_GLYPHS,
  Stage,
  useDelivery,
  useWalkingSprites,
} from '../shared';

// @chenglou/pretext lays out the prose so we know the (x, y, width)
// of every word fragment. The wandering sprite's position then drives
// a per-word spring offset — words near it lean away and snap back.
//
// pretext gives us layout (line breaks, segment widths) without
// touching the DOM. We render words as absolutely-positioned spans
// using those coordinates, so we control transforms freely.

const LETTERS = ['cid', 'terra'];

const FONT = '14px ui-monospace, JetBrains Mono, monospace';
const LINE_HEIGHT = 22;

const PARAGRAPHS = PROSE_LINES;

type WordSpan = {
  text: string;
  x: number;
  y: number;
  w: number;
};

// Spring constants — same family as react-motion defaults but quick
// (we want the snap-back to feel crisp, not gummy).
const STIFFNESS = 220;
const DAMPING = 22;
const PUSH_RADIUS = 70;
const PUSH_STRENGTH = 30;

export default function Exp08PretextWords() {
  const stageRef = useRef<HTMLDivElement | null>(null);
  const proseRef = useRef<HTMLDivElement | null>(null);
  const { sprites, setSprites } = useWalkingSprites(stageRef, {
    spritePad: 40,
  });
  const { opened, open, reset, count } = useDelivery(LETTERS);

  // Lay out the prose with pretext when the stage size is known.
  const [layout, setLayout] = useState<{ words: WordSpan[]; height: number }>({
    words: [],
    height: 0,
  });

  // Build pretext items: each paragraph's words become RichInlineItems
  // with a trailing space. We use 'item index' as a paragraph marker
  // by emitting a 'pilcrow' item that breaks to a new line.
  const items: { items: RichInlineItem[]; words: string[]; paraOf: number[] } = useMemo(() => {
    const items: RichInlineItem[] = [];
    const words: string[] = [];
    const paraOf: number[] = [];
    PARAGRAPHS.forEach((p, pi) => {
      const split = p.split(/\s+/).filter(Boolean);
      split.forEach((w, wi) => {
        const trail = wi === split.length - 1 ? '' : ' ';
        items.push({ text: w + trail, font: FONT });
        words.push(w);
        paraOf.push(pi);
      });
      // Force a hard break between paragraphs by injecting a wide
      // unbreakable item — pretext will wrap. Cheaper to render
      // paragraphs as separate prepared instances, but this keeps
      // the layout pass single.
      if (pi < PARAGRAPHS.length - 1) {
        items.push({ text: ' ', font: FONT, break: 'normal' });
        // marker word
        words.push(' ');
        paraOf.push(-1);
      }
    });
    return { items, words, paraOf };
  }, []);

  useEffect(() => {
    function relayout() {
      const stage = stageRef.current;
      const prose = proseRef.current;
      if (!stage || !prose) return;
      const w = prose.clientWidth;
      if (w < 50) return;
      const prepared = prepareRichInline(items.items);
      const out: WordSpan[] = [];
      let y = 0;
      walkRichInlineLineRanges(prepared, w, (range) => {
        const line = materializeRichInlineLineRange(prepared, range);
        let cursorX = 0;
        for (const frag of line.fragments) {
          cursorX += frag.gapBefore;
          if (frag.text.trim().length > 0) {
            out.push({
              text: frag.text,
              x: cursorX,
              y: y,
              w: frag.occupiedWidth,
            });
          }
          cursorX += frag.occupiedWidth;
        }
        y += LINE_HEIGHT;
      });
      setLayout({ words: out, height: y });
    }
    relayout();
    const ro = new ResizeObserver(relayout);
    if (proseRef.current) ro.observe(proseRef.current);
    return () => ro.disconnect();
  }, [items]);

  // Per-word spring state. Uses refs so we don't re-render React on
  // every spring tick — instead we mutate transforms via DOM.
  const wordRefs = useRef<Array<HTMLSpanElement | null>>([]);
  const offsetRef = useRef<Array<{ ox: number; oy: number; vx: number; vy: number }>>([]);

  useEffect(() => {
    offsetRef.current = layout.words.map(() => ({ ox: 0, oy: 0, vx: 0, vy: 0 }));
    wordRefs.current = layout.words.map(() => null);
  }, [layout.words.length]);

  // Drive springs at 60 fps based on current sprite positions.
  useEffect(() => {
    let raf = 0;
    let last = performance.now();
    function step(now: number) {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      const offsets = offsetRef.current;
      const words = layout.words;
      for (let i = 0; i < words.length; i++) {
        const w = words[i];
        const wcx = w.x + w.w / 2;
        const wcy = w.y + LINE_HEIGHT / 2;
        // Find the closest sprite center
        let tx = 0;
        let ty = 0;
        for (const s of sprites) {
          if (s.state === 'held') continue;
          const sx = s.x + 30;
          const sy = s.y + 12;
          const dx = wcx - sx;
          const dy = wcy - sy;
          const d = Math.hypot(dx, dy);
          if (d < PUSH_RADIUS && d > 0.1) {
            const fall = 1 - d / PUSH_RADIUS;
            tx += (dx / d) * fall * PUSH_STRENGTH;
            ty += (dy / d) * fall * PUSH_STRENGTH * 0.6;
          }
        }
        const o = offsets[i];
        if (!o) continue;
        // Spring toward (tx, ty)
        const ax = (tx - o.ox) * STIFFNESS - o.vx * DAMPING;
        const ay = (ty - o.oy) * STIFFNESS - o.vy * DAMPING;
        o.vx += ax * dt;
        o.vy += ay * dt;
        o.ox += o.vx * dt;
        o.oy += o.vy * dt;
        const node = wordRefs.current[i];
        if (node) {
          node.style.transform = `translate3d(${o.ox.toFixed(2)}px, ${o.oy.toFixed(2)}px, 0)`;
        }
      }
      raf = requestAnimationFrame(step);
    }
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [layout.words, sprites]);

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

  // Mailbox positions are anchored after the layout stops — pick
  // y-positions that land in gaps between paragraphs.
  // For simplicity we render the mailboxes at fixed offsets within
  // the laid-out region.
  const mbY1 = LINE_HEIGHT * 2 + 6;
  const mbY2 = layout.height - LINE_HEIGHT - 6;

  return (
    <Stage
      index={8}
      title="pretext word-push"
      blurb="Words placed by @chenglou/pretext. The sprite pushes them aside; springs snap them back."
      delivered={count}
      onReset={() => {
        reset();
        setSprites([]);
      }}
      stageRef={stageRef}
    >
      <div
        ref={proseRef}
        className="sbs-prose sbs-prose-pretext"
        style={{ height: layout.height || LINE_HEIGHT * 14 }}
      >
        {layout.words.map((w, i) => (
          <span
            key={i}
            ref={(el) => {
              wordRefs.current[i] = el;
            }}
            className="sbs-word"
            style={{
              left: `${w.x}px`,
              top: `${w.y}px`,
              width: `${w.w}px`,
              lineHeight: `${LINE_HEIGHT}px`,
              fontFamily: 'ui-monospace, JetBrains Mono, monospace',
              fontSize: '14px',
            }}
          >
            {w.text}
          </span>
        ))}
        <div
          className="sbs-mb-row"
          style={{ position: 'absolute', left: 0, right: 0, top: mbY1 }}
        >
          <Mailbox letterId="cid" opened={opened.has('cid')} />
        </div>
        <div
          className="sbs-mb-row"
          style={{ position: 'absolute', left: 0, right: 0, top: mbY2 }}
        >
          <Mailbox letterId="terra" opened={opened.has('terra')} />
        </div>
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
