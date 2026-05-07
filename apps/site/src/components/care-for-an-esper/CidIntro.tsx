import { DialogueBox } from './DialogueBox';
import { useEsperStore } from './state';

const CID_INTRO = `Heh. So you're the new pilot.

Stay close. Keep your hands where they belong. Don't touch anything glowing unless I tell you.

First thing they don't teach you in flight school: the engine needs you more than you need it. Most folks have it backwards their whole lives.

We've got ground to cover.`;

function buzz(ms: number) {
  if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
    navigator.vibrate(ms);
  }
}

export function CidIntro() {
  const tapped = useEsperStore((s) => s.events.has('cid-intro-tapped'));
  const recordEvent = useEsperStore((s) => s.recordEvent);
  const bumpAtb = useEsperStore((s) => s.bumpAtb);
  const advance = useEsperStore((s) => s.advance);

  function onContinue() {
    if (tapped) return;
    buzz(15);
    recordEvent('cid-intro-tapped');
    bumpAtb(0.08);
    advance('section-1-cid-shown');
  }

  return (
    <div className="cfe-cid-intro">
      <DialogueBox label="CID" body={CID_INTRO} />
      <button
        type="button"
        className="cfe-continue"
        onClick={onContinue}
        disabled={tapped}
      >
        {tapped ? '▶ continued' : '▶ press to continue'}
      </button>
    </div>
  );
}
