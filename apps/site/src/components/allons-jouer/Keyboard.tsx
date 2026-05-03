import { K, FONTS } from '@/lib/allons-jouer/tokens';
import type { DetectedNote } from '@/lib/allons-jouer/types';

interface KeyboardKey {
  note: string;
  letter: string;
  octave: number;
  freq: number;
}

// Cajun-in-C is diatonic, so we render only the white keys covering the full
// phrase range (C4 through G5). Twelve keys fit comfortably across a phone
// portrait at min-width 28px each, and stretch on wider screens.
const KEYS: KeyboardKey[] = [
  { note: 'C4', letter: 'C', octave: 4, freq: 261.63 },
  { note: 'D4', letter: 'D', octave: 4, freq: 293.66 },
  { note: 'E4', letter: 'E', octave: 4, freq: 329.63 },
  { note: 'F4', letter: 'F', octave: 4, freq: 349.23 },
  { note: 'G4', letter: 'G', octave: 4, freq: 392.00 },
  { note: 'A4', letter: 'A', octave: 4, freq: 440.00 },
  { note: 'B4', letter: 'B', octave: 4, freq: 493.88 },
  { note: 'C5', letter: 'C', octave: 5, freq: 523.25 },
  { note: 'D5', letter: 'D', octave: 5, freq: 587.33 },
  { note: 'E5', letter: 'E', octave: 5, freq: 659.26 },
  { note: 'F5', letter: 'F', octave: 5, freq: 698.46 },
  { note: 'G5', letter: 'G', octave: 5, freq: 783.99 },
];

interface Props {
  detectedNote: DetectedNote | null;
  demoNote?: DetectedNote | null;
  highlightNote?: string;
  onKeyDown: (note: string, freq: number) => void;
  onKeyUp: () => void;
}

export function Keyboard({ detectedNote, demoNote, highlightNote, onKeyDown, onKeyUp }: Props) {
  return (
    <div style={{
      display: 'flex',
      gap: 2,
      background: K.bgCard,
      border: `1px solid ${K.border}`,
      borderRadius: 8,
      padding: 6,
      width: '100%',
    }}>
      {KEYS.map(k => {
        const isTarget = highlightNote === k.note;
        const isPressed = detectedNote?.note === k.note;
        const isDemo = !isPressed && demoNote?.note === k.note;

        let bg: string = K.text;     // ivory white
        let fg: string = K.bg;       // dark text
        let border: string = K.border;
        if (isPressed) {
          bg = K.accent;
          fg = K.bg;
          border = K.accent;
        } else if (isDemo) {
          bg = K.highlight;
          fg = K.bg;
          border = K.highlight;
        } else if (isTarget) {
          bg = K.accent + '33';
          fg = K.accent;
          border = K.accent;
        }

        return (
          <button
            key={k.note}
            onPointerDown={e => { e.preventDefault(); onKeyDown(k.note, k.freq); }}
            onPointerUp={onKeyUp}
            onPointerLeave={onKeyUp}
            onPointerCancel={onKeyUp}
            style={{
              flex: 1,
              minWidth: 28,
              height: 130,
              display: 'flex', flexDirection: 'column',
              alignItems: 'center', justifyContent: 'flex-end',
              gap: 2,
              padding: '8px 4px',
              background: bg, color: fg,
              border: `2px solid ${border}`,
              borderRadius: '0 0 8px 8px',
              cursor: 'pointer',
              touchAction: 'none',
              fontFamily: FONTS.serif,
              transition: 'background 0.1s, border-color 0.1s, color 0.1s',
              position: 'relative',
              ...(isDemo ? { boxShadow: `0 0 0 3px ${K.highlight}99` } : {}),
              ...(isTarget && !isPressed && !isDemo ? { boxShadow: `0 0 0 2px ${K.accent}66` } : {}),
            }}
          >
            <span style={{ fontSize: 22, fontWeight: 600, lineHeight: 1 }}>{k.letter}</span>
            <span style={{ fontSize: 10, fontFamily: FONTS.mono, opacity: 0.6 }}>{k.octave}</span>
            {isTarget && !isPressed && !isDemo && (
              <span style={{
                position: 'absolute', inset: 0,
                border: `2px solid ${K.accent}`,
                borderRadius: '0 0 8px 8px',
                animation: 'targetPulse 1.2s ease-in-out infinite',
                pointerEvents: 'none',
              }} />
            )}
          </button>
        );
      })}
    </div>
  );
}
