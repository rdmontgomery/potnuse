import { K, FONTS } from '@/lib/allons-jouer/tokens';
import type { BellowsDir } from '@/lib/allons-jouer/types';

interface Props {
  dir: BellowsDir;
  onToggle: () => void;
}

export function BellowsToggle({ dir, onToggle }: Props) {
  return (
    <div style={{
      display: 'flex', borderRadius: 10, overflow: 'hidden',
      border: `1.5px solid ${K.border}`, width: '100%', marginBottom: 12,
    }}>
      {(['push', 'pull'] as const).map(d => {
        const isActive = dir === d;
        const isPush = d === 'push';
        const activeColor = isPush ? K.pushBright : K.pullBright;
        return (
          <button key={d} onClick={() => !isActive && onToggle()} style={{
            flex: 1, padding: '14px 0',
            background: isActive ? (isPush ? K.push + '44' : K.pull + '44') : K.bgButton,
            border: 'none',
            borderRight: isPush ? `1px solid ${K.border}` : 'none',
            cursor: isActive ? 'default' : 'pointer',
            fontFamily: FONTS.serif, fontSize: 16, fontWeight: 700,
            color: isActive ? activeColor : K.textMuted,
            letterSpacing: 2, textTransform: 'uppercase',
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
            transition: 'all 0.15s',
          }}>
            <span style={{ fontSize: 12 }}>{isPush ? '◀' : '▶'}</span>
            {d}
          </button>
        );
      })}
    </div>
  );
}
