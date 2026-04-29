import { K, FONTS } from '@/lib/allons-jouer/tokens';
import { useAppStore } from '@/lib/allons-jouer/useAppStore';
import { ButtonStrip } from '@/components/allons-jouer/ButtonStrip';
import { PitchIndicator } from '@/components/allons-jouer/PitchIndicator';
import { useAudio } from '@/lib/allons-jouer/useAudio';
import { useMic } from '@/lib/allons-jouer/useMic';
import { useMediaQuery } from '@/lib/allons-jouer/useMediaQuery';

export function FreePlayScreen() {
  const { goHome, detectedNote, inputMode, setInputMode, micError } = useAppStore();
  const { handlePointerDown, handlePointerUp } = useAudio();
  const { startListening, stopListening } = useMic();
  const isWide = useMediaQuery('(min-width: 900px)');

  const toggleMode = () => {
    if (inputMode === 'virtual') { setInputMode('mic'); startListening(); }
    else { setInputMode('virtual'); stopListening(); }
  };

  const title = (
    <>
      <h2 style={{ fontSize: 22, fontWeight: 700, margin: '0 0 4px 0', color: K.accent, fontFamily: FONTS.serif }}>Free Play</h2>
      <p style={{ fontSize: 13, color: K.textDim, margin: '0 0 20px 0', fontFamily: FONTS.serif }}>
        {inputMode === 'virtual' ? 'Tap green (push ►) or red (pull ◄) side of any button.' : 'Play your accordion near the mic.'}
      </p>
    </>
  );

  const errorBlock = micError && (
    <div style={{ padding: 12, borderRadius: 8, marginBottom: 16, background: K.pull + '22', border: `1px solid ${K.pull}44`, color: K.pullBright, fontSize: 13 }}>{micError}</div>
  );

  const pitchBlock = (
    <div style={{ marginBottom: 16 }}><PitchIndicator detectedNote={detectedNote} /></div>
  );

  const buttons = (
    <ButtonStrip detectedNote={detectedNote} onNoteDown={handlePointerDown} onNoteUp={handlePointerUp} />
  );

  return (
    <div style={{ maxWidth: isWide ? 1100 : 480, margin: '0 auto', padding: isWide ? '20px 32px 40px' : '20px 20px 40px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <button onClick={goHome} style={{ background: 'none', border: 'none', color: K.textDim, cursor: 'pointer', fontSize: 14, fontFamily: FONTS.serif }}>← Back</button>
        <button onClick={toggleMode} style={{
          padding: '6px 14px', borderRadius: 20, cursor: 'pointer',
          background: inputMode === 'mic' ? K.success + '18' : K.bgButton,
          border: `1px solid ${inputMode === 'mic' ? K.success + '55' : K.border}`,
          color: inputMode === 'mic' ? K.success : K.textDim, fontSize: 12, fontFamily: FONTS.serif,
        }}>
          {inputMode === 'mic' ? '🎤 Mic' : '👆 Virtual'} → {inputMode === 'mic' ? 'virtual' : 'mic'}
        </button>
      </div>

      {isWide ? (
        <div style={{ display: 'flex', gap: 32, alignItems: 'flex-start' }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            {title}
            {errorBlock}
            {pitchBlock}
          </div>
          <div style={{ width: 380, flexShrink: 0, position: 'sticky', top: 20 }}>
            {buttons}
          </div>
        </div>
      ) : (
        <>
          {title}
          {errorBlock}
          {pitchBlock}
          {buttons}
        </>
      )}
    </div>
  );
}
