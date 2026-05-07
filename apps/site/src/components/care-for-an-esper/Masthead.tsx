// 73-column masthead. Lives in a single <pre> so font-size scales with the
// viewport via clamp() in CSS while character alignment stays exact.
const MASTHEAD = String.raw`
═════════════════════════════════════════════════════════════════════════
                                                                     ✦
       H O W   T O   C A R E   F O R   A N   E S P E R              /|\
                                                                   ✦-✦-✦
─────────────────────────────────────────────────────────────────────────
                       a   w a l k t h r o u g h
                  t h r o u g h   t h e   g l a s s   b r i c k
═════════════════════════════════════════════════════════════════════════
`;

const META = String.raw`
    [author]  rick montgomery
   [contact]  rdmontgomery.com
   [release]  potnuse — essay
  [platform]  post / web / cloudflare pages
   [updated]  2026-05-07
   [version]  v1 (seedling)
`;

const COPYRIGHT = String.raw`
  This document is © 2026 rick montgomery, but the brushwork is its own.
  Borgmann, Cortázar, Brand, and every Cid in every airship are credited
  as the authors of the argument.

  This walkthrough is meant to appear at rdmontgomery.com.  If you find
  it elsewhere, send a chocobo to bring it home.
`;

const EPIGRAPH = String.raw`
   "the engine needs you more than you need it.
    most folks have it backwards their whole lives."
                                                          — cid
`;

export function Masthead() {
  return (
    <header className="cfe-masthead">
      <pre className="cfe-banner" aria-label="how to care for an esper — a walkthrough">
        {MASTHEAD.trim()}
      </pre>
      <pre className="cfe-meta">{META.trim()}</pre>
      <pre className="cfe-copyright">{COPYRIGHT.trim()}</pre>
      <pre className="cfe-epigraph-block">{EPIGRAPH.trim()}</pre>
    </header>
  );
}
