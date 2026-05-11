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
// opens. The base <img> runs the breathing keyframe continuously; a
// sibling <img>, keyed on a nonce that increments per bump, mounts to
// run the flare keyframe and stays parked at opacity 0 until the next
// bump remounts it. The breathing stream is never interrupted.
function EsperGlyph() {
  const v = useEsperStore((s) => s.esperVibrancy);
  const prev = useRef<number | null>(null);
  const [flareNonce, setFlareNonce] = useState(0);

  useEffect(() => {
    if (prev.current !== null && v > prev.current) {
      setFlareNonce((n) => n + 1);
    }
    prev.current = v;
  }, [v]);

  const vibrancyStyle = {
    ['--cfe-esper-vibrancy' as string]: v,
  } as React.CSSProperties;

  return (
    <span className="cfe-esper-sprite-host">
      <img
        src="/sprites/magicite.gif"
        alt=""
        width={48}
        height={84}
        draggable={false}
        className="cfe-esper-sprite"
        style={{ ...vibrancyStyle, opacity: esperOpacity(v) }}
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
          style={vibrancyStyle}
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
