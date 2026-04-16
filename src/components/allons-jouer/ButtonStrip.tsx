import { ACCORDION_NOTES } from '@/lib/allons-jouer/accordion';
import { K, FONTS } from '@/lib/allons-jouer/tokens';
import type { BellowsDir, DetectedNote } from '@/lib/allons-jouer/types';

interface Props {
  detectedNote: DetectedNote | null;
  highlightButton?: number;
  highlightDir?: BellowsDir;
  compact?: boolean;
  onNoteDown: (button: number, dir: BellowsDir) => void;
  onNoteUp: () => void;
}

export function ButtonStrip({ detectedNote, highlightButton, highlightDir, compact, onNoteDown, onNoteUp }: Props) {
  const buttons = [...ACCORDION_NOTES].reverse(); // 10 → 1 (high to low)
  const pad = compact ? '8px 10px' : '13px 20px';
  const noteSize = compact ? 15 : 18;
  const numSize = compact ? 11 : 13;

  return (
    <div style={{
      border: `1px solid ${K.border}`,
      borderRadius: 12,
      padding: compact ? 6 : 10,
      background: K.bgCard,
      display: 'flex', flexDirection: 'column', gap: compact ? 2 : 4,
      position: 'relative',
    }}>
      {/* Push + pull key — both up top */}
      <div style={{
        display: 'flex', flexDirection: 'column', gap: 4,
        paddingBottom: compact ? 6 : 8,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{ flex: 1, height: 2, borderRadius: 1, background: K.push, opacity: 0.7 }} />
          <span style={{
            fontSize: 9, fontFamily: FONTS.mono, color: K.push, opacity: 0.8,
            textTransform: 'uppercase', letterSpacing: 2,
          }}>push</span>
          <div style={{ flex: 1, height: 2, borderRadius: 1, background: K.push, opacity: 0.7 }} />
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{ flex: 1, height: 2, borderRadius: 1, background: K.pull, opacity: 0.7 }} />
          <span style={{
            fontSize: 9, fontFamily: FONTS.mono, color: K.pull, opacity: 0.8,
            textTransform: 'uppercase', letterSpacing: 2,
          }}>pull</span>
          <div style={{ flex: 1, height: 2, borderRadius: 1, background: K.pull, opacity: 0.7 }} />
        </div>
      </div>

      {buttons.map(btn => {
        const pushInfo = btn.push;
        const pullInfo = btn.pull;
        const isPushTarget = highlightButton === btn.button && highlightDir === 'push';
        const isPullTarget = highlightButton === btn.button && highlightDir === 'pull';
        const isPushDetected = detectedNote?.button === btn.button && detectedNote?.dir === 'push';
        const isPullDetected = detectedNote?.button === btn.button && detectedNote?.dir === 'pull';

        return (
          <div key={btn.button} style={{
            display: 'flex', alignItems: 'center',
            borderRadius: 8, overflow: 'hidden',
            border: `1.5px solid ${K.border}`,
            position: 'relative',
          }}>
            {/* Push zone (left) */}
            <button
              onPointerDown={e => { e.preventDefault(); onNoteDown(btn.button, 'push'); }}
              onPointerUp={onNoteUp}
              onPointerLeave={onNoteUp}
              onPointerCancel={onNoteUp}
              style={{
                flex: 1, padding: pad, cursor: 'pointer', touchAction: 'none',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4,
                background: isPushDetected ? K.pushBright + '44'
                  : isPushTarget ? K.push + '33'
                  : K.bgButton,
                border: 'none', borderRight: `1px solid ${K.border}`,
                transition: 'all 0.1s', position: 'relative', overflow: 'hidden',
              }}
            >
              <span style={{
                fontSize: noteSize, fontWeight: 700, fontFamily: FONTS.mono,
                color: isPushDetected ? '#fff' : isPushTarget ? K.pushBright : K.push,
              }}>
                {'→ '}{pushInfo.note}{' ←'}
              </span>
              {isPushTarget && !isPushDetected && (
                <span style={{ position: 'absolute', inset: 0, border: `2px solid ${K.pushBright}`, animation: 'targetPulse 1.2s ease-in-out infinite', pointerEvents: 'none' }} />
              )}
              {isPushDetected && (
                <span style={{ position: 'absolute', inset: -1, background: K.pushBright + '22', animation: 'noteHit 0.3s ease-out', pointerEvents: 'none' }} />
              )}
            </button>

            {/* Button number (center) */}
            <div style={{
              minWidth: compact ? 28 : 36, textAlign: 'center',
              fontSize: numSize, fontFamily: FONTS.mono, color: K.textMuted,
              background: K.bgButton, padding: `${compact ? 8 : 13}px 0`,
              userSelect: 'none',
            }}>
              {btn.button}
            </div>

            {/* Pull zone (right) */}
            <button
              onPointerDown={e => { e.preventDefault(); onNoteDown(btn.button, 'pull'); }}
              onPointerUp={onNoteUp}
              onPointerLeave={onNoteUp}
              onPointerCancel={onNoteUp}
              style={{
                flex: 1, padding: pad, cursor: 'pointer', touchAction: 'none',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4,
                background: isPullDetected ? K.pullBright + '44'
                  : isPullTarget ? K.pull + '33'
                  : K.bgButton,
                border: 'none', borderLeft: `1px solid ${K.border}`,
                transition: 'all 0.1s', position: 'relative', overflow: 'hidden',
              }}
            >
              <span style={{
                fontSize: noteSize, fontWeight: 700, fontFamily: FONTS.mono,
                color: isPullDetected ? '#fff' : isPullTarget ? K.pullBright : K.pull,
              }}>
                {'← '}{pullInfo.note}{' →'}
              </span>
              {isPullTarget && !isPullDetected && (
                <span style={{ position: 'absolute', inset: 0, border: `2px solid ${K.pullBright}`, animation: 'targetPulse 1.2s ease-in-out infinite', pointerEvents: 'none' }} />
              )}
              {isPullDetected && (
                <span style={{ position: 'absolute', inset: -1, background: K.pullBright + '22', animation: 'noteHit 0.3s ease-out', pointerEvents: 'none' }} />
              )}
            </button>
          </div>
        );
      })}

    </div>
  );
}
