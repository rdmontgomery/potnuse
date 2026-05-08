import { useRef } from 'react';
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
const HALO = 18; // px of invisible padding extending the hitbox

export default function Exp02PaddedHitbox() {
  const stageRef = useRef<HTMLDivElement | null>(null);
  const { sprites, setSprites } = useWalkingSprites(stageRef);
  const { opened, open, reset, count } = useDelivery(LETTERS);

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

  return (
    <Stage
      index={2}
      title="padded hitbox"
      blurb="The glyph stays small but its hit target is padded by 18 px on every side."
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
            className={'sbs-sprite-hit' + (s.state === 'held' ? ' is-held' : '')}
            style={{
              transform: `translate3d(${s.x - HALO}px, ${s.y - HALO}px, 0)`,
              padding: `${HALO}px`,
              color: `var(--sbs-${s.kind})`,
            }}
            onPointerDown={(e) => onPointerDown(s.id, e)}
            onPointerMove={(e) => onPointerMove(s.id, e)}
            onPointerUp={(e) => onPointerUp(s.id, e)}
            onPointerCancel={(e) => onPointerUp(s.id, e)}
          >
            <span className="sbs-sprite-glyph">{SPRITE_GLYPHS[s.kind]}</span>
          </div>
        ))}
      </div>
    </Stage>
  );
}
