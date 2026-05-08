import { useEsperStore } from './state';
import { LetterBox } from './Letter';
import { LETTERS_BY_ID, type LetterId } from './letters';

// Inline drop-target. A reader who notices it can drag a wandering
// sprite onto it; on drop the SpriteManager records the
// `letter:<id>` event, this component re-renders open, and the
// Hopscotch fragment slides in below.
//
// data-mailbox-letter-id is the contract with SpriteManager's
// pointer-up hit-test (document.elementFromPoint walks ancestors
// looking for it).
export function Mailbox({ letterId }: { letterId: LetterId }) {
  const opened = useEsperStore((s) => s.events.has(`letter:${letterId}` as const));
  const letter = LETTERS_BY_ID[letterId];

  return (
    <div className="cfe-mailbox-wrap">
      <div
        className={`cfe-mailbox${opened ? ' is-open' : ''}`}
        data-mailbox-letter-id={letterId}
        aria-label={
          opened
            ? `mailbox opened, letter from ${letter.from}`
            : 'mailbox — drag a wandering sprite to open'
        }
      >
        {opened ? '[ ✉  open ]' : '[ ✉ ]'}
      </div>
      {opened && <LetterBox letter={letter} />}
    </div>
  );
}
