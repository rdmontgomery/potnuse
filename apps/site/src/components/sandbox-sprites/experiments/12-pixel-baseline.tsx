import { useRef } from 'react';
import {
  findMailboxAt,
  Mailbox,
  Stage,
  StageProse,
  useDelivery,
  useWalkingSprites,
} from '../shared';
import { PixelSpriteSvg, PIXEL_KINDS, type PixelSpriteKind } from '../PixelSprite';

// Same pattern as 01-baseline, but the wandering thing is a pixel
// sprite instead of an ASCII glyph. The hit target is bigger by
// default (sprite is 28×28 px) so this experiment also doubles as a
// fairer mobile read.
//
// DROP-IN: to use a real PNG instead of the inline SVG, place the
// file at apps/site/public/sprites/<kind>.png and replace
// <PixelSpriteSvg .../> with <img src={`/sprites/${s.kind}.png`} />
// in the sprite render below. Same coordinates work either way.

const LETTERS = ['cid', 'terra'];

export default function Exp12PixelBaseline() {
  const stageRef = useRef<HTMLDivElement | null>(null);
  const { sprites, setSprites } = useWalkingSprites(stageRef, {
    spritePad: 60,
  });
  const { opened, open, reset, count } = useDelivery(LETTERS);

  // useWalkingSprites picks an ASCII kind. Map onto the pixel kinds
  // in the same order so behaviour is identical.
  const pixelKindFor = (kind: string): PixelSpriteKind => {
    const idx = ['moogle', 'tonberry', 'marlboro', 'cactuar'].indexOf(kind);
    return PIXEL_KINDS[idx >= 0 ? idx : 0];
  };

  function onPointerDown(id: number, ev: React.PointerEvent) {
    (ev.currentTarget as Element).setPointerCapture?.(ev.pointerId);
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
          ? { ...sp, x: ev.clientX - r.left - 14, y: ev.clientY - r.top - 14 }
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

  return (
    <Stage
      index={12}
      title="pixel sprite baseline"
      blurb="Same drag-onto-mailbox pattern as №01, but the wanderer is a 14×14 pixel-art critter (inline SVG, scaled 2×). Hit target is naturally bigger."
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
          <div
            key={s.id}
            className={
              'sbs-pixel-sprite' + (s.state === 'held' ? ' is-held' : '')
            }
            style={{
              transform: `translate3d(${s.x}px, ${s.y}px, 0)`,
            }}
            onPointerDown={(e) => onPointerDown(s.id, e)}
            onPointerMove={(e) => onPointerMove(s.id, e)}
            onPointerUp={(e) => onPointerUp(s.id, e)}
            onPointerCancel={(e) => onPointerUp(s.id, e)}
          >
            <PixelSpriteSvg kind={pixelKindFor(s.kind)} frame={0} scale={2} />
          </div>
        ))}
      </div>
    </Stage>
  );
}
