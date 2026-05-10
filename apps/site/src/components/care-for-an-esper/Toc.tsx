import { useRef } from 'react';
import { useFit } from './useFit';

// GameFAQs-walkthrough TOC. Labels (Prelude / I..X) sit flush left at
// col 0; titles are flush at the right column; dotted leaders fill the
// space between. Print-index style.

const COLS = 56;

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
  // " . " repeated; sandwich with spaces so neither dot kisses the label
  // or the title. Leader length varies per row so each line still
  // totals COLS, but every row starts flush at col 0.
  const used = label.length + 1 + 1 + title.length;
  const fill = Math.max(1, COLS - used);
  let leader = '';
  for (let i = 0; i < fill; i++) leader += i % 2 === 1 ? '.' : ' ';
  return `${label} ${leader} ${title}`;
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
