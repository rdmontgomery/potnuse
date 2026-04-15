import { useCallback } from 'react';
import { K, FONTS } from '@/lib/allons-jouer/tokens';
import { useAppStore } from '@/lib/allons-jouer/useAppStore';
import { SONGS } from '@/lib/allons-jouer/songs';
import { ACCORDION_NOTES } from '@/lib/allons-jouer/accordion';
import { ButtonStrip } from '@/components/allons-jouer/ButtonStrip';
import { NoteTrack } from '@/components/allons-jouer/NoteTrack';
import { CulturalCard } from '@/components/allons-jouer/CulturalCard';
import { useAudio } from '@/lib/allons-jouer/useAudio';
import { useMic } from '@/lib/allons-jouer/useMic';
import { useLesson } from '@/lib/allons-jouer/useLesson';
import { useTrackScroll } from '@/lib/allons-jouer/useTrackScroll';
import { useMediaQuery } from '@/lib/allons-jouer/useMediaQuery';
import type { LessonMode } from '@/lib/allons-jouer/types';

export function LessonScreen() {
  const {
    selectedSong, lessonStep, detectedNote, demoNote,
    inputMode, setInputMode, micError, streak, completedSongs,
    isPlaying, lessonMode, trackPosition, tempoRatio,
    goHome, restartLesson, setLessonMode, setTrackPosition,
  } = useAppStore();

  const { handlePointerDown, handlePointerUp, playDemo, stopDemo } = useAudio();
  const { startListening, stopListening } = useMic();
  useLesson();
  const isWide = useMediaQuery('(min-width: 900px)');

  const song = SONGS.find(s => s.id === selectedSong);

  // Track scrolling for keepUp mode
  const isKeepUpActive = lessonMode === 'keepUp' && !!song && lessonStep < (song?.notes.length ?? 0);

  const onTick = useCallback((ms: number) => {
    setTrackPosition(ms);
  }, [setTrackPosition]);

  useTrackScroll(isKeepUpActive, onTick, tempoRatio);

  if (!song) return null;

  const isComplete = completedSongs.includes(song.id) && lessonStep >= song.notes.length - 1;
  const target = !isComplete && lessonStep < song.notes.length ? song.notes[lessonStep] : null;
  const targetBtn = target ? ACCORDION_NOTES.find(b => b.button === target.button) : null;
  const targetNoteName = targetBtn && target ? targetBtn[target.dir].note : '';
  const progress = ((lessonStep + (isComplete ? 1 : 0)) / song.notes.length) * 100;

  const toggleMode = () => {
    if (inputMode === 'virtual') { setInputMode('mic'); startListening(); }
    else { setInputMode('virtual'); stopListening(); }
  };

  const handleModeChange = (mode: LessonMode) => {
    if (mode !== lessonMode) setLessonMode(mode);
  };

  return (
    <div style={{ maxWidth: isWide ? 1100 : 480, margin: '0 auto', padding: isWide ? '20px 32px 40px' : '20px 20px 40px' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <button onClick={goHome} style={{ background: 'none', border: 'none', color: K.textDim, cursor: 'pointer', fontSize: 14, fontFamily: FONTS.serif }}>← Back</button>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          {streak > 2 && <span style={{ fontSize: 13, color: K.highlight, fontWeight: 600 }}>🔥 {streak}</span>}
          <button onClick={toggleMode} style={{ padding: '6px 14px', borderRadius: 20, cursor: 'pointer', background: inputMode === 'mic' ? K.success + '18' : K.bgButton, border: `1px solid ${K.border}`, color: inputMode === 'mic' ? K.success : K.textDim, fontSize: 12, fontFamily: FONTS.serif }}>
            {inputMode === 'mic' ? '🎤 Mic' : '👆 Virtual'}
          </button>
        </div>
      </div>

      {/* Title + demo */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 8 }}>
        <h2 style={{ fontSize: 22, fontWeight: 700, margin: 0, color: K.accent, fontFamily: FONTS.serif }}>{song.title}</h2>
        <button onClick={() => isPlaying ? stopDemo() : playDemo(song)} style={{ background: isPlaying ? K.pull + '22' : K.accent + '22', border: `1px solid ${isPlaying ? K.pull + '44' : K.accent + '44'}`, borderRadius: 6, padding: '5px 12px', cursor: 'pointer', color: isPlaying ? K.pullBright : K.accent, fontSize: 12, fontFamily: FONTS.serif }}>
          {isPlaying ? '■ Stop' : '▶ Demo'}
        </button>
      </div>

      {/* Progress bar */}
      <div style={{ width: '100%', height: 4, borderRadius: 2, background: K.bgButton, marginBottom: 12, overflow: 'hidden' }}>
        <div style={{ width: `${progress}%`, height: '100%', borderRadius: 2, background: `linear-gradient(90deg, ${K.push}, ${K.accent})`, transition: 'width 0.4s ease-out' }} />
      </div>

      {/* Mode picker */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 12 }}>
        {(['ownPace', 'keepUp'] as const).map(mode => {
          const active = lessonMode === mode;
          const label = mode === 'ownPace' ? 'Own Pace' : 'Keep Up';
          return (
            <button key={mode} onClick={() => handleModeChange(mode)} style={{
              padding: '5px 16px', borderRadius: 6, cursor: 'pointer',
              background: active ? K.accent + '22' : K.bgButton,
              border: `1px solid ${active ? K.accent + '44' : K.border}`,
              color: active ? K.accent : K.textDim,
              fontSize: 12, fontFamily: FONTS.serif, fontWeight: active ? 600 : 400,
            }}>
              {label}
            </button>
          );
        })}
      </div>

      {/* Mic error */}
      {micError && (
        <div style={{ padding: 12, borderRadius: 8, marginBottom: 12, background: K.pull + '22', border: `1px solid ${K.pull}44`, color: K.pullBright, fontSize: 13 }}>{micError}</div>
      )}

      {/* Note track */}
      <div style={{ marginBottom: 16, position: 'relative' }}>
        <NoteTrack
          song={song}
          lessonStep={lessonStep}
          mode={lessonMode}
          trackPosition={trackPosition}
          detectedNote={detectedNote}
          demoNote={demoNote}
          isPlaying={isPlaying}
          isComplete={isComplete}
        />

        {/* Completion overlay */}
        {isComplete && (
          <div style={{
            position: 'absolute', inset: 0, borderRadius: 8,
            background: K.bg + 'ee',
            display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
            zIndex: 10,
          }}>
            <div style={{ fontSize: 48, marginBottom: 12 }}>🎉</div>
            <div style={{ fontSize: 20, fontWeight: 700, color: K.success, marginBottom: 4, fontFamily: FONTS.serif }}>Laissez les bons temps rouler!</div>
            <div style={{ fontSize: 14, color: K.textDim, marginBottom: 20, fontFamily: FONTS.serif }}>You nailed it.</div>
            <div style={{ display: 'flex', gap: 12 }}>
              <button onClick={restartLesson} style={{ padding: '10px 20px', borderRadius: 8, cursor: 'pointer', background: K.bgButton, border: `1px solid ${K.border}`, color: K.text, fontFamily: FONTS.serif, fontSize: 14 }}>Again</button>
              <button onClick={goHome} style={{ padding: '10px 20px', borderRadius: 8, cursor: 'pointer', background: K.accent, border: 'none', color: K.bg, fontWeight: 600, fontFamily: FONTS.serif, fontSize: 14 }}>Back to Lessons</button>
            </div>
          </div>
        )}
      </div>

      {/* Current note hint (compact, below track) */}
      {target && !isComplete && (
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12,
          padding: '8px 16px', marginBottom: 12,
          background: K.bgCard, borderRadius: 8, border: `1px solid ${K.border}`,
        }}>
          <span style={{ fontSize: 11, color: K.textMuted, fontFamily: FONTS.serif }}>
            Note {lessonStep + 1}/{song.notes.length}
          </span>
          <span style={{
            fontSize: 16, fontWeight: 700, fontFamily: FONTS.mono,
            color: target.dir === 'push' ? K.pushBright : K.pullBright,
          }}>
            {target.dir === 'push' ? '>' : '<'}
            {targetNoteName}
            {target.dir === 'push' ? '<' : '>'}
          </span>
          <span style={{
            fontSize: 11, color: target.dir === 'push' ? K.push : K.pull,
            textTransform: 'uppercase', fontFamily: FONTS.serif,
          }}>
            {target.dir} btn {target.button}
          </span>
          <span style={{ fontSize: 11, color: K.textMuted, fontFamily: FONTS.serif }}>
            ~{(target.duration / 1000).toFixed(1)}s
          </span>
        </div>
      )}

      {/* Button strip */}
      <ButtonStrip
        detectedNote={detectedNote}
        highlightButton={target?.button}
        highlightDir={target?.dir}
        onNoteDown={handlePointerDown}
        onNoteUp={handlePointerUp}
      />

      {/* Cultural card */}
      {song.cultural && (
        <div style={{ marginTop: 16 }}>
          <CulturalCard card={song.cultural} autoExpand={isComplete} />
        </div>
      )}
    </div>
  );
}
