import { chocoboGifSrcFor, useEsperStore } from './state';

// Vibrancy [0,1] → CSS filter that desaturates the GIF as the
// reader's engagement drops. Saturation rides 0.25..1; brightness
// nudges down slightly when low so a fully-fallen sprite doesn't
// glare against the cream paper.
function vibrancyFilter(v: number): string {
  const sat = 0.25 + v * 0.75;
  const bright = 0.85 + v * 0.15;
  return `saturate(${sat}) brightness(${bright})`;
}

function vibrancyOpacity(v: number): number {
  return 0.55 + v * 0.45;
}

function EsperGlyph() {
  const v = useEsperStore((s) => s.esperVibrancy);
  return (
    <img
      src="/sprites/magicite.gif"
      alt=""
      width={48}
      height={84}
      draggable={false}
      className="cfe-esper-sprite"
      style={{
        filter: vibrancyFilter(v),
        opacity: vibrancyOpacity(v),
      }}
    />
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
        filter: vibrancyFilter(v),
        opacity: vibrancyOpacity(v),
      }}
    />
  );
}

type Props = {
  variant: 'intro' | 'fading' | 'dimmed-with-chocobo';
};

// Three cameo variants. Each pairs the magicite (the esper as
// crystallized stone) with a one-line italic narration. The
// 'dimmed-with-chocobo' variant adds the chocobo alongside.
export function EsperCameo({ variant }: Props) {
  if (variant === 'intro') {
    return (
      <figure className="cfe-esper-cameo">
        <EsperGlyph />
        <figcaption>
          <em>an esper, watching</em>
        </figcaption>
      </figure>
    );
  }

  if (variant === 'fading') {
    return (
      <figure className="cfe-esper-cameo">
        <EsperGlyph />
        <figcaption>
          <em>the esper has lost a little of her color since Mobliz.</em>
        </figcaption>
      </figure>
    );
  }

  // dimmed-with-chocobo — closes §6.
  return (
    <figure className="cfe-esper-cameo cfe-esper-cameo-pair">
      <div className="cfe-esper-cameo-row">
        <EsperGlyph />
        <em>the esper is dimmer than before. she does not say why.</em>
      </div>
      <div className="cfe-esper-cameo-row">
        <ChocoboGlyph />
        <em>the chocobo is still here.</em>
      </div>
    </figure>
  );
}
