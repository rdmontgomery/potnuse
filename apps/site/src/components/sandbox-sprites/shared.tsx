import {
  forwardRef,
  useCallback,
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from 'react';

export type SpriteKind = 'moogle' | 'tonberry' | 'marlboro' | 'cactuar';

export const SPRITE_KINDS: SpriteKind[] = [
  'moogle',
  'tonberry',
  'marlboro',
  'cactuar',
];

export const SPRITE_GLYPHS: Record<SpriteKind, string> = {
  moogle: '\\(•◡•)/',
  tonberry: '(•_•)†',
  marlboro: ')(◑◡◐)(',
  cactuar: '<I_I>',
};

export const SPRITE_TINTS: Record<SpriteKind, string> = {
  moogle: '#5a4a2c',
  tonberry: '#44503a',
  marlboro: '#5d3a3a',
  cactuar: '#3a5040',
};

export const PROSE_LINES = [
  'The horse is the example. A thousand pounds of obedience and inclination, fed and shod and worried over.',
  'A device gives you commodity without burden — heat without splitting wood, music without the band in the room.',
  'A focal practice gives you the burden back, on purpose. Not nostalgia: the chocobo only kwehs if you bring greens.',
  'Drag the wandering thing into the box. Or tap. Or hold. Try them all and feel which one you trust on the first attempt.',
];

// Stable seed per stage so each experiment gets the same "scene"
let seedCounter = 0;
export function nextStageSeed() {
  seedCounter += 1;
  return seedCounter;
}

// ──────────────── Mailbox ────────────────

type MailboxProps = {
  letterId: string;
  opened: boolean;
  highlighted?: boolean;
  onActivate?: () => void;
  style?: CSSProperties;
};

export const Mailbox = forwardRef<HTMLButtonElement, MailboxProps>(
  function Mailbox({ letterId, opened, highlighted, onActivate, style }, ref) {
    return (
      <button
        ref={ref}
        type="button"
        className={
          'sbs-mailbox' +
          (opened ? ' is-open' : '') +
          (highlighted ? ' is-target' : '')
        }
        data-mailbox-letter-id={letterId}
        data-sbs-mailbox
        aria-pressed={opened}
        onClick={onActivate}
        style={style}
      >
        {opened ? '[ ✉  open ]' : '[ ✉ ]'}
      </button>
    );
  },
);

// ──────────────── Stage card wrapper ────────────────

export function Stage({
  index,
  title,
  blurb,
  notes,
  children,
  delivered,
  onReset,
  stageRef,
}: {
  index: number;
  title: string;
  blurb: string;
  notes?: ReactNode;
  delivered: number;
  onReset: () => void;
  stageRef: React.RefObject<HTMLDivElement | null>;
  children: ReactNode;
}) {
  return (
    <section className="sbs-card" id={`exp-${index}`}>
      <header className="sbs-card-head">
        <span className="sbs-card-num">№{String(index).padStart(2, '0')}</span>
        <h2 className="sbs-card-title">{title}</h2>
        <span className="sbs-card-stat">delivered: {delivered}</span>
        <button type="button" className="sbs-reset" onClick={onReset}>
          reset
        </button>
      </header>
      <p className="sbs-card-blurb">{blurb}</p>
      {notes && <div className="sbs-card-notes">{notes}</div>}
      <div className="sbs-stage" ref={stageRef} data-sbs-stage>
        {children}
      </div>
    </section>
  );
}

// ──────────────── Prose stub ────────────────

export function StageProse({
  mailboxes,
}: {
  mailboxes: Array<{ id: string; afterLine: number; node: ReactNode }>;
}) {
  return (
    <div className="sbs-prose">
      {PROSE_LINES.map((line, i) => {
        const after = mailboxes.filter((m) => m.afterLine === i);
        return (
          <div key={i}>
            <p>{line}</p>
            {after.map((m) => (
              <div key={m.id} className="sbs-mb-row">
                {m.node}
              </div>
            ))}
          </div>
        );
      })}
    </div>
  );
}

// ──────────────── Walking sprite hook ────────────────
//
// Spawns sprites that slide horizontally across the stage at random
// y. Returns the live list + a setter for variant code that needs to
// mutate (drag, divert, etc.). Each spawned sprite lives until x
// crosses its exitX or it is consumed.

export type WalkingSprite = {
  id: number;
  kind: SpriteKind;
  x: number;
  y: number;
  vx: number;
  exitX: number;
  state: 'walking' | 'held' | 'targeted';
};

export function useWalkingSprites(
  stageRef: React.RefObject<HTMLDivElement | null>,
  opts: {
    spawnEveryMs?: [number, number];
    speed?: [number, number];
    spritePad?: number;
    enabled?: boolean;
  } = {},
) {
  const {
    spawnEveryMs = [1500, 3500],
    speed = [40, 90],
    spritePad = 60,
    enabled = true,
  } = opts;
  const [sprites, setSprites] = useState<WalkingSprite[]>([]);
  const idRef = useRef(0);
  const lastTickRef = useRef(performance.now());

  // Spawn loop
  useEffect(() => {
    if (!enabled) return;
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
      if (w < 50 || h < 50) {
        t = window.setTimeout(spawn, 800);
        return;
      }
      const fromLeft = Math.random() < 0.5;
      const sp = speed[0] + Math.random() * (speed[1] - speed[0]);
      const kind =
        SPRITE_KINDS[Math.floor(Math.random() * SPRITE_KINDS.length)];
      const y = 30 + Math.random() * Math.max(20, h - 80);
      idRef.current += 1;
      setSprites((curr) => [
        ...curr,
        {
          id: idRef.current,
          kind,
          x: fromLeft ? -spritePad : w + spritePad,
          y,
          vx: fromLeft ? sp : -sp,
          exitX: fromLeft ? w + spritePad : -spritePad,
          state: 'walking',
        },
      ]);
      const next =
        spawnEveryMs[0] + Math.random() * (spawnEveryMs[1] - spawnEveryMs[0]);
      t = window.setTimeout(spawn, next);
    }
    t = window.setTimeout(spawn, 500);
    return () => {
      cancelled = true;
      if (t) clearTimeout(t);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled]);

  // Animation tick
  useEffect(() => {
    let raf = 0;
    function tick(now: number) {
      const dt = Math.min(0.05, (now - lastTickRef.current) / 1000);
      lastTickRef.current = now;
      setSprites((curr) =>
        curr.flatMap((s) => {
          if (s.state !== 'walking') return [s];
          const nx = s.x + s.vx * dt;
          if ((s.vx > 0 && nx > s.exitX) || (s.vx < 0 && nx < s.exitX))
            return [];
          return [{ ...s, x: nx }];
        }),
      );
      raf = requestAnimationFrame(tick);
    }
    lastTickRef.current = performance.now();
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);

  const clear = useCallback(() => setSprites([]), []);

  return { sprites, setSprites, clear };
}

// ──────────────── Mailbox hit-test helper ────────────────
// Find the [data-mailbox-letter-id] element under a client-coords
// point, scoped to a stage container.

export function findMailboxAt(
  stage: HTMLElement | null,
  clientX: number,
  clientY: number,
  ignore?: HTMLElement,
): HTMLElement | null {
  if (!stage) return null;
  const prevPe = ignore?.style.pointerEvents;
  if (ignore) ignore.style.pointerEvents = 'none';
  const elt = document.elementFromPoint(clientX, clientY);
  if (ignore) ignore.style.pointerEvents = prevPe ?? '';
  let cur: HTMLElement | null = elt as HTMLElement | null;
  while (cur && cur !== stage && !cur.dataset?.mailboxLetterId)
    cur = cur.parentElement;
  return cur && cur.dataset?.mailboxLetterId ? cur : null;
}

// ──────────────── Per-stage delivery counter ────────────────

export function useDelivery(initialKeys: string[]) {
  const [opened, setOpened] = useState<Set<string>>(() => new Set());
  const open = useCallback(
    (id: string) => {
      if (!initialKeys.includes(id)) return;
      setOpened((s) => {
        if (s.has(id)) return s;
        const next = new Set(s);
        next.add(id);
        return next;
      });
      if ('vibrate' in navigator) navigator.vibrate(120);
    },
    [initialKeys],
  );
  const reset = useCallback(() => setOpened(new Set()), []);
  return { opened, open, reset, count: opened.size };
}
