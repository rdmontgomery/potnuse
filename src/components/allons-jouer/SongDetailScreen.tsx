import { useState } from 'react';
import { K, FONTS } from '@/lib/allons-jouer/tokens';
import { SONGS } from '@/lib/allons-jouer/songs';
import { useAppStore } from '@/lib/allons-jouer/useAppStore';
import type { LessonMode } from '@/lib/allons-jouer/types';

const TEMPO_OPTIONS: { ratio: number; label: string; sublabel: string }[] = [
  { ratio: 0.6, label: '60%', sublabel: 'Slow' },
  { ratio: 0.8, label: '80%', sublabel: 'Practice' },
  { ratio: 1.0, label: '100%', sublabel: 'Full Speed' },
];

export function SongDetailScreen() {
  const { selectedSong, goHome, startLesson } = useAppStore();
  const [mode, setMode] = useState<LessonMode>('ownPace');
  const [tempoRatio, setTempoRatio] = useState(1.0);

  const song = SONGS.find(s => s.id === selectedSong);
  if (!song) return null;

  return (
    <div style={{ maxWidth: 480, margin: '0 auto', padding: '40px 20px' }}>
      <button onClick={goHome} style={{
        background: 'none', border: 'none', color: K.textDim,
        cursor: 'pointer', fontSize: 14, fontFamily: FONTS.serif,
        marginBottom: 24, padding: 0,
      }}>← Back</button>

      {/* Song title + difficulty */}
      <div style={{ marginBottom: 28 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
          <h2 style={{
            fontSize: 26, fontWeight: 700, margin: 0, fontFamily: FONTS.serif,
            background: `linear-gradient(135deg, ${K.accent}, ${K.highlight})`,
            WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
          }}>{song.title}</h2>
          <div style={{ display: 'flex', gap: 3, flexShrink: 0 }}>
            {[1, 2, 3].map(d => (
              <div key={d} style={{ width: 8, height: 8, borderRadius: '50%', background: d <= song.difficulty ? K.accent : K.bgButton }} />
            ))}
          </div>
        </div>
        <p style={{ margin: 0, fontSize: 14, color: K.textDim, fontFamily: FONTS.serif, lineHeight: 1.5 }}>
          {song.description}
        </p>
      </div>

      {/* Mode picker */}
      <div style={{ marginBottom: 24 }}>
        <div style={{ fontSize: 11, fontWeight: 600, color: K.textMuted, textTransform: 'uppercase', letterSpacing: 1.5, marginBottom: 10, fontFamily: FONTS.serif }}>
          Mode
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          {(['ownPace', 'keepUp'] as const).map(m => {
            const active = mode === m;
            return (
              <button key={m} onClick={() => setMode(m)} style={{
                flex: 1, padding: '12px 16px', borderRadius: 8, cursor: 'pointer',
                background: active ? K.accent + '22' : K.bgCard,
                border: `1px solid ${active ? K.accent + '66' : K.border}`,
                color: active ? K.accent : K.textDim,
                fontSize: 14, fontFamily: FONTS.serif, fontWeight: active ? 600 : 400,
                textAlign: 'center',
              }}>
                <div>{m === 'ownPace' ? 'Own Pace' : 'Keep Up'}</div>
                <div style={{ fontSize: 11, color: active ? K.accent + 'aa' : K.textMuted, marginTop: 3 }}>
                  {m === 'ownPace' ? 'You control the pace' : 'Song sets the tempo'}
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Tempo picker — Keep Up only */}
      {mode === 'keepUp' && (
        <div style={{ marginBottom: 24 }}>
          <div style={{ fontSize: 11, fontWeight: 600, color: K.textMuted, textTransform: 'uppercase', letterSpacing: 1.5, marginBottom: 10, fontFamily: FONTS.serif }}>
            Tempo
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            {TEMPO_OPTIONS.map(opt => {
              const active = tempoRatio === opt.ratio;
              return (
                <button key={opt.ratio} onClick={() => setTempoRatio(opt.ratio)} style={{
                  flex: 1, padding: '12px 8px', borderRadius: 8, cursor: 'pointer',
                  background: active ? K.highlight + '22' : K.bgCard,
                  border: `1px solid ${active ? K.highlight + '66' : K.border}`,
                  color: active ? K.highlight : K.textDim,
                  fontSize: 14, fontFamily: FONTS.serif, fontWeight: active ? 700 : 400,
                  textAlign: 'center',
                }}>
                  <div>{opt.label}</div>
                  <div style={{ fontSize: 11, color: active ? K.highlight + 'aa' : K.textMuted, marginTop: 3 }}>
                    {opt.sublabel}
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Start button */}
      <button
        onClick={() => startLesson(song.id, mode, mode === 'keepUp' ? tempoRatio : 1)}
        style={{
          width: '100%', padding: '16px 24px', marginTop: 8,
          background: `linear-gradient(135deg, ${K.accent}, ${K.accentDim})`,
          border: 'none', borderRadius: 12, cursor: 'pointer',
          color: K.bg, fontSize: 18, fontWeight: 700, fontFamily: FONTS.serif,
          boxShadow: `0 4px 20px ${K.accent}33`,
        }}
      >
        Start →
      </button>
    </div>
  );
}
