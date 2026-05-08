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
const SUMMON_SPEED = 220; // px/sec while seeking

type Summon = { spriteId: number; letterId: string; targetX: number; targetY: number };

export default function Exp07Summon() {
  const stageRef = useRef<HTMLDivElement | null>(null);
  const { sprites, setSprites } = useWalkingSprites(stageRef);
  const { opened, open, reset, count } = useDelivery(LETTERS);
  const [summon, setSummon] = useState<Summon | null>(null);

  function summonNearest(letterId: string) {
    if (opened.has(letterId)) return;
    const stage = stageRef.current;
    if (!stage) return;
    const mb = stage.querySelector<HTMLElement>(
      `[data-mailbox-letter-id="${letterId}"]`,
    );
    if (!mb) return;
    const sr = stage.getBoundingClientRect();
    const r = mb.getBoundingClientRect();
    const tx = r.left - sr.left + r.width / 2 - 30;
    const ty = r.top - sr.top + r.height / 2 - 12;

    // Find nearest walking sprite (by x distance — they only walk on x).
    let nearest = sprites[0];
    let bestD = Infinity;
    for (const s of sprites) {
      if (s.state !== 'walking') continue;
      const d = Math.hypot(s.x - tx, s.y - ty);
      if (d < bestD) {
        bestD = d;
        nearest = s;
      }
    }
    if (!nearest) return;
    setSummon({ spriteId: nearest.id, letterId, targetX: tx, targetY: ty });
    setSprites((s) =>
      s.map((sp) => (sp.id === nearest.id ? { ...sp, state: 'targeted' } : sp)),
    );
  }

  // Drive a targeted sprite toward the mailbox. On arrival, deliver.
  useEffect(() => {
    if (!summon) return;
    let raf = 0;
    let last = performance.now();
    function step(now: number) {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      let arrived = false;
      setSprites((curr) =>
        curr.map((sp) => {
          if (sp.id !== summon!.spriteId) return sp;
          const dx = summon!.targetX - sp.x;
          const dy = summon!.targetY - sp.y;
          const d = Math.hypot(dx, dy);
          if (d < 6) {
            arrived = true;
            return sp;
          }
          const step = Math.min(d, SUMMON_SPEED * dt);
          return { ...sp, x: sp.x + (dx / d) * step, y: sp.y + (dy / d) * step };
        }),
      );
      if (arrived) {
        open(summon!.letterId);
        setSprites((s) => s.filter((sp) => sp.id !== summon!.spriteId));
        setSummon(null);
        return;
      }
      raf = requestAnimationFrame(step);
    }
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [summon, open, setSprites]);

  return (
    <Stage
      index={7}
      title="mailbox calls a sprite"
      blurb="Tap a mailbox. The nearest sprite turns and walks itself in to deliver."
      delivered={count}
      onReset={() => {
        reset();
        setSprites([]);
        setSummon(null);
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
              highlighted={summon?.letterId === id}
              onActivate={() => summonNearest(id)}
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
              (s.state === 'targeted' ? ' is-armed' : '') +
              (s.state !== 'walking' ? ' is-paused' : '')
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
