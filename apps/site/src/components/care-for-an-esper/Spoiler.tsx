import { useState, type KeyboardEvent, type ReactNode } from 'react';

type Props = {
  children: ReactNode;
  label?: string;
};

export function Spoiler({ children, label = 'spoiler (tap to reveal)' }: Props) {
  const [revealed, setRevealed] = useState(false);

  function onKeyDown(e: KeyboardEvent<HTMLSpanElement>) {
    if (e.key === ' ' || e.key === 'Enter') {
      e.preventDefault();
      setRevealed((r) => !r);
    }
  }

  return (
    <span
      role="button"
      tabIndex={0}
      aria-pressed={revealed}
      aria-label={revealed ? undefined : label}
      className={revealed ? 'cfe-spoiler cfe-spoiler-on' : 'cfe-spoiler'}
      onClick={() => setRevealed((r) => !r)}
      onKeyDown={onKeyDown}
    >
      {children}
    </span>
  );
}
