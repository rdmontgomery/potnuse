import { useEffect, useRef, useState } from 'react';
import { useEsperStore } from './state';
import { DialogueBox } from './DialogueBox';

const HOLD_MS = 700;

function buzz(ms: number) {
  if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
    navigator.vibrate(ms);
  }
}

export function Chocobo() {
  const fed = useEsperStore((s) => s.events.has('chocobo-fed'));
  const skipped = useEsperStore((s) => s.events.has('chocobo-skipped'));
  const recordEvent = useEsperStore((s) => s.recordEvent);
  const bumpAtb = useEsperStore((s) => s.bumpAtb);
  const advance = useEsperStore((s) => s.advance);

  const [holdProgress, setHoldProgress] = useState(0);
  const startRef = useRef<number | null>(null);
  const rafRef = useRef<number | null>(null);

  function clearHold() {
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    rafRef.current = null;
    startRef.current = null;
    setHoldProgress(0);
  }

  function onPressStart(ev: React.PointerEvent<HTMLButtonElement>) {
    if (fed || skipped) return;
    ev.currentTarget.setPointerCapture(ev.pointerId);
    startRef.current = performance.now();
    buzz(8);
    const tick = () => {
      if (startRef.current == null) return;
      const elapsed = performance.now() - startRef.current;
      const p = Math.min(1, elapsed / HOLD_MS);
      setHoldProgress(p);
      if (p >= 1) {
        clearHold();
        recordEvent('chocobo-fed');
        bumpAtb(0.05);
        advance('section-2-resolved');
        buzz(20);
        return;
      }
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
  }

  function onPressEnd() {
    clearHold();
  }

  function onSkip() {
    if (fed || skipped) return;
    recordEvent('chocobo-skipped');
    advance('section-2-resolved');
  }

  useEffect(() => () => clearHold(), []);

  // Eight-cell bar inside the FEED bracket so the affordance stays in
  // the same character grid as the prose.
  const filled = Math.round(holdProgress * 8);
  const fillBar = '▒'.repeat(filled) + ' '.repeat(8 - filled);
  const feedLabel = fed
    ? '[ FED  ✓     ]'
    : holdProgress > 0
    ? `[ ${fillBar}     ]`
    : '[ FEED        ]';

  const body = fed
    ? '⌒(•ㅅ•)⌒    *she eats from your hand.*'
    : skipped
    ? '⌒(•ㅅ•)⌒    *she watches you go.*'
    : '⌒(•ㅅ•)⌒    *kweh.*';

  return (
    <div className="cfe-chocobo">
      <DialogueBox body={body} maxCols={48} />
      <div className="cfe-action-row">
        <button
          type="button"
          className={`cfe-bracket cfe-bracket-feed${holdProgress > 0 ? ' is-holding' : ''}${fed ? ' is-done' : ''}`}
          onPointerDown={onPressStart}
          onPointerUp={onPressEnd}
          onPointerCancel={onPressEnd}
          onPointerLeave={onPressEnd}
          disabled={fed || skipped}
          aria-label={fed ? 'fed' : 'feed (hold)'}
        >
          {feedLabel}
        </button>
        <button
          type="button"
          className="cfe-bracket"
          onClick={onSkip}
          disabled={fed || skipped}
        >
          {skipped ? '[ SCROLLED PAST ]' : '[ SCROLL PAST  ]'}
        </button>
      </div>
      <p className="cfe-action-hint" aria-live="polite">
        {fed
          ? '  ( the chocobo lifts her head. her color holds. )'
          : skipped
          ? '  ( the chocobo dims a little. she does not say why. )'
          : '  ( hold to feed. you may also scroll past. )'}
      </p>
    </div>
  );
}
