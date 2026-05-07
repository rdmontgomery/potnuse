import { useRef } from 'react';
import { useFit } from './useFit';
import { trimNl } from './text';

const BANNER = String.raw`
═════════════════════════════════════════════════════════════════════════
                                                                     ✦
       H O W   T O   C A R E   F O R   A N   E S P E R              /|\
                                                                   ✦-✦-✦
─────────────────────────────────────────────────────────────────────────
                  a walkthrough through the glass brick
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
  const bannerRef = useRef<HTMLPreElement>(null);
  // Banner is fixed at 73 visible columns wide.
  useFit(bannerRef, 73, { min: 7, max: 14 });
  return (
    <header className="cfe-masthead">
      <pre
        ref={bannerRef}
        className="cfe-banner"
        aria-label="how to care for an esper — a walkthrough through the glass brick"
      >
        {trimNl(BANNER)}
      </pre>
      <pre className="cfe-meta">{trimNl(META)}</pre>
      <pre className="cfe-copyright">{trimNl(COPYRIGHT)}</pre>
      <pre className="cfe-epigraph-block">{trimNl(EPIGRAPH)}</pre>
    </header>
  );
}
