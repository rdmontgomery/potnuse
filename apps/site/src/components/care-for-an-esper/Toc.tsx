import { useRef } from 'react';
import { useFit } from './useFit';

// GameFAQs-walkthrough TOC. Labels (Prelude / I..X) are right-justified
// against a fixed column so the dotted leaders begin at the same x for
// every entry; titles are flush at the right column. Print-index style.

const COLS = 56;
const LABEL_COL = 7; // width reserved for the label (longest is "Prelude")

const ENTRIES: Array<{ label: string; title: string }> = [
  { label: 'Prelude', title: 'The Borgmann horse' },
  { label: 'I', title: 'The Liquid Eye' },
  { label: 'II', title: 'The Device Paradigm' },
  { label: 'III', title: 'The Magitek Knight (FFVI)' },
  { label: 'IV', title: 'The Lifestream (FFVII)' },
  { label: 'V', title: 'Sin and Machina (FFX)' },
  { label: 'VI', title: 'The False Relics (FFT)' },
  { label: 'VII', title: "Cortázar's Watch" },
  { label: 'VIII', title: 'Cid' },
  { label: 'IX', title: "The Engineer's Position" },
  { label: 'X', title: 'Coda' },
];

function row({ label, title }: { label: string; title: string }): string {
  // Right-justify label inside LABEL_COL so leaders align across rows.
  const labelPad = ' '.repeat(Math.max(0, LABEL_COL - label.length)) + label;
  // " . " repeated; sandwich with spaces so neither dot kisses the label
  // or the title.
  const used = LABEL_COL + 1 + 1 + title.length;
  const fill = Math.max(1, COLS - used);
  let leader = '';
  for (let i = 0; i < fill; i++) leader += i % 2 === 1 ? '.' : ' ';
  return `${labelPad} ${leader} ${title}`;
}

const RULE = '+-'.repeat(Math.floor(COLS / 2));
const HEAD = (() => {
  const text = 'T A B L E   O F   C O N T E N T S';
  const indent = Math.max(0, Math.floor((COLS - text.length) / 2));
  return ' '.repeat(indent) + text;
})();

const TOC = [RULE, HEAD, RULE, '', ...ENTRIES.map(row)].join('\n');

export function Toc() {
  const ref = useRef<HTMLPreElement>(null);
  useFit(ref, COLS, { min: 7, max: 14 });
  return (
    <pre ref={ref} className="cfe-toc">
      {TOC}
    </pre>
  );
}
