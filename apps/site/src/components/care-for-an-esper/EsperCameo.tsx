import { useRef, type ReactNode } from 'react';
import { useFit } from './useFit';
import { useEsperStore } from './state';

// Maps esper vibrancy [0,1] to a CSS color. >=0.7 reads as warm gold;
// <=0.3 fades to a desaturated muted gray. We modulate saturation and
// lightness rather than hue so the drift reads as 'losing color'
// rather than 'changing identity'.
function vibrancyColor(v: number): string {
  const sat = Math.round(15 + v * 70); // 15..85
  const light = Math.round(54 - v * 16); // 54..38
  return `hsl(36, ${sat}%, ${light}%)`;
}

function vibrancyOpacity(v: number): number {
  return 0.55 + v * 0.45;
}

function EsperSprite({ children }: { children: ReactNode }) {
  const v = useEsperStore((s) => s.esperVibrancy);
  return (
    <span
      className="cfe-esper-glyph"
      style={{ color: vibrancyColor(v), opacity: vibrancyOpacity(v) }}
    >
      {children}
    </span>
  );
}

function ChocoboSprite({ children }: { children: ReactNode }) {
  const v = useEsperStore((s) => s.chocoboVibrancy);
  // The chocobo's color register is the same warm-gold gradient as the
  // esper — both are focal sprites in the post's economy. They drift on
  // separate vibrancy values driven by their own engagement events.
  return (
    <span
      className="cfe-esper-glyph"
      style={{ color: vibrancyColor(v), opacity: vibrancyOpacity(v) }}
    >
      {children}
    </span>
  );
}

type Props = {
  variant: 'intro' | 'fading' | 'dimmed-with-chocobo';
};

// All variants are 36 visible columns wide. Hand-laid so the box
// drawing stays exact; useFit scales the whole pre to the parent.
export function EsperCameo({ variant }: Props) {
  const ref = useRef<HTMLPreElement>(null);
  useFit(ref, 36, { min: 8, max: 14 });

  if (variant === 'intro') {
    return (
      <pre ref={ref} className="cfe-esper-cameo">
        {'╔══════════════════════════════════╗\n║       '}
        <EsperSprite>✦</EsperSprite>
        {'                          ║\n║      '}
        <EsperSprite>{'/ \\'}</EsperSprite>
        {'    *an esper, watching* ║\n║     '}
        <EsperSprite>{'✦   ✦'}</EsperSprite>
        {'                        ║\n╚══════════════════════════════════╝'}
      </pre>
    );
  }

  if (variant === 'fading') {
    return (
      <pre ref={ref} className="cfe-esper-cameo">
        {'╔══════════════════════════════════╗\n║       '}
        <EsperSprite>✦</EsperSprite>
        {'                          ║\n║      '}
        <EsperSprite>{'/|\\'}</EsperSprite>
        {'    *the esper has lost  ║\n║     '}
        <EsperSprite>{'✦-✦-✦'}</EsperSprite>
        {'   a little of her      ║\n║              color since Mobliz.*║\n╚══════════════════════════════════╝'}
      </pre>
    );
  }

  // dimmed-with-chocobo — closes §6. The esper is dimmer than in §4;
  // the chocobo's color rides her own vibrancy (whether she was fed).
  return (
    <pre ref={ref} className="cfe-esper-cameo">
      {'╔══════════════════════════════════╗\n║       '}
      <EsperSprite>✦</EsperSprite>
      {'                          ║\n║      '}
      <EsperSprite>{'/|\\'}</EsperSprite>
      {'    *the esper is dimmer ║\n║     '}
      <EsperSprite>{'✦-✦-✦'}</EsperSprite>
      {'   than before. she     ║\n║             does not say why.*   ║\n║                                  ║\n║   '}
      <ChocoboSprite>⌒(•ㅅ•)⌒</ChocoboSprite>
      {'  *the chocobo is       ║\n║              still here.*        ║\n╚══════════════════════════════════╝'}
    </pre>
  );
}
