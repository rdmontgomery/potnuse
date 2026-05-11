import { useEsperStore } from './state';
import { LetterBox } from './Letter';
import { LETTERS_BY_ID, type LetterId } from './letters';

// Inline drop-target. A reader who notices it can drag a wandering
// sprite onto it; on drop the SpriteManager calls `dropOnMailbox` and
// this component re-renders with whichever letter the store picked
// (home letter on first drop, random unread on a re-arm).
//
// data-mailbox-letter-id is the contract with SpriteManager's
// pointer-up hit-test (document.elementFromPoint walks ancestors
// looking for it). Its value is the mailbox's home id.
export function Mailbox({ letterId }: { letterId: LetterId }) {
  const showing = useEsperStore((s) => s.mailboxLetters[letterId]);
  const closeMailbox = useEsperStore((s) => s.closeMailbox);
  const opened = !!showing;
  const letter = showing ? LETTERS_BY_ID[showing] : null;

  return (
    <div className="cfe-mailbox-wrap">
      <div
        className={`cfe-mailbox${opened ? ' is-open' : ''}`}
        data-mailbox-letter-id={letterId}
        aria-label={
          opened
            ? `mailbox opened, letter from ${letter?.from}`
            : 'mailbox (drag a wandering sprite to open)'
        }
      >
        {opened ? '[ ✉  open ]' : '[ ✉ ]'}
      </div>
      {letter && (
        <LetterBox letter={letter} onClose={() => closeMailbox(letterId)} />
      )}
    </div>
  );
}
