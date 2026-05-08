import { useRef } from 'react';
import { DialogueBox } from './DialogueBox';
import { useDwell } from './useDwell';
import { useEsperStore } from './state';
import { CID_BREAK_FOURTH_WALL } from './dialogue';

// §8's Cid monologue — the post's emotional peak. >=10s of focused
// viewport time records cid-monologue-dwelled and bumps esper +0.15.
// The reader who scrolls past quickly is not punished by anything
// other than the missing engagement on later vibrancy.
const DWELL_MS = 10_000;

export function CidMonologue() {
  const ref = useRef<HTMLDivElement>(null);
  const recordEvent = useEsperStore((s) => s.recordEvent);
  const dwelled = useEsperStore((s) => s.events.has('cid-monologue-dwelled'));

  useDwell(
    ref,
    DWELL_MS,
    () => recordEvent('cid-monologue-dwelled'),
    { enabled: !dwelled, ratio: 0.5 },
  );

  return (
    <div ref={ref}>
      <DialogueBox label="CID" body={CID_BREAK_FOURTH_WALL} maxCols={64} />
    </div>
  );
}
