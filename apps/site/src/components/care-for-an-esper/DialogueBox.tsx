import { useMemo, useRef } from 'react';
import { renderDialogue } from './box';
import { useColumns } from './useColumns';

type Props = {
  label?: string | null;
  body: string;
  /** Optional clamp on max width (in columns) for narrow speaker beats. */
  maxCols?: number;
  /** 'left' (default) for prose; 'center' for terse single-line beats. */
  align?: 'left' | 'center';
  className?: string;
};

export function DialogueBox({
  label = null,
  body,
  maxCols = 56,
  align = 'left',
  className,
}: Props) {
  const ref = useRef<HTMLPreElement>(null);
  const cols = useColumns(ref, { min: 28, max: maxCols });
  const rendered = useMemo(
    () => renderDialogue(label, body, cols, align),
    [label, body, cols, align],
  );
  return (
    <pre ref={ref} className={`cfe-dialogue ${className ?? ''}`}>
      {rendered.lines.join('\n')}
    </pre>
  );
}
