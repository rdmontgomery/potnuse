import { useRef } from 'react';
import { DialogueBox } from './DialogueBox';
import { useEsperStore } from './state';
import { useDwell } from './useDwell';
import { BUGENHAGEN } from './dialogue';

// Reading attentively through Bugenhagen's gloss on the Lifestream is the
// engagement event for §4. >=4s of focused viewport time records the
// event and bumps esper vibrancy +0.10. The post does not announce this
// to the reader; the only feedback is the esper's later color.
const DWELL_MS = 4000;

export function Bugenhagen() {
  const ref = useRef<HTMLDivElement>(null);
  const recordEvent = useEsperStore((s) => s.recordEvent);
  const dwelled = useEsperStore((s) => s.events.has('bugenhagen-dwelled'));

  useDwell(
    ref,
    DWELL_MS,
    () => recordEvent('bugenhagen-dwelled'),
    { enabled: !dwelled, ratio: 0.5 },
  );

  return (
    <div ref={ref}>
      <DialogueBox label="BUGENHAGEN" body={BUGENHAGEN} />
    </div>
  );
}
