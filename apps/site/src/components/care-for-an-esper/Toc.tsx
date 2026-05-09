import { useRef } from 'react';
import { useFit } from './useFit';

// GameFAQs-walkthrough TOC. Labels (Prelude / I..X) are right-justified
// against a fixed column so the dotted leaders begin at the same x for
// every entry; titles are flush at the right column. Print-index style.

const COLS = 56;
const LEAD = 6; // left margin, in chars
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
  const lead = ' '.repeat(LEAD);
  const labelPad = ' '.repeat(Math.max(0, LABEL_COL - label.length)) + label;
  // " . " repeated; sandwich with spaces so neither dot kisses the label
  // or the title.
  const used = LEAD + LABEL_COL + 1 + 1 + title.length;
  const fill = Math.max(1, COLS - used);
  let leader = '';
  for (let i = 0; i < fill; i++) leader += i % 2 === 1 ? '.' : ' ';
  return `${lead}${labelPad} ${leader} ${title}`;
}

const RULE = '+-'.repeat(Math.floor((COLS - LEAD) / 2)) + '+';
const HEAD = (() => {
  const text = 'T A B L E   O F   C O N T E N T S';
  const indent = LEAD + Math.max(0, Math.floor((COLS - LEAD - text.length) / 2));
  return ' '.repeat(indent) + text;
})();
const RULE_LINE = ' '.repeat(LEAD) + RULE;

const TOC = [RULE_LINE, HEAD, RULE_LINE, '', ...ENTRIES.map(row)].join('\n');

export function Toc() {
  const ref = useRef<HTMLPreElement>(null);
  useFit(ref, COLS, { min: 7, max: 14 });
  return (
    <pre ref={ref} className="cfe-toc">
      {TOC}
    </pre>
  );
}
