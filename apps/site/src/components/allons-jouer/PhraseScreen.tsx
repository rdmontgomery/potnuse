import { useEffect, useMemo, useRef, useState } from 'react';
import { K, FONTS } from '@/lib/allons-jouer/tokens';
import { useAppStore } from '@/lib/allons-jouer/useAppStore';
import { getAllPhrases } from '@/lib/allons-jouer/phrases';
import { ACCORDION_NOTES } from '@/lib/allons-jouer/accordion';
import { ButtonStrip } from '@/components/allons-jouer/ButtonStrip';
import { Keyboard } from '@/components/allons-jouer/Keyboard';
import { useAudio } from '@/lib/allons-jouer/useAudio';
import { useMic } from '@/lib/allons-jouer/useMic';
import { useMediaQuery } from '@/lib/allons-jouer/useMediaQuery';
import type { Song, SongNote, DetectedNote } from '@/lib/allons-jouer/types';
import type { PhraseLayout } from '@/lib/allons-jouer/useAppStore';

// Map a phrase's accordion note (button + dir) to its concert pitch name
// (e.g. 'C5'). Used in keyboard mode to detect by pitch instead of by button.
function noteNameFor(n: SongNote): string {
  const btn = ACCORDION_NOTES.find(b => b.button === n.button);
  return btn ? btn[n.dir].note : '';
}

function matchesTarget(target: SongNote, detected: DetectedNote, layout: PhraseLayout): boolean {
  if (layout === 'keyboard') return detected.note === noteNameFor(target);
  return detected.button === target.button && detected.dir === target.dir;
}

const STEP_DEBOUNCE = 400;
const COMPLETION_DELAY = 900;

