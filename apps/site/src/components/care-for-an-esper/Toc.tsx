// Table of contents in the GameFAQs idiom: +-+- rule, roman numerals,
// dot leaders to right-aligned section titles.
const TOC = String.raw`
         +-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+
                  T A B L E   O F   C O N T E N T S
         +-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+

              Cold Open . . . . . . . . . The Borgmann horse
              Section  1 . . . . . . . . . . . The Liquid Eye
              Section  2 . . . . . . . . . The Device Paradigm
              Section  3 . . . . . . The Magitek Knight (FFVI)
              Section  4 . . . . . . . . The Lifestream (FFVII)
              Section  5 . . . . . . . . . Sin and Machina (FFX)
              Section  6 . . . . . . . . . The False Relics (FFT)
              Section  7 . . . . . . . . . . . . Cortázar's Watch
              Section  8 . . . . . . . . . . . . . . . . . . Cid
              Section  9 . . . . . . . . The Engineer's Position
              Section 10 . . . . . . . . . . . . . . . . . . Coda

                  ( v1 demo: cold open through §2 )
`;

export function Toc() {
  return <pre className="cfe-toc">{TOC.trim()}</pre>;
}
