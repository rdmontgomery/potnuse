import { useRef } from 'react';
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

// Pixel sprite, but with a 2-frame walk-cycle (legs swap, pompom
// bobs) toggling at 220 ms intervals. Held sprites stop animating.
//
// Each sprite uses its own walk-cycle hook so the cycle phase can
// vary slightly — feels more alive than synchronized sprites.

const LETTERS = ['cid', 'terra'];

function WalkingSprite({
  kind,
  paused,
  onPointerDown,
  onPointerMove,
  onPointerUp,
  style,
}: {
  kind: PixelSpriteKind;
  paused: boolean;
  onPointerDown: (e: React.PointerEvent) => void;
  onPointerMove: (e: React.PointerEvent) => void;
  onPointerUp: (e: React.PointerEvent) => void;
  style: React.CSSProperties;
}) {
  const frame = useWalkCycle(220 + (kind.length % 3) * 30, paused);
  return (
    <div
      className={'sbs-pixel-sprite' + (paused ? ' is-held' : '')}
      style={style}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
    >
      <PixelSpriteSvg kind={kind} frame={frame} scale={2} />
    </div>
  );
}

export default function Exp13WalkCycle() {
  const stageRef = useRef<HTMLDivElement | null>(null);
  const { sprites, setSprites } = useWalkingSprites(stageRef, {
    spritePad: 60,
  });
  const { opened, open, reset, count } = useDelivery(LETTERS);

  const pixelKindFor = (kind: string): PixelSpriteKind => {
    const idx = ['moogle', 'tonberry', 'marlboro', 'cactuar'].indexOf(kind);
    return PIXEL_KINDS[idx >= 0 ? idx : 0];
  };

  function onPointerDown(id: number) {
    return (ev: React.PointerEvent) => {
      (ev.currentTarget as Element).setPointerCapture?.(ev.pointerId);
      setSprites((s) =>
        s.map((sp) => (sp.id === id ? { ...sp, state: 'held' } : sp)),
      );
      ev.preventDefault();
    };
  }
  function onPointerMove(id: number) {
    return (ev: React.PointerEvent) => {
      const stage = stageRef.current;
      if (!stage) return;
      const r = stage.getBoundingClientRect();
      setSprites((s) =>
        s.map((sp) =>
          sp.id === id && sp.state === 'held'
            ? { ...sp, x: ev.clientX - r.left - 14, y: ev.clientY - r.top - 14 }
            : sp,
        ),
      );
    };
  }
  function onPointerUp(id: number) {
    return (ev: React.PointerEvent) => {
      const target = ev.currentTarget as HTMLElement;
      const mb = findMailboxAt(
        stageRef.current,
        ev.clientX,
        ev.clientY,
        target,
      );
      if (mb) {
        open(mb.dataset.mailboxLetterId!);
        setSprites((s) => s.filter((sp) => sp.id !== id));
        return;
      }
      setSprites((s) =>
        s.map((sp) => (sp.id === id ? { ...sp, state: 'walking' } : sp)),
      );
    };
  }

  return (
    <Stage
      index={13}
      title="walk-cycle"
      blurb="Two-frame walk loop at 220 ms. Held sprites stop animating. Cheap, reads as alive."
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
          node: <Mailbox letterId={id} opened={opened.has(id)} />,
        }))}
      />
      <div className="sbs-sprites" aria-hidden="true">
        {sprites.map((s) => (
          <WalkingSprite
            key={s.id}
            kind={pixelKindFor(s.kind)}
            paused={s.state === 'held'}
            style={{
              transform: `translate3d(${s.x}px, ${s.y}px, 0)`,
            }}
            onPointerDown={onPointerDown(s.id)}
            onPointerMove={onPointerMove(s.id)}
            onPointerUp={onPointerUp(s.id)}
          />
        ))}
      </div>
    </Stage>
  );
}
