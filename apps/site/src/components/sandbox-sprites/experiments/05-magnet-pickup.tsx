import { useRef, useState } from 'react';
import {
  findMailboxAt,
  Mailbox,
  SPRITE_GLYPHS,
  Stage,
  StageProse,
  useDelivery,
  useWalkingSprites,
} from '../shared';

const LETTERS = ['cid', 'terra'];
const MAGNET_RADIUS = 80;

export default function Exp05MagnetPickup() {
  const stageRef = useRef<HTMLDivElement | null>(null);
  const overlayRef = useRef<HTMLDivElement | null>(null);
  const { sprites, setSprites } = useWalkingSprites(stageRef);
  const { opened, open, reset, count } = useDelivery(LETTERS);
  const [held, setHeld] = useState<number | null>(null);
  const pointerIdRef = useRef<number | null>(null);

  function localCoords(ev: React.PointerEvent) {
    const stage = stageRef.current;
    if (!stage) return null;
    const r = stage.getBoundingClientRect();
    return { x: ev.clientX - r.left, y: ev.clientY - r.top };
  }

  function findNearestSpriteId(x: number, y: number) {
    let best: number | null = null;
    let bestD = MAGNET_RADIUS;
    for (const s of sprites) {
      if (s.state !== 'walking') continue;
      const dx = s.x + 30 - x;
      const dy = s.y + 12 - y;
      const d = Math.hypot(dx, dy);
      if (d < bestD) {
        bestD = d;
        best = s.id;
      }
    }
    return best;
  }

  function onPointerDown(ev: React.PointerEvent) {
    const local = localCoords(ev);
    if (!local) return;
    const id = findNearestSpriteId(local.x, local.y);
    if (id == null) return;
    pointerIdRef.current = ev.pointerId;
    overlayRef.current?.setPointerCapture?.(ev.pointerId);
    setHeld(id);
    setSprites((s) =>
      s.map((sp) =>
        sp.id === id
          ? { ...sp, state: 'held', x: local.x - 30, y: local.y - 12 }
          : sp,
      ),
    );
    ev.preventDefault();
  }

  function onPointerMove(ev: React.PointerEvent) {
    if (held == null || pointerIdRef.current !== ev.pointerId) return;
    const local = localCoords(ev);
    if (!local) return;
    setSprites((s) =>
      s.map((sp) =>
        sp.id === held
          ? { ...sp, x: local.x - 30, y: local.y - 12 }
          : sp,
      ),
    );
  }

  function onPointerUp(ev: React.PointerEvent) {
    if (held == null || pointerIdRef.current !== ev.pointerId) return;
    const overlay = overlayRef.current;
    const mb = findMailboxAt(
      stageRef.current,
      ev.clientX,
      ev.clientY,
      overlay ?? undefined,
    );
    if (mb) {
      open(mb.dataset.mailboxLetterId!);
      setSprites((s) => s.filter((sp) => sp.id !== held));
    } else {
      const releasedId = held;
      setSprites((s) =>
        s.map((sp) =>
          sp.id === releasedId ? { ...sp, state: 'walking' } : sp,
        ),
      );
    }
    pointerIdRef.current = null;
    setHeld(null);
  }

  return (
    <Stage
      index={5}
      title="magnet pickup"
      blurb={`Press anywhere within ${MAGNET_RADIUS} px of a sprite — it slides to your finger.`}
      delivered={count}
      onReset={() => {
        reset();
        setSprites([]);
        setHeld(null);
      }}
      stageRef={stageRef}
    >
      <StageProse
        mailboxes={LETTERS.map((id, i) => ({
          id,
          afterLine: i === 0 ? 1 : 3,
          node: <Mailbox letterId={id} opened={opened.has(id)} />,
        }))}
      />
      <div
        ref={overlayRef}
        className="sbs-magnet-overlay"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
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
              pointerEvents: 'none',
            }}
          >
            {SPRITE_GLYPHS[s.kind]}
          </div>
        ))}
      </div>
    </Stage>
  );
}
