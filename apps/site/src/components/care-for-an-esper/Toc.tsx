import { useRef } from 'react';
import { useFit } from './useFit';

// GameFAQs-walkthrough TOC. Section labels and titles are anchored to
// the column edges with dotted leaders filling the gap, the way print
// indices and contents pages set their leaders by hand.

const COLS = 60;
const LEAD = '          '; // 10 spaces — pulls the block in from the left rule

const ENTRIES: Array<{ label: string; title: string }> = [
  { label: 'Prelude   ', title: 'The Borgmann horse' },
  { label: 'Section  1', title: 'The Liquid Eye' },
  { label: 'Section  2', title: 'The Device Paradigm' },
  { label: 'Section  3', title: 'The Magitek Knight (FFVI)' },
  { label: 'Section  4', title: 'The Lifestream (FFVII)' },
  { label: 'Section  5', title: 'Sin and Machina (FFX)' },
  { label: 'Section  6', title: 'The False Relics (FFT)' },
  { label: 'Section  7', title: "Cortázar's Watch" },
  { label: 'Section  8', title: 'Cid' },
  { label: 'Section  9', title: "The Engineer's Position" },
  { label: 'Section 10', title: 'Coda' },
];

function row({ label, title }: { label: string; title: string }): string {
  // Format: LEAD + label + " " + dotted-leader + " " + title, all to COLS.
  // Leader pattern is alternating dot/space starting and ending with space
  // so neither dot kisses the label or title.
  const used = LEAD.length + label.length + 1 + 1 + title.length;
  const fill = Math.max(0, COLS - used);
  let leader = '';
  for (let i = 0; i < fill; i++) leader += i % 2 === 1 ? '.' : ' ';
  return `${LEAD}${label} ${leader} ${title}`;
}

const RULE_WIDTH = 50;
const RULE = '+-'.repeat(Math.floor(RULE_WIDTH / 2)) + '+';
const HEAD = (() => {
  const text = 'T A B L E   O F   C O N T E N T S';
  const lead = Math.max(0, Math.floor((COLS - text.length) / 2));
  return ' '.repeat(lead) + text;
})();
const RULE_LINE = ' '.repeat(Math.max(0, Math.floor((COLS - RULE.length) / 2))) + RULE;

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
