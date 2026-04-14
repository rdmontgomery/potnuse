import { K, FONTS } from '@/lib/allons-jouer/tokens';
import type { DetectedNote, BellowsDir } from '@/lib/allons-jouer/types';

interface Props {
  detectedNote: DetectedNote | null;
  targetButton?: number;
  targetDir?: BellowsDir;
}

export function PitchIndicator({ detectedNote, targetButton, targetDir }: Props) {
  const isCorrect = detectedNote && targetButton !== undefined
    && detectedNote.button === targetButton && detectedNote.dir === targetDir;

  return (
    <div style={{
      padding: '14px 20px', borderRadius: 10,
      background: isCorrect ? K.success + '15' : K.bgCard,
      border: `1px solid ${isCorrect ? K.success + '55' : K.border}`,
      textAlign: 'center', transition: 'background 0.2s, border-color 0.2s',
      height: 76, display: 'flex', flexDirection: 'column', justifyContent: 'center', boxSizing: 'border-box',
    }}>
      {detectedNote ? (
        <>
          <div style={{ fontSize: 28, fontWeight: 700, fontFamily: FONTS.mono, color: isCorrect ? K.success : K.text, lineHeight: 1 }}>{detectedNote.note}</div>
          <div style={{ fontSize: 12, color: K.textDim, marginTop: 4, fontFamily: FONTS.serif }}>
            Button {detectedNote.button} • <span style={{ color: detectedNote.dir === 'push' ? K.push : K.pull }}>{detectedNote.dir}</span>
          </div>
        </>
      ) : (
        <div style={{ color: K.textMuted, fontSize: 14, fontFamily: FONTS.serif }}>
          {targetButton ? 'Press and hold to play…' : 'Tap a button to play…'}
        </div>
      )}
    </div>
  );
}
