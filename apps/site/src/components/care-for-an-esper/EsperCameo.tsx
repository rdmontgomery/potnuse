import { useEffect, useRef, useState } from 'react';
import { chocoboGifSrcFor, useEsperStore } from './state';

function chocoboFilter(v: number): string {
  const sat = 0.25 + v * 0.75;
  const bright = 0.85 + v * 0.15;
  return `saturate(${sat}) brightness(${bright})`;
}

function chocoboOpacity(v: number): number {
  return 0.55 + v * 0.45;
}

function esperOpacity(v: number): number {
  return 0.55 + v * 0.45;
}

// The esper breathes by default and flares when an esper-bump letter
// opens. Breathing endpoints (low/high saturate + brightness) are
// computed in JS from vibrancy and passed as plain numeric CSS
// custom properties; the keyframes reference them with bare var()
// (no nested calc) so the browser interpolates filter cleanly between
// keyframes. Flare endpoints get the same treatment.
//
// Exported so CodaEsper in CodaCameo can use the same sprite without
// drifting from this implementation.
export function EsperGlyph() {
  const v = useEsperStore((s) => s.esperVibrancy);
  const prev = useRef<number | null>(null);
  const [flareNonce, setFlareNonce] = useState(0);

  useEffect(() => {
    if (prev.current !== null && v > prev.current) {
      setFlareNonce((n) => n + 1);
    }
    prev.current = v;
  }, [v]);

  // Breathing oscillates saturate ±0.2, brightness ±0.04 around a
  // vibrancy-tracked base. Wide enough to read on a small pixel sprite.
  const baseSat = 0.45 + v * 0.55;
  const baseBright = 0.9 + v * 0.1;
  const breathStyle: React.CSSProperties = {
    ['--cfe-breath-low-sat' as string]: Math.max(0, baseSat - 0.2),
    ['--cfe-breath-high-sat' as string]: Math.min(1.3, baseSat + 0.2),
    ['--cfe-breath-low-bright' as string]: Math.max(0.6, baseBright - 0.04),
    ['--cfe-breath-high-bright' as string]: Math.min(1.15, baseBright + 0.04),
  };
  const flareStyle: React.CSSProperties = {
    ['--cfe-flare-peak-sat' as string]: Math.min(1.4, baseSat + 0.5),
    ['--cfe-flare-peak-bright' as string]: Math.min(1.25, baseBright + 0.15),
    ['--cfe-flare-rest-sat' as string]: baseSat,
    ['--cfe-flare-rest-bright' as string]: baseBright,
  };

  return (
    <span className="cfe-esper-sprite-host">
      <img
        src="/sprites/magicite.gif"
        alt=""
        width={48}
        height={84}
        draggable={false}
        className="cfe-esper-sprite"
        style={{ ...breathStyle, opacity: esperOpacity(v) }}
      />
      {flareNonce > 0 && (
        <img
          key={flareNonce}
          src="/sprites/magicite.gif"
          alt=""
          width={48}
          height={84}
          draggable={false}
          aria-hidden
          className="cfe-esper-flare"
          style={flareStyle}
        />
      )}
    </span>
  );
}

function ChocoboGlyph() {
  const v = useEsperStore((s) => s.chocoboVibrancy);
  const src = useEsperStore((s) => chocoboGifSrcFor(s.events));
  return (
    <img
      src={src}
      alt=""
      width={120}
      height={128}
      draggable={false}
      className="cfe-chocobo-sprite"
      style={{
        filter: chocoboFilter(v),
        opacity: chocoboOpacity(v),
      }}
    />
  );
}

type Props = {
  variant: 'intro' | 'fading' | 'dimmed-with-chocobo';
};

// Three cameo variants. The figcaption just names her presence (Path 3:
// stop-narrating). The visual carries the trajectory: vibrancy state
// from the store sets the floor, the breathing keeps her alive, the
// flare on letter-open puts the reader's hand on her.
export function EsperCameo({ variant }: Props) {
  if (variant === 'intro') {
    return (
      <figure className="cfe-esper-cameo">
        <EsperGlyph />
        <figcaption>
          <em>an esper, watching.</em>
        </figcaption>
      </figure>
    );
  }

  if (variant === 'fading') {
    return (
      <figure className="cfe-esper-cameo">
        <EsperGlyph />
        <figcaption>
          <em>the esper, again.</em>
        </figcaption>
      </figure>
    );
  }

  // dimmed-with-chocobo (closes §6).
  return (
    <figure className="cfe-esper-cameo cfe-esper-cameo-pair">
      <div className="cfe-esper-cameo-row">
        <EsperGlyph />
        <em>the esper.</em>
      </div>
      <div className="cfe-esper-cameo-row">
        <ChocoboGlyph />
      </div>
    </figure>
  );
}
