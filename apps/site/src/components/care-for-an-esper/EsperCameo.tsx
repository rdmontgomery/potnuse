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

function Sprite({ children }: { children: ReactNode }) {
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

type Props = {
  variant: 'intro' | 'fading';
};

// Both variants are 36 visible columns wide. Hand-laid so the box
// drawing stays exact; useFit scales the whole pre to the parent.
export function EsperCameo({ variant }: Props) {
  const ref = useRef<HTMLPreElement>(null);
  useFit(ref, 36, { min: 8, max: 14 });

  if (variant === 'intro') {
    return (
      <pre ref={ref} className="cfe-esper-cameo">
        {'╔══════════════════════════════════╗\n║       '}
        <Sprite>✦</Sprite>
        {'                          ║\n║      '}
        <Sprite>{'/ \\'}</Sprite>
        {'    *an esper, watching* ║\n║     '}
        <Sprite>{'✦   ✦'}</Sprite>
        {'                        ║\n╚══════════════════════════════════╝'}
      </pre>
    );
  }

  return (
    <pre ref={ref} className="cfe-esper-cameo">
      {'╔══════════════════════════════════╗\n║       '}
      <Sprite>✦</Sprite>
      {'                          ║\n║      '}
      <Sprite>{'/|\\'}</Sprite>
      {'    *the esper has lost  ║\n║     '}
      <Sprite>{'✦-✦-✦'}</Sprite>
      {'   a little of her      ║\n║              color since Mobliz.*║\n╚══════════════════════════════════╝'}
    </pre>
  );
}
