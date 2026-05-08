import { useEsperStore } from './state';

// Maps vibrancy [0,1] to the same warm-gold gradient used elsewhere.
// >=0.7 reads as full warm gold; <=0.3 desaturates to muted gray.
function vibrancyColor(v: number): string {
  const sat = Math.round(15 + v * 70);
  const light = Math.round(54 - v * 16);
  return `hsl(36, ${sat}%, ${light}%)`;
}

function vibrancyOpacity(v: number): number {
  return 0.55 + v * 0.45;
}

// The coda's two sprite reveals — bare ASCII, no dialogue chrome. The
// post's prose ('she is lighter or heavier than she was') does the
// framing; the visual just shows the reader what their reading made.
// Per the spec: no captions, no congratulation, no shame. The state of
// the sprite is the only feedback.

export function CodaChocobo() {
  const v = useEsperStore((s) => s.chocoboVibrancy);
  return (
    <div className="cfe-coda-sprite" aria-hidden="true">
      <pre style={{ color: vibrancyColor(v), opacity: vibrancyOpacity(v) }}>
        ⌒(•ㅅ•)⌒
      </pre>
    </div>
  );
}

export function CodaEsper() {
  const v = useEsperStore((s) => s.esperVibrancy);
  return (
    <div className="cfe-coda-sprite" aria-hidden="true">
      <pre style={{ color: vibrancyColor(v), opacity: vibrancyOpacity(v) }}>
{`  ✦
 /|\\
✦-✦-✦`}
      </pre>
    </div>
  );
}
