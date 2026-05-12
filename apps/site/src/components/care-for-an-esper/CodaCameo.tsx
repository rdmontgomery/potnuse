import { chocoboGifSrcFor, useEsperStore } from './state';
import { EsperGlyph } from './EsperCameo';

// Chocobo retains the static filter-based vibrancy treatment; its life
// comes from the GIF-speed swap in chocoboGifSrcFor. The esper shares
// the breathing + flare animation with the earlier cameos (EsperGlyph
// is imported from EsperCameo).
function chocoboFilter(v: number): string {
  const sat = 0.25 + v * 0.75;
  const bright = 0.85 + v * 0.15;
  return `saturate(${sat}) brightness(${bright})`;
}

function chocoboOpacity(v: number): number {
  return 0.55 + v * 0.45;
}

export function CodaChocobo() {
  const v = useEsperStore((s) => s.chocoboVibrancy);
  const src = useEsperStore((s) => chocoboGifSrcFor(s.events));
  return (
    <div className="cfe-coda-sprite" aria-hidden="true">
      <img
        src={src}
        alt=""
        width={120}
        height={128}
        draggable={false}
        style={{
          filter: chocoboFilter(v),
          opacity: chocoboOpacity(v),
        }}
      />
    </div>
  );
}

export function CodaEsper() {
  return (
    <div className="cfe-coda-sprite" aria-hidden="true">
      <EsperGlyph />
    </div>
  );
}
