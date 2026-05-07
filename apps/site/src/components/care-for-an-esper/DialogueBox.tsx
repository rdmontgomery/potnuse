import { useMemo, useRef } from 'react';
import { renderDialogue } from './box';
import { useColumns } from './useColumns';

type Props = {
  label?: string | null;
  body: string;
  /** Optional clamp on max width (in columns) for narrow speaker beats. */
  maxCols?: number;
  className?: string;
};

export function DialogueBox({ label = null, body, maxCols = 56, className }: Props) {
  const ref = useRef<HTMLPreElement>(null);
  const cols = useColumns(ref, { min: 28, max: maxCols });
  const rendered = useMemo(() => renderDialogue(label, body, cols), [label, body, cols]);
  return (
    <pre ref={ref} className={`cfe-dialogue ${className ?? ''}`}>
      {rendered.lines.join('\n')}
    </pre>
  );
}
