import { useRef } from 'react';
import { useFit } from './useFit';

type Props = {
  ordinal: string; // "Prelude" | "I" | "II" | etc.
  title: string;
};

// Renders the GameFAQs-style ruled header at a fixed character width;
// useFit scales the font so the rule spans the article column at any
// viewport. Fixed cols means `lead` is always large enough to put real
// padding on either side of the label, so the centering reads.
//
//   ===========================================================
//                          I.  The Liquid Eye
//   ===========================================================

const COLS = 64;

export function SectionHeader({ ordinal, title }: Props) {
  const ref = useRef<HTMLPreElement>(null);
  useFit(ref, COLS, { min: 8, max: 14 });
  const rule = '='.repeat(COLS);
  const isNumber = /^[IVX]+$/i.test(ordinal);
  const inner = isNumber ? `${ordinal}.  ${title}` : `${ordinal}:  ${title}`;
  const lead = Math.max(0, Math.floor((COLS - inner.length) / 2));
  const label = ' '.repeat(lead) + inner;
  return (
    <pre ref={ref} className="cfe-section-header">
      {`${rule}\n${label}\n${rule}`}
    </pre>
  );
}

// Mid-section glyph divider: *  *  *
export function SceneBreak() {
  return (
    <div className="cfe-scene-break" aria-hidden="true">
      *      *      *
    </div>
  );
}
