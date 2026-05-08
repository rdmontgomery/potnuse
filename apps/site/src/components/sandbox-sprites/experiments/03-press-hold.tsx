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
const HOLD_MS = 350;

export default function Exp03PressHold() {
  const stageRef = useRef<HTMLDivElement | null>(null);
  const { sprites, setSprites } = useWalkingSprites(stageRef);
  const { opened, open, reset, count } = useDelivery(LETTERS);
  const [armingId, setArmingId] = useState<number | null>(null);
  const armTimer = useRef<number | undefined>(undefined);

  function onPointerDown(id: number, ev: React.PointerEvent) {
    (ev.target as Element).setPointerCapture?.(ev.pointerId);
    // Halt the sprite while the reader holds it.
    setSprites((s) =>
      s.map((sp) => (sp.id === id ? { ...sp, state: 'held' } : sp)),
    );
    setArmingId(id);
    if (armTimer.current) clearTimeout(armTimer.current);
    armTimer.current = window.setTimeout(() => {
      setArmingId((cur) => (cur === id ? null : cur));
    }, HOLD_MS);
    ev.preventDefault();
  }
  function onPointerMove(id: number, ev: React.PointerEvent) {
    if (armingId === id) return; // still charging — don't move yet
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
    if (armTimer.current) clearTimeout(armTimer.current);
    const stillCharging = armingId === id;
    setArmingId(null);
    if (stillCharging) {
      // Released too early — sprite resumes walking.
      setSprites((s) =>
        s.map((sp) => (sp.id === id ? { ...sp, state: 'walking' } : sp)),
      );
      return;
    }
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
      index={3}
      title="press-and-hold ring"
      blurb={`Press for ${HOLD_MS} ms to arm. The ring fills, then the sprite is yours.`}
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
              'sbs-sprite' +
              (s.state === 'held' ? ' is-held' : '') +
              (armingId === s.id ? ' is-arming' : '')
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
            <span className="sbs-sprite-glyph">{SPRITE_GLYPHS[s.kind]}</span>
            {armingId === s.id && (
              <span
                className="sbs-arm-ring"
                style={{ animationDuration: `${HOLD_MS}ms` }}
              />
            )}
          </div>
        ))}
      </div>
    </Stage>
  );
}
