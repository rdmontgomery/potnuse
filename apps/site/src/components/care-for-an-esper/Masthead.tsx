import { useRef } from "react";
import { useFit } from "./useFit";
import { trimNl } from "./text";

const BANNER = String.raw`
╔══════════════════════════════════════════════════════════════════════╗
║                                                                      ║
║                  H O W   T O   C A R E   F O R   A N                 ║
║                                                                      ║
║                ███████╗███████╗██████╗ ███████╗██████╗               ║
║                ██╔════╝██╔════╝██╔══██╗██╔════╝██╔══██╗              ║
║                █████╗  ███████╗██████╔╝█████╗  ██████╔╝              ║
║                ██╔══╝  ╚════██║██╔═══╝ ██╔══╝  ██╔══██╗              ║
║                ███████╗███████║██║     ███████╗██║  ██║              ║
║                ╚══════╝╚══════╝╚═╝     ╚══════╝╚═╝  ╚═╝              ║
║                                                                      ║
║                     ::  a magitek walkthrough  ::                    ║
║                                                                      ║
║       by rdmontgomery                                     v1.00      ║
║                                                                      ║
╚══════════════════════════════════════════════════════════════════════╝
`;

const META = String.raw`
  [director]  rick montgomery
    [writer]  claude
   [contact]  rick.montgomery@gmail.com
  [platform]  rdmontgomery.com
   [updated]  2026-05-12
   [version]  v1 (seedling)
`;

// No hard newlines inside the paragraphs (CSS reflow handles the wrap so
// mobile and desktop both read cleanly). Blank lines stay (paragraph breaks).
const COPYRIGHT = String.raw`
  This document is © 2026 rick montgomery, but the brushwork is its own. Borgmann, Cortázar, Brand, and every Cid in every airship are credited as the authors of the argument.
`;

const EPIGRAPH_QUOTE =
  '"the engine needs you more than you need it. most folks have it backwards their whole lives."';
const EPIGRAPH_CITE = '(cid)';

export function Masthead() {
  const bannerRef = useRef<HTMLPreElement>(null);
  // Banner is fixed at 72 visible columns wide.
  useFit(bannerRef, 72, { min: 7, max: 14 });
  return (
    <header className="cfe-masthead">
      <pre
        ref={bannerRef}
        className="cfe-banner"
        aria-label="how to care for an esper (a magitek walkthrough by rdmontgomery, v1.00)"
      >
        {trimNl(BANNER)}
      </pre>
      <pre className="cfe-meta">{trimNl(META)}</pre>
      <pre className="cfe-copyright">{trimNl(COPYRIGHT)}</pre>
      <div className="cfe-epigraph-block">
        <p>{EPIGRAPH_QUOTE}</p>
        <p>{EPIGRAPH_CITE}</p>
      </div>
    </header>
  );
}
