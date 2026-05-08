import { DialogueBox } from './DialogueBox';
import { useEsperStore, type EngagementEvent } from './state';

function buzz(ms: number) {
  if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
    navigator.vibrate(ms);
  }
}

type Props = {
  body: string;
  event: Extract<EngagementEvent, 'ramza-1-tapped' | 'ramza-2-tapped' | 'ramza-3-tapped'>;
};

// One of Ramza's three disillusionments. The DialogueBox renders the
// monologue; the [ ▶ ] action below it records the engagement event
// with a soft haptic. The reader can scroll past without tapping; the
// only consequence is the missing engagement on esper vibrancy.
//
// Per the spec, §6 should feel longest at runtime. The pacing comes
// from prose density between beats and the three deliberate taps —
// not from artificial gating, since coercion ruins the focal-practice
// argument the form is enacting.
export function RamzaBeat({ body, event }: Props) {
  const tapped = useEsperStore((s) => s.events.has(event));
  const recordEvent = useEsperStore((s) => s.recordEvent);
  const bumpAtb = useEsperStore((s) => s.bumpAtb);

  const onTap = () => {
    if (tapped) return;
    buzz(15);
    recordEvent(event);
    bumpAtb(0.025);
  };

  return (
    <div className={`cfe-ramza-beat${tapped ? ' is-tapped' : ''}`}>
      <DialogueBox label="RAMZA" body={body} />
      <div className="cfe-action-row">
        <button
          type="button"
          className="cfe-bracket"
          onClick={onTap}
          disabled={tapped}
        >
          {tapped ? '[ ▶ continued     ]' : '[ ▶ press to continue ]'}
        </button>
      </div>
    </div>
  );
}