export function PhraseScreen() {
  const phraseCurrentId  = useAppStore(s => s.phraseCurrentId);
  const phraseStates     = useAppStore(s => s.phraseStates);
  const phraseStats      = useAppStore(s => s.phraseStats);
  const phraseStreak     = useAppStore(s => s.phraseStreak);
  const phraseLayout     = useAppStore(s => s.phraseLayout);
  const detectedNote     = useAppStore(s => s.detectedNote);
  const demoNote         = useAppStore(s => s.demoNote);
  const isPlaying        = useAppStore(s => s.isPlaying);
  const inputMode        = useAppStore(s => s.inputMode);
  const micError         = useAppStore(s => s.micError);
  const goHome           = useAppStore(s => s.goHome);
  const setInputMode     = useAppStore(s => s.setInputMode);
  const setPhraseLayout  = useAppStore(s => s.setPhraseLayout);
  const recordPhraseResult = useAppStore(s => s.recordPhraseResult);
  const resetPhraseProgress = useAppStore(s => s.resetPhraseProgress);

  const { handlePointerDown, handlePointerUp, handleKeyDown, playDemo, stopDemo } = useAudio();
  const { startListening, stopListening } = useMic();
  const isWide = useMediaQuery('(min-width: 900px)');
  // Phone-in-landscape: viewport is wider than the centered page container,
  // so let the keyboard break out of the gutter and span edge-to-edge.
  const isLandscape = useMediaQuery('(orientation: landscape)');
  const breakoutKeyboard = phraseLayout === 'keyboard' && isLandscape && !isWide;

  // Local step counter — independent of the regular lesson screen's store step.
  const [step, setStep] = useState(0);
  const [feedback, setFeedback] = useState<null | 'correct' | 'incorrect'>(null);
  const lastFiredStepRef = useRef<number>(-1);
  const stepAdvanceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const srsAdvanceRef  = useRef<ReturnType<typeof setTimeout> | null>(null);

  const allPhrases = useMemo(() => getAllPhrases(), []);
  const phrase = useMemo(() => allPhrases.find(p => p.id === phraseCurrentId) ?? null, [allPhrases, phraseCurrentId]);

  // Synthesize a Song from the active phrase so we can reuse playDemo.
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

  // Reset step + clear any pending timers whenever the active phrase changes,
  // then auto-play the demo so the timing lands before the first attempt.
  useEffect(() => {
    setStep(0);
    setFeedback(null);
    lastFiredStepRef.current = -1;
    if (stepAdvanceRef.current) { clearTimeout(stepAdvanceRef.current); stepAdvanceRef.current = null; }
    if (srsAdvanceRef.current)  { clearTimeout(srsAdvanceRef.current);  srsAdvanceRef.current  = null; }
    if (!phraseSong) return;
    stopDemo();
    const t = setTimeout(() => playDemo(phraseSong), 300);
    return () => clearTimeout(t);
  }, [phraseCurrentId, phraseSong, playDemo, stopDemo]);

  // Detection: when a target note is played, schedule a step advance. The timer
  // is held in a ref (not the effect's local scope) so it survives subsequent
  // re-renders — useAudio nulls detectedNote ~150ms after release, which used
  // to cancel the advance timer via the cleanup function and lose the hit.
  useEffect(() => {
    if (!phrase || !detectedNote || isPlaying || feedback !== null) return;
    if (step >= phrase.notes.length) return;

    const target = phrase.notes[step];
    if (!matchesTarget(target, detectedNote, phraseLayout)) return;
    if (lastFiredStepRef.current === step) return;
    lastFiredStepRef.current = step;

    if (stepAdvanceRef.current) clearTimeout(stepAdvanceRef.current);
    stepAdvanceRef.current = setTimeout(() => {
      setStep(s => s + 1);
      stepAdvanceRef.current = null;
    }, STEP_DEBOUNCE);
  }, [detectedNote, phrase, step, isPlaying, feedback, phraseLayout]);

  // Phrase complete → mark correct, schedule the SRS advance.
  useEffect(() => {
    if (!phrase) return;
    if (step < phrase.notes.length) return;
    if (feedback === 'correct') return;
    setFeedback('correct');
    if (srsAdvanceRef.current) clearTimeout(srsAdvanceRef.current);
    srsAdvanceRef.current = setTimeout(() => {
      recordPhraseResult(true);
      srsAdvanceRef.current = null;
    }, COMPLETION_DELAY);
  }, [step, phrase, feedback, recordPhraseResult]);

  // Cleanup any pending timers on unmount.
  useEffect(() => () => {
    if (stepAdvanceRef.current) clearTimeout(stepAdvanceRef.current);
    if (srsAdvanceRef.current)  clearTimeout(srsAdvanceRef.current);
  }, []);

  const handleSkip = () => {
    if (feedback === 'correct') return;
    setFeedback('incorrect');
    if (srsAdvanceRef.current) clearTimeout(srsAdvanceRef.current);
    srsAdvanceRef.current = setTimeout(() => {
      recordPhraseResult(false);
      srsAdvanceRef.current = null;
    }, COMPLETION_DELAY);
  };

  const handleAgain = () => {
    setStep(0);
    setFeedback(null);
    lastFiredStepRef.current = -1;
    if (stepAdvanceRef.current) { clearTimeout(stepAdvanceRef.current); stepAdvanceRef.current = null; }
    if (srsAdvanceRef.current)  { clearTimeout(srsAdvanceRef.current);  srsAdvanceRef.current  = null; }
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

  // Mastery summary: phrases at level >= 3 ("learned" threshold).
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
  const level = phraseStates[phrase.id]?.level ?? 0;

  return (
    <div style={{ maxWidth: isWide ? 1100 : 480, margin: '0 auto', padding: isWide ? '16px 32px 32px' : '12px 14px 32px' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
        <button onClick={goHome} style={{ background: 'none', border: 'none', color: K.textDim, cursor: 'pointer', fontSize: 14, fontFamily: FONTS.serif, padding: 4 }}>← Back</button>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {phraseStreak > 2 && <span style={{ fontSize: 13, color: K.highlight, fontWeight: 600 }}>🔥 {phraseStreak}</span>}
          <button
            onClick={() => setPhraseLayout(phraseLayout === 'accordion' ? 'keyboard' : 'accordion')}
            title={phraseLayout === 'accordion' ? 'Switch to keyboard layout' : 'Switch to accordion layout'}
            style={{
              padding: '5px 12px', borderRadius: 16, cursor: 'pointer',
              background: K.bgButton,
              border: `1px solid ${K.border}`,
              color: K.textDim,
              fontSize: 12, fontFamily: FONTS.serif,
            }}
          >
            {phraseLayout === 'accordion' ? '🪗 Accordion' : '🎹 Keyboard'}
          </button>
          <button onClick={toggleMode} style={{ padding: '5px 12px', borderRadius: 16, cursor: 'pointer', background: inputMode === 'mic' ? K.success + '18' : K.bgButton, border: `1px solid ${K.border}`, color: inputMode === 'mic' ? K.success : K.textDim, fontSize: 12, fontFamily: FONTS.serif }}>
            {inputMode === 'mic' ? '🎤 Mic' : '👆 Virtual'}
          </button>
        </div>
      </div>

      {/* Title row */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 8, marginBottom: 4 }}>
        <h2 style={{
          fontSize: 18, fontWeight: 700, margin: 0, color: K.accent, fontFamily: FONTS.serif, lineHeight: 1.2,
          display: 'flex', flexWrap: 'wrap', alignItems: 'baseline', gap: 4,
        }}>
          <span>{phrase.songTitle}</span>
          {phrase.label && (
            <span style={{ color: K.textDim, fontWeight: 400, fontSize: 14, fontStyle: 'italic' }}>— {phrase.label}</span>
          )}
        </h2>
        <button onClick={() => isPlaying ? stopDemo() : playDemo(phraseSong)} style={{
          background: isPlaying ? K.pull + '22' : K.accent + '22',
          border: `1px solid ${isPlaying ? K.pull + '44' : K.accent + '44'}`,
          borderRadius: 6, padding: '5px 12px', cursor: 'pointer',
          color: isPlaying ? K.pullBright : K.accent,
          fontSize: 12, fontFamily: FONTS.serif, flexShrink: 0,
        }}>
          {isPlaying ? '■ Stop' : '▶ Demo'}
        </button>
      </div>

      {/* Mastery + action row (combined to save vertical space) */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8, flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', gap: 3 }}>
          {[0, 1, 2, 3, 4].map(i => (
            <div key={i} style={{
              width: 7, height: 7, borderRadius: '50%',
              background: i < level ? K.success : K.bgButton,
              border: `1px solid ${i < level ? K.success : K.border}`,
            }} />
          ))}
        </div>
        <button onClick={handleAgain} disabled={feedback === 'correct'} style={{
          padding: '4px 12px', borderRadius: 6, cursor: feedback === 'correct' ? 'default' : 'pointer',
          background: K.bgButton, border: `1px solid ${K.border}`, color: K.textDim,
          fontSize: 12, fontFamily: FONTS.serif, opacity: feedback === 'correct' ? 0.4 : 1,
        }}>
          ↻ Again
        </button>
        <button onClick={handleSkip} disabled={feedback !== null} style={{
          padding: '4px 12px', borderRadius: 6, cursor: feedback === null ? 'pointer' : 'default',
          background: K.bgButton, border: `1px solid ${K.border}`, color: K.textDim,
          fontSize: 12, fontFamily: FONTS.serif, opacity: feedback !== null ? 0.4 : 1,
        }}>
          ⏭ Skip
        </button>
        <button onClick={handleResetAll} title="Reset all phrase progress" style={{
          marginLeft: 'auto',
          padding: '4px 10px', borderRadius: 6, cursor: 'pointer',
          background: 'transparent', border: `1px solid ${K.border}`, color: K.textMuted,
          fontSize: 11, fontFamily: FONTS.mono, letterSpacing: 1,
        }}>
          reset
        </button>
      </div>

      {/* Mic error */}
      {micError && (
        <div style={{ padding: 10, borderRadius: 8, marginBottom: 8, background: K.pull + '22', border: `1px solid ${K.pull}44`, color: K.pullBright, fontSize: 12 }}>{micError}</div>
      )}

      {/* Phrase tab strip — compact, mobile-friendly. Replaces NoteTrack. */}
      <PhraseTab
        notes={phrase.notes}
        step={step}
        feedback={feedback}
        detectedNote={detectedNote}
        layout={phraseLayout}
      />

      {/* Input — accordion strip or piano keyboard depending on layout */}
      {phraseLayout === 'accordion' ? (
        <ButtonStrip
          compact
          detectedNote={detectedNote}
          highlightButton={target?.button}
          highlightDir={target?.dir}
          onNoteDown={handlePointerDown}
          onNoteUp={handlePointerUp}
        />
      ) : (
        <div style={breakoutKeyboard ? {
          width: '100vw',
          marginLeft: 'calc(50% - 50vw)',
          marginRight: 'calc(50% - 50vw)',
          paddingLeft: 8,
          paddingRight: 8,
          boxSizing: 'border-box',
        } : undefined}>
          <Keyboard
            detectedNote={detectedNote}
            demoNote={demoNote}
            highlightNote={target ? noteNameFor(target) : undefined}
            onKeyDown={handleKeyDown}
            onKeyUp={handlePointerUp}
          />
        </div>
      )}

      {/* Stats strip */}
      <div style={{
        marginTop: 14,
        display: 'flex', justifyContent: 'space-between',
        color: K.textDim, fontSize: 11, fontFamily: FONTS.mono,
      }}>
        <div>
          <span style={{ textTransform: 'uppercase', letterSpacing: 1.2 }}>seen</span>
          <span style={{ margin: '0 5px', opacity: 0.5 }}>·</span>
          <span style={{ color: K.text }}>{phraseStats.total}</span>
        </div>
        <div>
          <span style={{ textTransform: 'uppercase', letterSpacing: 1.2 }}>acc</span>
          <span style={{ margin: '0 5px', opacity: 0.5 }}>·</span>
          <span style={{ color: K.text }}>{accuracy}%</span>
        </div>
        <div>
          <span style={{ textTransform: 'uppercase', letterSpacing: 1.2 }}>learned</span>
          <span style={{ margin: '0 5px', opacity: 0.5 }}>·</span>
          <span style={{ color: K.text }}>{learnedCount}/{allPhrases.length}</span>
        </div>
      </div>
    </div>
  );
}

// Compact horizontal tab strip showing the phrase as a sequence of cells.
// Done cells get a check, the current cell pulses, upcoming cells stay dim.
// Cell widths are proportional to note duration so the rhythmic shape of the
// phrase is visible at a glance, and the active cell sprouts a hold-fill bar
// while the right note is being pressed so the kid can see how long to hold.
const PHRASE_BASE_W = 36;     // px floor for short notes
const PHRASE_MS_PER_PX = 18;  // duration scaling: 1px per 18ms above the floor

function widthForDuration(ms: number): number {
  return Math.round(PHRASE_BASE_W + ms / PHRASE_MS_PER_PX);
}

function PhraseTab({ notes, step, feedback, detectedNote, layout }: {
  notes: SongNote[];
  step: number;
  feedback: null | 'correct' | 'incorrect';
  detectedNote: DetectedNote | null;
  layout: PhraseLayout;
}) {
  const target = step < notes.length ? notes[step] : null;
  const isPressingTarget = !!(
    target && detectedNote && feedback === null &&
    matchesTarget(target, detectedNote, layout)
  );

  return (
    <div style={{
      display: 'flex',
      gap: 6,
      flexWrap: 'wrap',
      padding: '10px 8px',
      background: K.bgCard,
      border: `1px solid ${K.border}`,
      borderRadius: 8,
      marginBottom: 10,
      justifyContent: 'center',
      alignItems: 'flex-end',
    }}>
      {notes.map((n, i) => {
        const isDone = i < step || feedback === 'correct';
        const isCurrent = i === step && feedback === null;
        const isWrong  = feedback === 'incorrect' && i >= step;
        const dirSym = n.dir === 'push' ? '▶' : '◀';
        const dirColor = n.dir === 'push' ? K.pushBright : K.pullBright;
        const cellWidth = widthForDuration(n.duration);

        let bg = K.bgButton;
        let fg = K.textMuted;
        let border = K.border;
        let scale = 1;
        let pulse = false;

        if (isCurrent) {
          bg = dirColor + '22';
          fg = dirColor;
          border = dirColor;
          scale = 1.05;
          pulse = true;
        } else if (isDone) {
          bg = K.success + '15';
          fg = K.success;
          border = K.success + '66';
        } else if (isWrong) {
          bg = K.pull + '15';
          fg = K.pullBright;
          border = K.pull + '44';
        } else {
          fg = dirColor;
        }

        return (
          <div key={i} style={{
            width: cellWidth,
            padding: '6px 4px',
            background: bg, color: fg,
            border: `2px solid ${border}`, borderRadius: 6,
            display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 1,
            fontFamily: FONTS.mono,
            transform: `scale(${scale})`,
            transition: 'background 0.2s, color 0.2s, border-color 0.2s, transform 0.2s',
            ...(pulse ? { animation: 'targetPulse 1.4s ease-in-out infinite' } : {}),
            position: 'relative',
            overflow: 'hidden',
          }}>
            {layout === 'keyboard' ? (
              <>
                <span style={{ fontSize: 14, fontWeight: 700, lineHeight: 1 }}>{noteNameFor(n)}</span>
                <span style={{ fontSize: 10, opacity: 0.7 }}>{dirSym}</span>
              </>
            ) : (
              <>
                <span style={{ fontSize: 11, opacity: 0.85 }}>{dirSym}</span>
                <span style={{ fontSize: 16, fontWeight: 700, lineHeight: 1 }}>{n.button}</span>
              </>
            )}
            {/* Hold-fill bar: while the kid presses the right note, this fills
                from 0 → 100% over the note's target duration, giving live
                visual feedback on how long to hold. */}
            {isCurrent && isPressingTarget && (
              <span style={{
                position: 'absolute', bottom: 0, left: 0,
                height: 3, width: 0,
                background: dirColor,
                animation: `phraseFill ${n.duration}ms linear forwards`,
              }} />
            )}
          </div>
        );
      })}
    </div>
  );
}
