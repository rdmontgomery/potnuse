import { useRef, useState } from 'react';
import {
  findMailboxAt,
  Mailbox,
  Stage,
  StageProse,
  useDelivery,
  useWalkingSprites,
} from '../shared';
import {
  PixelSpriteSvg,
  PIXEL_KINDS,
  useWalkCycle,
  type PixelSpriteKind,
} from '../PixelSprite';

// Pixel-sprite take on №05 magnet pickup. Press anywhere within 80 px
// of a pixel sprite — it slides to your finger. Walk-cycle keeps
// running while you drag (it's still a creature).

const LETTERS = ['cid', 'terra'];
const MAGNET_RADIUS = 80;

function PixelDot({
  kind,
  paused,
  ...rest
}: {
  kind: PixelSpriteKind;
  paused: boolean;
} & React.HTMLAttributes<HTMLDivElement>) {
  const frame = useWalkCycle(220, paused);
  return (
    <div {...rest}>
      <PixelSpriteSvg kind={kind} frame={frame} scale={2} />
    </div>
  );
}

export default function Exp14PixelMagnet() {
  const stageRef = useRef<HTMLDivElement | null>(null);
  const overlayRef = useRef<HTMLDivElement | null>(null);
  const { sprites, setSprites } = useWalkingSprites(stageRef, {
    spritePad: 60,
  });
  const { opened, open, reset, count } = useDelivery(LETTERS);
  const [held, setHeld] = useState<number | null>(null);
  const pointerIdRef = useRef<number | null>(null);

  const pixelKindFor = (kind: string): PixelSpriteKind => {
    const idx = ['moogle', 'tonberry', 'marlboro', 'cactuar'].indexOf(kind);
    return PIXEL_KINDS[idx >= 0 ? idx : 0];
  };

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
      const dx = s.x + 14 - x;
      const dy = s.y + 14 - y;
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
          ? { ...sp, state: 'held', x: local.x - 14, y: local.y - 14 }
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
          ? { ...sp, x: local.x - 14, y: local.y - 14 }
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
      index={14}
      title="pixel magnet pickup"
      blurb={`Press within ${MAGNET_RADIUS} px of a pixel sprite — it slides to your finger. Walk cycle keeps animating while held.`}
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
          <PixelDot
            key={s.id}
            kind={pixelKindFor(s.kind)}
            paused={false}
            className={
              'sbs-pixel-sprite' + (s.state === 'held' ? ' is-held' : '')
            }
            style={{
              transform: `translate3d(${s.x}px, ${s.y}px, 0)`,
              pointerEvents: 'none',
            }}
          />
        ))}
      </div>
    </Stage>
  );
}
