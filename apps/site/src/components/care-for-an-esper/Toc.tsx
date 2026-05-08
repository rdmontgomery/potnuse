import { useRef } from 'react';
import { useFit } from './useFit';
import { trimNl } from './text';

// 58 visible columns wide. Section rows are right-aligned via dot leaders
// the way GameFAQs walkthroughs were typeset by hand.
const TOC = String.raw`
         +-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+
                  T A B L E   O F   C O N T E N T S
         +-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+

              Cold Open  . . . . . . . . The Borgmann horse
              Section  1 . . . . . . . . . . . The Liquid Eye
              Section  2 . . . . . . . . . The Device Paradigm
              Section  3 . . . . . . The Magitek Knight (FFVI)
              Section  4 . . . . . . . . The Lifestream (FFVII)
              Section  5 . . . . . . . . Sin and Machina (FFX)
              Section  6 . . . . . . . The False Relics (FFT)
              Section  7 . . . . . . . . . Cortázar's Watch
              Section  8 . . . . . . . . . . . . . . . . . Cid
              Section  9 . . . . . . . The Engineer's Position
              Section 10 . . . . . . . . . . . . . . . . . Coda

                  ( v3 demo: cold open through §6 )
`;

export function Toc() {
  const ref = useRef<HTMLPreElement>(null);
  useFit(ref, 64, { min: 7, max: 14 });
  return (
    <pre ref={ref} className="cfe-toc">
      {trimNl(TOC)}
    </pre>
  );
}
