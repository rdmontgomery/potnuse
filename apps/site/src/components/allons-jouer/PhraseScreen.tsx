import { useEffect, useMemo, useRef, useState } from 'react';
import { K, FONTS } from '@/lib/allons-jouer/tokens';
import { useAppStore } from '@/lib/allons-jouer/useAppStore';
import { getAllPhrases } from '@/lib/allons-jouer/phrases';
import { ButtonStrip } from '@/components/allons-jouer/ButtonStrip';
import { NoteTrack } from '@/components/allons-jouer/NoteTrack';
import { useAudio } from '@/lib/allons-jouer/useAudio';
import { useMic } from '@/lib/allons-jouer/useMic';
import { useMediaQuery } from '@/lib/allons-jouer/useMediaQuery';
import type { Song } from '@/lib/allons-jouer/types';

const COMPLETION_DELAY = 900;

export function PhraseScreen() {
  const phraseCurrentId  = useAppStore(s => s.phraseCurrentId);
  const phraseStates     = useAppStore(s => s.phraseStates);
  const phraseStats      = useAppStore(s => s.phraseStats);
  const phraseStreak     = useAppStore(s => s.phraseStreak);
  const detectedNote     = useAppStore(s => s.detectedNote);
  const demoNote         = useAppStore(s => s.demoNote);
  const isPlaying        = useAppStore(s => s.isPlaying);
  const inputMode        = useAppStore(s => s.inputMode);
  const micError         = useAppStore(s => s.micError);
  const trackPosition    = useAppStore(s => s.trackPosition);
  const goHome           = useAppStore(s => s.goHome);
  const setInputMode     = useAppStore(s => s.setInputMode);
  const recordPhraseResult = useAppStore(s => s.recordPhraseResult);
  const resetPhraseProgress = useAppStore(s => s.resetPhraseProgress);

  const { handlePointerDown, handlePointerUp, playDemo, stopDemo } = useAudio();
  const { startListening, stopListening } = useMic();
  const isWide = useMediaQuery('(min-width: 900px)');

  // Local step counter — independent of the regular lesson screen's store step.
  const [step, setStep] = useState(0);
  const [feedback, setFeedback] = useState<null | 'correct' | 'incorrect'>(null);
  const lastFiredStepRef = useRef<number>(-1);
  const advanceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const allPhrases = useMemo(() => getAllPhrases(), []);
  const phrase = useMemo(() => allPhrases.find(p => p.id === phraseCurrentId) ?? null, [allPhrases, phraseCurrentId]);

  // Synthesize a Song from the active phrase so we can reuse NoteTrack and playDemo.
  const phraseSong: Song | null = useMemo(() => {
    if (!phrase) return null;
    const title = phrase.label
      ? `${phrase.songTitle} — ${phrase.label}`
      : phrase.songTitle;
    return {
      id: phrase.id,
      title,
      description: '',
      difficulty: 1,
      notes: phrase.notes,
    };
  }, [phrase]);

  // Reset step when the active phrase changes.
  useEffect(() => {
    setStep(0);
    setFeedback(null);
    lastFiredStepRef.current = -1;
    if (advanceTimerRef.current) {
      clearTimeout(advanceTimerRef.current);
      advanceTimerRef.current = null;
    }
  }, [phraseCurrentId]);

  // Detection: when the kid plays the target note (correct button + direction),
  // advance to the next note. 400ms debounce to avoid double-firing.
  useEffect(() => {
    if (!phrase || !detectedNote || isPlaying || feedback !== null) return;
    if (step >= phrase.notes.length) return;

    const target = phrase.notes[step];
    if (detectedNote.button !== target.button || detectedNote.dir !== target.dir) return;
    if (lastFiredStepRef.current === step) return;
    lastFiredStepRef.current = step;

    const t = setTimeout(() => {
      setStep(s => s + 1);
    }, 400);
    return () => clearTimeout(t);
  }, [detectedNote, phrase, step, isPlaying, feedback]);

  // Phrase complete → mark correct, schedule the SRS advance.
  useEffect(() => {
    if (!phrase) return;
    if (step < phrase.notes.length) return;
    if (feedback === 'correct') return;
    setFeedback('correct');
    if (advanceTimerRef.current) clearTimeout(advanceTimerRef.current);
    advanceTimerRef.current = setTimeout(() => {
      recordPhraseResult(true);
    }, COMPLETION_DELAY);
    return () => {
      if (advanceTimerRef.current) clearTimeout(advanceTimerRef.current);
    };
  }, [step, phrase, feedback, recordPhraseResult]);

  const handleSkip = () => {
    if (feedback === 'correct') return;
    setFeedback('incorrect');
    if (advanceTimerRef.current) clearTimeout(advanceTimerRef.current);
    advanceTimerRef.current = setTimeout(() => {
      recordPhraseResult(false);
    }, COMPLETION_DELAY);
  };

  const handleAgain = () => {
    setStep(0);
    setFeedback(null);
    lastFiredStepRef.current = -1;
    if (advanceTimerRef.current) {
      clearTimeout(advanceTimerRef.current);
      advanceTimerRef.current = null;
    }
  };

  const handleResetAll = () => {
    if (typeof window !== 'undefined' && !window.confirm('Reset all phrase progress?')) return;
    resetPhraseProgress();
    handleAgain();
  };

  const toggleMode = () => {
    if (inputMode === 'virtual') { setInputMode('mic'); startListening(); }
    else { setInputMode('virtual'); stopListening(); }
  };

  // Mastery summary: number of phrases at level >= 3 (a soft "learned" threshold).
  const learnedCount = allPhrases.reduce((acc, p) => acc + ((phraseStates[p.id]?.level ?? 0) >= 3 ? 1 : 0), 0);
  const accuracy = phraseStats.total > 0 ? Math.round((phraseStats.correct / phraseStats.total) * 100) : 0;

  if (!phrase || !phraseSong) {
    return (
      <div style={{ maxWidth: 480, margin: '0 auto', padding: '40px 20px', textAlign: 'center' }}>
        <button onClick={goHome} style={{ background: 'none', border: 'none', color: K.textDim, cursor: 'pointer', fontSize: 14, fontFamily: FONTS.serif }}>← Back</button>
        <p style={{ color: K.textDim, marginTop: 40 }}>No phrases tagged yet.</p>
      </div>
    );
  }

  const target = step < phrase.notes.length ? phrase.notes[step] : null;
  const progress = (step / phrase.notes.length) * 100;
  const level = phraseStates[phrase.id]?.level ?? 0;

  return (
    <div style={{ maxWidth: isWide ? 1100 : 480, margin: '0 auto', padding: isWide ? '20px 32px 40px' : '20px 20px 40px' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <button onClick={goHome} style={{ background: 'none', border: 'none', color: K.textDim, cursor: 'pointer', fontSize: 14, fontFamily: FONTS.serif }}>← Back</button>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          {phraseStreak > 2 && <span style={{ fontSize: 13, color: K.highlight, fontWeight: 600 }}>🔥 {phraseStreak}</span>}
          <button onClick={toggleMode} style={{ padding: '6px 14px', borderRadius: 20, cursor: 'pointer', background: inputMode === 'mic' ? K.success + '18' : K.bgButton, border: `1px solid ${K.border}`, color: inputMode === 'mic' ? K.success : K.textDim, fontSize: 12, fontFamily: FONTS.serif }}>
            {inputMode === 'mic' ? '🎤 Mic' : '👆 Virtual'}
          </button>
        </div>
      </div>

      {/* Title */}
      <div style={{ marginBottom: 4 }}>
        <div style={{ fontSize: 11, color: K.textMuted, fontFamily: FONTS.mono, textTransform: 'uppercase', letterSpacing: 2, marginBottom: 4 }}>Phrase Trainer</div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
          <h2 style={{ fontSize: 22, fontWeight: 700, margin: 0, color: K.accent, fontFamily: FONTS.serif, lineHeight: 1.15 }}>
            {phrase.songTitle}
            {phrase.label && (
              <span style={{ color: K.text, fontWeight: 400 }}> — {phrase.label}</span>
            )}
          </h2>
          <button onClick={() => isPlaying ? stopDemo() : playDemo(phraseSong)} style={{
            background: isPlaying ? K.pull + '22' : K.accent + '22',
            border: `1px solid ${isPlaying ? K.pull + '44' : K.accent + '44'}`,
            borderRadius: 6, padding: '5px 12px', cursor: 'pointer',
            color: isPlaying ? K.pullBright : K.accent,
            fontSize: 12, fontFamily: FONTS.serif,
            flexShrink: 0, marginLeft: 8,
          }}>
            {isPlaying ? '■ Stop' : '▶ Demo'}
          </button>
        </div>
      </div>

      {/* Mastery dots */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 6, marginBottom: 12 }}>
        <div style={{ fontSize: 11, color: K.textMuted, fontFamily: FONTS.mono, textTransform: 'uppercase', letterSpacing: 2 }}>mastery</div>
        <div style={{ display: 'flex', gap: 3 }}>
          {[0, 1, 2, 3, 4].map(i => (
            <div key={i} style={{
              width: 7, height: 7, borderRadius: '50%',
              background: i < level ? K.success : K.bgButton,
              border: `1px solid ${i < level ? K.success : K.border}`,
            }} />
          ))}
        </div>
      </div>

      {/* Progress bar */}
      <div style={{ width: '100%', height: 4, borderRadius: 2, background: K.bgButton, marginBottom: 12, overflow: 'hidden' }}>
        <div style={{
          width: `${progress}%`, height: '100%', borderRadius: 2,
          background: feedback === 'correct'
            ? K.success
            : feedback === 'incorrect'
              ? K.pull
              : `linear-gradient(90deg, ${K.push}, ${K.accent})`,
          transition: 'width 0.4s ease-out, background 0.3s ease',
        }} />
      </div>

      {/* Action row */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 12, flexWrap: 'wrap', alignItems: 'center' }}>
        <button onClick={handleAgain} disabled={feedback === 'correct'} style={{
          padding: '5px 14px', borderRadius: 6, cursor: feedback === 'correct' ? 'default' : 'pointer',
          background: K.bgButton, border: `1px solid ${K.border}`, color: K.textDim,
          fontSize: 12, fontFamily: FONTS.serif, opacity: feedback === 'correct' ? 0.4 : 1,
        }}>
          ↻ Again
        </button>
        <button onClick={handleSkip} disabled={feedback !== null} style={{
          padding: '5px 14px', borderRadius: 6, cursor: feedback === null ? 'pointer' : 'default',
          background: K.bgButton, border: `1px solid ${K.border}`, color: K.textDim,
          fontSize: 12, fontFamily: FONTS.serif, opacity: feedback !== null ? 0.4 : 1,
        }}>
          ⏭ Skip
        </button>
        <button onClick={handleResetAll} title="Reset all phrase progress" style={{
          marginLeft: 'auto',
          padding: '5px 12px', borderRadius: 6, cursor: 'pointer',
          background: 'transparent', border: `1px solid ${K.border}`, color: K.textMuted,
          fontSize: 11, fontFamily: FONTS.mono, letterSpacing: 1,
        }}>
          reset
        </button>
      </div>

      {/* Mic error */}
      {micError && (
        <div style={{ padding: 12, borderRadius: 8, marginBottom: 12, background: K.pull + '22', border: `1px solid ${K.pull}44`, color: K.pullBright, fontSize: 13 }}>{micError}</div>
      )}

      {/* Note track */}
      <div style={{ marginBottom: 16, position: 'relative' }}>
        <NoteTrack
          song={phraseSong}
          lessonStep={step}
          mode="ownPace"
          trackPosition={trackPosition}
          detectedNote={detectedNote}
          demoNote={demoNote}
          isPlaying={isPlaying}
          isComplete={feedback === 'correct'}
        />

        {feedback === 'correct' && (
          <div style={{
            position: 'absolute', inset: 0, borderRadius: 8,
            background: K.bg + 'cc',
            display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
            zIndex: 10, pointerEvents: 'none',
          }}>
            <div style={{ fontSize: 36, marginBottom: 6 }}>✓</div>
            <div style={{ fontSize: 16, fontWeight: 600, color: K.success, fontFamily: FONTS.serif }}>nailed it</div>
          </div>
        )}
        {feedback === 'incorrect' && (
          <div style={{
            position: 'absolute', inset: 0, borderRadius: 8,
            background: K.bg + 'cc',
            display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
            zIndex: 10, pointerEvents: 'none',
          }}>
            <div style={{ fontSize: 14, color: K.textDim, fontFamily: FONTS.serif, fontStyle: 'italic' }}>this one will come back soon</div>
          </div>
        )}
      </div>

      {/* Button strip */}
      <ButtonStrip
        detectedNote={detectedNote}
        highlightButton={target?.button}
        highlightDir={target?.dir}
        onNoteDown={handlePointerDown}
        onNoteUp={handlePointerUp}
      />

      {/* Stats strip */}
      <div style={{
        marginTop: 20,
        display: 'flex', justifyContent: 'space-between',
        color: K.textDim, fontSize: 12, fontFamily: FONTS.mono,
      }}>
        <div>
          <span style={{ textTransform: 'uppercase', letterSpacing: 1.5 }}>seen</span>
          <span style={{ margin: '0 6px', opacity: 0.5 }}>·</span>
          <span style={{ color: K.text }}>{phraseStats.total}</span>
        </div>
        <div>
          <span style={{ textTransform: 'uppercase', letterSpacing: 1.5 }}>accuracy</span>
          <span style={{ margin: '0 6px', opacity: 0.5 }}>·</span>
          <span style={{ color: K.text }}>{accuracy}%</span>
        </div>
        <div>
          <span style={{ textTransform: 'uppercase', letterSpacing: 1.5 }}>learned</span>
          <span style={{ margin: '0 6px', opacity: 0.5 }}>·</span>
          <span style={{ color: K.text }}>{learnedCount}/{allPhrases.length}</span>
        </div>
      </div>
    </div>
  );
}
