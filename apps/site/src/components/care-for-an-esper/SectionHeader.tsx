import { useMemo, useRef } from 'react';
import { useColumns } from './useColumns';

type Props = {
  ordinal: string; // "Cold Open" | "I" | "II" | etc.
  title: string;
};

// Renders the GameFAQs-style ruled header:
//
//   ===========================================================
//        I.  The Liquid Eye
//   ===========================================================
//
// The rules adapt to the body column width.
export function SectionHeader({ ordinal, title }: Props) {
  const ref = useRef<HTMLPreElement>(null);
  const cols = useColumns(ref, { min: 32, max: 76 });
  const block = useMemo(() => {
    const rule = '='.repeat(cols);
    const isNumber = /^[IVX]+$/i.test(ordinal);
    const label = isNumber ? `     ${ordinal}.  ${title}` : `     ${ordinal}:  ${title}`;
    return `${rule}\n${label}\n${rule}`;
  }, [cols, ordinal, title]);
  return (
    <pre ref={ref} className="cfe-section-header">
      {block}
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
