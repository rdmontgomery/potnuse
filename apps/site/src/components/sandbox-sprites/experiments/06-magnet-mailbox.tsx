import { useEffect, useRef, useState } from 'react';
import {
  Mailbox,
  SPRITE_GLYPHS,
  Stage,
  StageProse,
  useDelivery,
  useWalkingSprites,
} from '../shared';

const LETTERS = ['cid', 'terra'];
const MAGNET_R = 120;
const SNAP_R = 28;

export default function Exp06MagnetMailbox() {
  const stageRef = useRef<HTMLDivElement | null>(null);
  const { sprites, setSprites } = useWalkingSprites(stageRef);
  const { opened, open, reset, count } = useDelivery(LETTERS);
  const [highlightId, setHighlightId] = useState<string | null>(null);

  // Cache mailbox centers in stage-local coords whenever the stage
  // resizes or new mailboxes mount.
  const [mailboxCenters, setMailboxCenters] = useState<
    Record<string, { x: number; y: number }>
  >({});

  useEffect(() => {
    function measure() {
      const stage = stageRef.current;
      if (!stage) return;
      const r = stage.getBoundingClientRect();
      const next: Record<string, { x: number; y: number }> = {};
      stage.querySelectorAll<HTMLElement>('[data-mailbox-letter-id]').forEach((el) => {
        const er = el.getBoundingClientRect();
        next[el.dataset.mailboxLetterId!] = {
          x: er.left - r.left + er.width / 2,
          y: er.top - r.top + er.height / 2,
        };
      });
      setMailboxCenters(next);
    }
    measure();
    const ro = new ResizeObserver(measure);
    if (stageRef.current) ro.observe(stageRef.current);
    return () => ro.disconnect();
  }, [opened]);

  function nearestMailbox(x: number, y: number) {
    let best: string | null = null;
    let bestD = MAGNET_R;
    for (const [id, c] of Object.entries(mailboxCenters)) {
      if (opened.has(id)) continue;
      const d = Math.hypot(c.x - x, c.y - y);
      if (d < bestD) {
        bestD = d;
        best = id;
      }
    }
    return { id: best, distance: bestD };
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
    const lx = ev.clientX - r.left;
    const ly = ev.clientY - r.top;
    const { id: nearestId, distance } = nearestMailbox(lx, ly);
    setHighlightId(nearestId);
    setSprites((s) =>
      s.map((sp) => {
        if (sp.id !== id || sp.state !== 'held') return sp;
        let tx = lx - 30;
        let ty = ly - 12;
        if (nearestId && distance < MAGNET_R) {
          const c = mailboxCenters[nearestId];
          // Pull toward the mailbox proportional to closeness.
          const t = 1 - distance / MAGNET_R; // 0..1
          const pull = t * t * 0.7;
          tx = tx * (1 - pull) + (c.x - 30) * pull;
          ty = ty * (1 - pull) + (c.y - 12) * pull;
        }
        return { ...sp, x: tx, y: ty };
      }),
    );
  }
  function onPointerUp(id: number, ev: React.PointerEvent) {
    const stage = stageRef.current;
    if (!stage) return;
    const r = stage.getBoundingClientRect();
    const lx = ev.clientX - r.left;
    const ly = ev.clientY - r.top;
    const { id: nearestId, distance } = nearestMailbox(lx, ly);
    if (nearestId && distance < SNAP_R + (MAGNET_R - SNAP_R) * 0.6) {
      open(nearestId);
      setSprites((s) => s.filter((sp) => sp.id !== id));
    } else {
      setSprites((s) =>
        s.map((sp) => (sp.id === id ? { ...sp, state: 'walking' } : sp)),
      );
    }
    setHighlightId(null);
  }

  return (
    <Stage
      index={6}
      title="magnetic mailbox"
      blurb={`Drag freely. Within ${MAGNET_R} px the sprite is pulled toward the nearest open mailbox.`}
      delivered={count}
      onReset={() => {
        reset();
        setSprites([]);
      }}
      stageRef={stageRef}
    >
      <StageProse
        mailboxes={LETTERS.map((id, i) => ({
          id,
          afterLine: i === 0 ? 1 : 3,
          node: (
            <Mailbox
              letterId={id}
              opened={opened.has(id)}
              highlighted={highlightId === id}
            />
          ),
        }))}
      />
      <div className="sbs-sprites" aria-hidden="true">
        {sprites.map((s) => (
          <div
            key={s.id}
            className={
              'sbs-sprite' + (s.state === 'held' ? ' is-held' : '')
            }
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
