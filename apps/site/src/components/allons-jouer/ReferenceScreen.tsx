import { K, FONTS } from '@/lib/allons-jouer/tokens';
import { useAppStore } from '@/lib/allons-jouer/useAppStore';
import { ACCORDION_NOTES } from '@/lib/allons-jouer/accordion';
import { BellowsToggle } from '@/components/allons-jouer/BellowsToggle';
import { getAudioCtx, playTone } from '@/lib/allons-jouer/audio';

export function ReferenceScreen() {
  const { goHome, bellowsDir, toggleBellows } = useAppStore();

  return (
    <div style={{ maxWidth: 480, margin: '0 auto', padding: '20px 20px 40px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <button onClick={goHome} style={{ background: 'none', border: 'none', color: K.textDim, cursor: 'pointer', fontSize: 14, fontFamily: FONTS.serif }}>← Back</button>
      </div>

      <h2 style={{ fontSize: 22, fontWeight: 700, margin: '0 0 4px 0', color: K.accent, fontFamily: FONTS.serif }}>Note Reference</h2>
      <p style={{ fontSize: 13, color: K.textDim, margin: '0 0 16px 0', fontFamily: FONTS.serif }}>Set bellows direction, tap any row to hear it.</p>

      <BellowsToggle dir={bellowsDir} onToggle={toggleBellows} />

      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        {[...ACCORDION_NOTES].reverse().map(btn => {
          const info = btn[bellowsDir];
          return (
            <button key={btn.button} onClick={() => playTone(info.freq, 600, getAudioCtx())} style={{
              width: '100%', padding: '13px 20px',
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              background: K.bgButton, border: `1.5px solid ${K.border}`, borderRadius: 8, cursor: 'pointer',
            }}>
              <span style={{ fontSize: 13, fontFamily: FONTS.mono, color: K.textMuted, minWidth: 20 }}>{btn.button}</span>
              <span style={{ fontSize: 20, fontWeight: 700, fontFamily: FONTS.mono, color: K.text, flex: 1, textAlign: 'center' }}>{info.note}</span>
              <span style={{ fontSize: 11, fontFamily: FONTS.mono, color: K.textMuted, minWidth: 50, textAlign: 'right' }}>{info.freq.toFixed(0)} Hz</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
