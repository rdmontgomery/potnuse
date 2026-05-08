import type { Letter } from './letters';

// One opened letter, rendered inline below its mailbox (or, for the
// kweh letter, below the chocobo). Folded-note aesthetic: monospace
// chrome around HTML body, so blockquotes and italics flow as normal
// prose while the from/re/sign-off sit in pure-mono register.
//
// Slides in via cfe-letter-enter animation when first mounted.

export function LetterBox({ letter }: { letter: Letter }) {
  return (
    <aside
      className="cfe-letter cfe-letter-enter"
      data-letter-id={letter.id}
      aria-label={`letter from ${letter.from}, re ${letter.re}`}
    >
      <header className="cfe-letter-top">
        <span className="cfe-letter-meta-label">from</span>{' '}
        <span className="cfe-letter-from">{letter.from}</span>
      </header>
      <div className="cfe-letter-body">
        <p className="cfe-letter-re">
          <span className="cfe-letter-meta-label">re:</span> {letter.re}
        </p>
        {letter.body}
      </div>
      <footer className="cfe-letter-bottom">— {letter.signoff}</footer>
    </aside>
  );
}
