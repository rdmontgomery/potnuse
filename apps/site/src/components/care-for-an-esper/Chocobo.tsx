import { useEffect, useRef, useState } from 'react';
import { chocoboGifSrcFor, useEsperStore } from './state';
import { DialogueBox } from './DialogueBox';
import { LetterBox } from './Letter';
import { LETTERS_BY_ID } from './letters';

const HOLD_MS = 700;

function buzz(ms: number) {
  if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
    navigator.vibrate(ms);
  }
}

// The chocobo accepts gysahl greens. The feed gesture is the post's
// one focal practice that fits the lore (feeding chocobos is a forty-
// year ritual in this franchise, the small act every player learns).
// Optional. Not a gate. Reader who skips it is fine. Reader who feeds
// gets a small offering registered: chocobo vibrancy +0.15, a 200ms
// haptic gravitas at completion, and a slightly different coda.
export function Chocobo() {
  const fed = useEsperStore((s) => s.events.has('chocobo-fed'));
  const kwehOpened = useEsperStore((s) => s.events.has('letter:kweh'));
  const recordEvent = useEsperStore((s) => s.recordEvent);
  const chocoboSrc = useEsperStore((s) => chocoboGifSrcFor(s.events));

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
    if (fed) return;
    ev.currentTarget.setPointerCapture(ev.pointerId);
    startRef.current = performance.now();
    const tick = () => {
      if (startRef.current == null) return;
      const elapsed = performance.now() - startRef.current;
      const p = Math.min(1, elapsed / HOLD_MS);
      setHoldProgress(p);
      if (p >= 1) {
        clearHold();
        recordEvent('chocobo-fed');
        // The chocobo is the tutorial mailbox: feeding her also opens
        // her own letter. Reader who scrolls past the §2 chocobo
        // entirely never sees the kweh letter.
        recordEvent('letter:kweh');
        // 200ms gravitas (sustained, weighted); reads as gravity at the
        // moment of offering, not as a UI-confirmation tick.
        buzz(200);
        return;
      }
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
  }

  function onPressEnd() {
    clearHold();
  }

  useEffect(() => () => clearHold(), []);

  // All three label states are 23 chars wide so the bracket has a
  // stable visual mass through hold progress; FED ✓ is centered
  // inside that fixed inner field.
  const filled = Math.round(holdProgress * 8);
  const fillBar = '▒'.repeat(filled) + ' '.repeat(8 - filled);
  const feedLabel = fed
    ? '[        FED ✓        ]'
    : holdProgress > 0
    ? `[      ${fillBar}       ]`
    : '[ HOLD: gysahl greens ]';

  const body = fed
    ? '*she eats from your hand. she nickers softly.*'
    : '*kweh.*';

  return (
    <div className="cfe-chocobo">
      <div className="cfe-chocobo-portrait">
        <img
          src={chocoboSrc}
          alt="chocobo"
          width={120}
          height={128}
          draggable={false}
        />
      </div>
      <DialogueBox body={body} maxCols={56} align="center" />
      <div className="cfe-action-row">
        <button
          type="button"
          className={`cfe-bracket cfe-bracket-feed${holdProgress > 0 ? ' is-holding' : ''}${fed ? ' is-done' : ''}`}
          onPointerDown={onPressStart}
          onPointerUp={onPressEnd}
          onPointerCancel={onPressEnd}
          onPointerLeave={onPressEnd}
          disabled={fed}
          aria-label={fed ? 'fed' : 'feed (hold)'}
        >
          {feedLabel}
        </button>
      </div>
      {kwehOpened && <LetterBox letter={LETTERS_BY_ID['kweh']} />}
    </div>
  );
}
