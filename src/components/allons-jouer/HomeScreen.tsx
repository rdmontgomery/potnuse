import { K, FONTS } from '@/lib/allons-jouer/tokens';
import { SONGS } from '@/lib/allons-jouer/songs';
import { useAppStore } from '@/lib/allons-jouer/useAppStore';

export function HomeScreen() {
  const { selectSong, goTo, completedSongs } = useAppStore();

  return (
    <div style={{ maxWidth: 480, margin: '0 auto', padding: '40px 20px' }}>
      <div style={{ textAlign: 'center', marginBottom: 48 }}>
        <div style={{ fontSize: 48, marginBottom: 8 }}>🪗</div>
        <h1 style={{
          fontSize: 32, fontWeight: 700, margin: '0 0 4px 0', fontFamily: FONTS.serif,
          background: `linear-gradient(135deg, ${K.accent}, ${K.highlight})`,
          WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
        }}>Allons Jouer</h1>
        <p style={{ color: K.textDim, fontSize: 14, margin: 0, fontStyle: 'italic', fontFamily: FONTS.serif }}>
          Cajun Accordion in C — Learn by Playing
        </p>
      </div>

      <button onClick={() => goTo('freeplay')} style={{
        width: '100%', padding: '18px 24px', marginBottom: 10,
        background: `linear-gradient(135deg, ${K.accent}, ${K.accentDim})`,
        border: 'none', borderRadius: 12, cursor: 'pointer',
        color: K.bg, fontSize: 18, fontWeight: 700, fontFamily: FONTS.serif,
        boxShadow: `0 4px 20px ${K.accent}33`,
      }}>Free Play</button>

      <div style={{ display: 'flex', gap: 10, marginBottom: 32 }}>
        <button onClick={() => goTo('reference')} style={{
          flex: 1, padding: '14px 16px',
          background: K.bgCard, border: `1px solid ${K.border}`,
          borderRadius: 12, cursor: 'pointer',
          color: K.textDim, fontSize: 15, fontFamily: FONTS.serif,
        }}>Note Reference</button>
        <button onClick={() => goTo('tuner')} style={{
          flex: 1, padding: '14px 16px',
          background: K.bgCard, border: `1px solid ${K.border}`,
          borderRadius: 12, cursor: 'pointer',
          color: K.textDim, fontSize: 15, fontFamily: FONTS.serif,
        }}>Tuner</button>
      </div>

      <h2 style={{ fontSize: 14, fontWeight: 600, color: K.textDim, textTransform: 'uppercase', letterSpacing: 2, marginBottom: 16, fontFamily: FONTS.serif }}>
        Lessons
      </h2>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {SONGS.map(song => {
          const done = completedSongs.includes(song.id);
          return (
            <button key={song.id} onClick={() => selectSong(song.id)} style={{
              width: '100%', padding: '16px 20px', textAlign: 'left',
              background: done ? K.push + '15' : K.bgCard,
              border: `1px solid ${done ? K.push + '44' : K.border}`,
              borderRadius: 10, cursor: 'pointer', fontFamily: FONTS.serif,
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <div style={{ fontSize: 16, fontWeight: 600, color: K.text, marginBottom: 3 }}>
                    {done && <span style={{ color: K.success, marginRight: 8 }}>✓</span>}
                    {song.title}
                  </div>
                  <div style={{ fontSize: 13, color: K.textDim }}>{song.description}</div>
                </div>
                <div style={{ display: 'flex', gap: 3, flexShrink: 0, marginLeft: 12 }}>
                  {[1, 2, 3].map(d => <div key={d} style={{ width: 8, height: 8, borderRadius: '50%', background: d <= song.difficulty ? K.accent : K.bgButton }} />)}
                </div>
              </div>
            </button>
          );
        })}
      </div>

      <div style={{ marginTop: 40, padding: 20, borderRadius: 10, background: K.bgCard, border: `1px solid ${K.border}` }}>
        <h3 style={{ fontSize: 14, fontWeight: 600, color: K.accent, margin: '0 0 8px 0', fontFamily: FONTS.serif }}>How it works</h3>
        <p style={{ fontSize: 13, color: K.textDim, margin: 0, lineHeight: 1.6, fontFamily: FONTS.serif }}>
          Set the bellows direction, then press and hold a button to play. In lessons, the sequence bar shows what's coming. Tap Demo to hear it first. Switch to mic mode when you have your accordion.
        </p>
      </div>
    </div>
  );
}
