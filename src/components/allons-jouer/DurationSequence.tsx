import { useEffect, useRef } from 'react';
import { ACCORDION_NOTES } from '@/lib/allons-jouer/accordion';
import { K, FONTS } from '@/lib/allons-jouer/tokens';
import type { Song } from '@/lib/allons-jouer/types';

interface Props { song: Song; step: number; isComplete: boolean; }

export function DurationSequence({ song, step, isComplete }: Props) {
  const maxDur = Math.max(...song.notes.map(n => n.duration));
  const minDur = Math.min(...song.notes.map(n => n.duration));
  const pxPerMs = 32 / minDur;
  const scrollRef = useRef<HTMLDivElement>(null);
  const noteRefs = useRef<(HTMLDivElement | null)[]>([]);

  useEffect(() => {
    const el = noteRefs.current[step];
    const container = scrollRef.current;
    if (!el || !container) return;
    container.scrollTo({ left: Math.max(0, el.offsetLeft - container.clientWidth / 2 + el.offsetWidth / 2), behavior: 'smooth' });
  }, [step]);

  return (
    <div ref={scrollRef} style={{ overflowX: 'auto', marginBottom: 16, padding: '0 4px', scrollbarWidth: 'none' }}>
      <div style={{ display: 'flex', gap: 3, alignItems: 'end', height: 44 }}>
        {song.notes.map((n, i) => {
          const info = ACCORDION_NOTES.find(b => b.button === n.button);
          const noteStr = info ? info[n.dir].note.replace(/\d/, '') : '?';
          const isCurrent = i === step && !isComplete;
          const isPast = i < step || isComplete;
          const baseCol = n.dir === 'push' ? K.push : K.pull;

          return (
            <div key={i} ref={el => { noteRefs.current[i] = el; }} style={{ flex: `0 0 ${n.duration * pxPerMs}px`, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
              <div style={{ fontSize: 9, fontFamily: FONTS.mono, color: isCurrent ? K.accent : isPast ? K.success : K.textMuted, fontWeight: isCurrent ? 700 : 400 }}>{noteStr}</div>
              <div style={{ width: '100%', height: n.duration / maxDur * 20 + 4, borderRadius: 2, background: isCurrent ? K.accent + '55' : isPast ? K.success + '33' : baseCol + '22', border: `1px solid ${isCurrent ? K.accent : isPast ? K.success + '44' : baseCol + '33'}`, transition: 'all 0.2s' }} />
            </div>
          );
        })}
      </div>
    </div>
  );
}
