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

export default function Exp04TapArm() {
  const stageRef = useRef<HTMLDivElement | null>(null);
  const { sprites, setSprites } = useWalkingSprites(stageRef);
  const { opened, open, reset, count } = useDelivery(LETTERS);
  const [armedId, setArmedId] = useState<number | null>(null);

  // If an armed sprite gets garbage-collected (none should, but guard
  // anyway) clear the armed slot.
  useEffect(() => {
    if (armedId == null) return;
    if (!sprites.some((s) => s.id === armedId)) setArmedId(null);
  }, [sprites, armedId]);

  function tapSprite(id: number) {
    setArmedId((cur) => (cur === id ? null : id));
    setSprites((s) =>
      s.map((sp) => ({
        ...sp,
        state: sp.id === id ? 'targeted' : 'walking',
      })),
    );
  }

  function tapMailbox(letterId: string) {
    if (armedId == null) return;
    open(letterId);
    setSprites((s) => s.filter((sp) => sp.id !== armedId));
    setArmedId(null);
  }

  return (
    <Stage
      index={4}
      title="tap-arm, tap-deliver"
      blurb="Tap a sprite. It pauses and glows. Tap a mailbox to send it home. Tap again to disarm."
      delivered={count}
      onReset={() => {
        reset();
        setSprites([]);
        setArmedId(null);
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
              highlighted={armedId != null && !opened.has(id)}
              onActivate={() => tapMailbox(id)}
            />
          ),
        }))}
      />
      <div className="sbs-sprites" aria-hidden="true">
        {sprites.map((s) => (
          <div
            key={s.id}
            className={
              'sbs-sprite' +
              (armedId === s.id ? ' is-armed' : '') +
              (s.state !== 'walking' ? ' is-paused' : '')
            }
            style={{
              transform: `translate3d(${s.x}px, ${s.y}px, 0)`,
              color: `var(--sbs-${s.kind})`,
            }}
            onClick={() => tapSprite(s.id)}
          >
            {SPRITE_GLYPHS[s.kind]}
          </div>
        ))}
      </div>
    </Stage>
  );
}
