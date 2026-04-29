import { K } from '@/lib/allons-jouer/tokens';
import type { TimingResult } from '@/lib/allons-jouer/types';

const TIMING_COLORS: Record<TimingResult, string> = { good: K.success, ok: '#e8a838', off: K.pull };
const TIMING_LABELS: Record<TimingResult, string> = { good: '♪', ok: '~', off: '✧' };

interface Props {
  targetDuration: number;
  holdProgress: number;
  timingResult: TimingResult | null;
}

export function HoldRing({ targetDuration, holdProgress, timingResult }: Props) {
  const pct = targetDuration > 0 ? Math.min((holdProgress / targetDuration) * 100, 150) : 0;
  const circumference = 2 * Math.PI * 28;
  const dashOffset = circumference - (Math.min(pct, 100) / 100) * circumference;
  const isOver = pct > 110;
  const strokeColor = isOver ? K.pull : pct > 60 ? K.success : K.accent;

  return (
    <div style={{ position: 'relative', width: 68, height: 68, margin: '0 auto 8px' }}>
      <svg width="68" height="68" style={{ transform: 'rotate(-90deg)' }}>
        <circle cx="34" cy="34" r="28" fill="none" stroke={K.bgButton} strokeWidth="4" />
        <circle cx="34" cy="34" r="28" fill="none" stroke={strokeColor} strokeWidth="4"
          strokeDasharray={circumference} strokeDashoffset={dashOffset}
          strokeLinecap="round" style={{ transition: 'stroke 0.15s' }} />
      </svg>
      {timingResult && (
        <div style={{
          position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 22, animation: 'timingPop 0.8s ease-out forwards', color: TIMING_COLORS[timingResult],
        }}>
          {TIMING_LABELS[timingResult]}
        </div>
      )}
    </div>
  );
}
