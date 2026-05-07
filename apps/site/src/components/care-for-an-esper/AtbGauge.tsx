import { useEsperStore } from './state';

const SEGMENTS = 32;

export function AtbGauge() {
  const progress = useEsperStore((s) => s.atbProgress);
  const filled = Math.round(progress * SEGMENTS);
  const bar = '▌'.repeat(filled) + '░'.repeat(SEGMENTS - filled);
  return (
    <div className="cfe-atb" aria-label={`ATB ${Math.round(progress * 100)}%`}>
      <span className="cfe-atb-label">ATB</span>
      <span className="cfe-atb-bar">{bar}</span>
    </div>
  );
}
