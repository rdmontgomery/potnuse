import { useEsperStore } from './state';

// Match EsperCameo's vibrancy treatment: desaturate as engagement
// drops, fade slightly. The italic prose just above each cameo
// does the framing ('she is lighter or heavier than she was');
// the visual is the state.
function vibrancyFilter(v: number): string {
  const sat = 0.25 + v * 0.75;
  const bright = 0.85 + v * 0.15;
  return `saturate(${sat}) brightness(${bright})`;
}

function vibrancyOpacity(v: number): number {
  return 0.55 + v * 0.45;
}

export function CodaChocobo() {
  const v = useEsperStore((s) => s.chocoboVibrancy);
  return (
    <div className="cfe-coda-sprite" aria-hidden="true">
      <img
        src="/sprites/chocobo-walk.gif"
        alt=""
        width={120}
        height={128}
        draggable={false}
        style={{
          filter: vibrancyFilter(v),
          opacity: vibrancyOpacity(v),
        }}
      />
    </div>
  );
}

export function CodaEsper() {
  const v = useEsperStore((s) => s.esperVibrancy);
  return (
    <div className="cfe-coda-sprite" aria-hidden="true">
      <img
        src="/sprites/magicite.gif"
        alt=""
        width={48}
        height={84}
        draggable={false}
        style={{
          filter: vibrancyFilter(v),
          opacity: vibrancyOpacity(v),
        }}
      />
    </div>
  );
}
