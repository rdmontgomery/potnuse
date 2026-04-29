import { useState, useEffect, useRef, useCallback, useMemo } from 'react';

type ClefKey = 'treble' | 'bass' | 'grand';

interface NoteDef {
  id: string;
  name: string;
  octave: number;
  freq: number;
  // Rendering: which clef this note belongs to for placement,
  // and its y-position on that clef's staff (shared coord system inside a clef).
  clef: 'treble' | 'bass';
  y: number;
}

// Staff line y-coords in the SVG viewBox are shared across clefs.
// Treble staff lines: top F5=40, D5=55, B4=70, G4=85, bottom E4=100. Spacing=15.
// Bass staff lines: top A3=40, F3=55, D3=70, B2=85, bottom G2=100. Same spacing.
// Middle C sits one ledger above bass and one ledger below treble.

// Semitone map for frequency math (A4 = 440).
const SEMITONE: Record<string, number> = {
  C: -9, D: -7, E: -5, F: -4, G: -2, A: 0, B: 2,
};
function freqOf(name: string, octave: number): number {
  const n = SEMITONE[name] + (octave - 4) * 12;
  return 440 * Math.pow(2, n / 12);
}

// Y coord for a given step on the treble staff. Step 0 = E4 (bottom line, y=100).
// Step increases upward by a staff step (line-to-space, space-to-line) = 7.5px.
function trebleY(name: string, octave: number): number {
  // E4 is step 0. We count diatonic steps C-D-E-F-G-A-B.
  const scale = ['C', 'D', 'E', 'F', 'G', 'A', 'B'];
  const step = scale.indexOf(name) + octave * 7;
  const e4Step = scale.indexOf('E') + 4 * 7;
  const delta = step - e4Step;
  return 100 - delta * 7.5;
}
function bassY(name: string, octave: number): number {
  // G2 is step 0 (bottom line, y=100).
  const scale = ['C', 'D', 'E', 'F', 'G', 'A', 'B'];
  const step = scale.indexOf(name) + octave * 7;
  const g2Step = scale.indexOf('G') + 2 * 7;
  const delta = step - g2Step;
  return 100 - delta * 7.5;
}

function makeNote(name: string, octave: number, clef: 'treble' | 'bass'): NoteDef {
  return {
    id: `${name}${octave}`,
    name,
    octave,
    freq: freqOf(name, octave),
    clef,
    y: clef === 'treble' ? trebleY(name, octave) : bassY(name, octave),
  };
}

// Ranges for each clef mode. Each set is ordered from low→high.
const SCALE = ['C', 'D', 'E', 'F', 'G', 'A', 'B'];

function buildRange(from: string, fromOct: number, to: string, toOct: number, clef: 'treble' | 'bass'): NoteDef[] {
  const fromStep = SCALE.indexOf(from) + fromOct * 7;
  const toStep = SCALE.indexOf(to) + toOct * 7;
  const out: NoteDef[] = [];
  for (let s = fromStep; s <= toStep; s++) {
    const name = SCALE[((s % 7) + 7) % 7];
    const octave = Math.floor(s / 7);
    out.push(makeNote(name, octave, clef));
  }
  return out;
}

// Upper treble staff C5 → C6 (the original set).
const TREBLE_NOTES = buildRange('C', 5, 'C', 6, 'treble');
// Bass staff C3 → C4. C4 is middle C (one ledger above bass).
const BASS_NOTES = buildRange('C', 3, 'C', 4, 'bass');

function notesForClef(clef: ClefKey): NoteDef[] {
  if (clef === 'treble') return TREBLE_NOTES;
  if (clef === 'bass') return BASS_NOTES;
  return [...BASS_NOTES, ...TREBLE_NOTES];
}

// ---------- SRS ----------
interface NoteState {
  level: number;
  nextReview: number;
  seen: number;
  correct: number;
}
type NoteStates = Record<string, NoteState>;

const INTERVAL = (level: number) => 2 + Math.pow(2, level);

function initialStates(notes: NoteDef[]): NoteStates {
  const s: NoteStates = {};
  notes.forEach((n, i) => {
    s[n.id] = { level: 0, nextReview: i, seen: 0, correct: 0 };
  });
  return s;
}

function pickNext(notes: NoteDef[], states: NoteStates, excludeId: string | null): NoteDef {
  const candidates = notes.filter(n => n.id !== excludeId);
  for (let i = candidates.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [candidates[i], candidates[j]] = [candidates[j], candidates[i]];
  }
  candidates.sort((a, b) => states[a.id].nextReview - states[b.id].nextReview);
  return candidates[0];
}

function updateStates(states: NoteStates, noteId: string, correct: boolean, step: number): NoteStates {
  const s = states[noteId];
  const next = { ...states };
  if (correct) {
    const level = Math.min(s.level + 1, 5);
    next[noteId] = {
      ...s,
      level,
      nextReview: step + INTERVAL(level) + Math.floor(Math.random() * 2),
      seen: s.seen + 1,
      correct: s.correct + 1,
    };
  } else {
    next[noteId] = {
      ...s,
      level: 0,
      nextReview: step + 2 + Math.floor(Math.random() * 2),
      seen: s.seen + 1,
    };
  }
  return next;
}

// ---------- Persistence ----------
const STORAGE_KEY = 'ladder';
interface PersistShape {
  clef: ClefKey;
  states: Record<ClefKey, NoteStates>;
  stats: Record<ClefKey, { correct: number; total: number; bestStreak: number }>;
}

function loadPersisted(): PersistShape | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as PersistShape;
  } catch {
    return null;
  }
}

// ---------- Palette (site-matched) ----------
const PAL = {
  bg: '#1a1207',
  bgCard: '#261d0f',
  bgButton: '#332814',
  bgInput: '#1f1608',
  border: '#3d2e1a',
  accent: '#e8a838',
  accentDim: '#b87a1e',
  good: '#7aab5a',
  bad: '#c77a5a',
  text: '#f0e6d2',
  textDim: '#9e8e72',
  textMuted: '#6b5d48',
  serif: "'Crimson Pro', Georgia, serif",
  mono: "'JetBrains Mono', ui-monospace, 'SF Mono', monospace",
};

// ---------- Component ----------
export default function Ladder() {
  const [clef, setClef] = useState<ClefKey>('treble');
  const [loaded, setLoaded] = useState(false);
  const [allStates, setAllStates] = useState<Record<ClefKey, NoteStates>>(() => ({
    treble: initialStates(TREBLE_NOTES),
    bass: initialStates(BASS_NOTES),
    grand: initialStates([...BASS_NOTES, ...TREBLE_NOTES]),
  }));
  const [allStats, setAllStats] = useState<Record<ClefKey, { correct: number; total: number; bestStreak: number }>>(() => ({
    treble: { correct: 0, total: 0, bestStreak: 0 },
    bass: { correct: 0, total: 0, bestStreak: 0 },
    grand: { correct: 0, total: 0, bestStreak: 0 },
  }));
  const [streak, setStreak] = useState(0);
  const [step, setStep] = useState(0);
  const activeNotes = useMemo(() => notesForClef(clef), [clef]);
  const [currentNote, setCurrentNote] = useState<NoteDef>(activeNotes[0]);
  const [feedback, setFeedback] = useState<null | 'correct' | 'incorrect'>(null);
  const [pickedAnswer, setPickedAnswer] = useState<string | null>(null);
  const [locked, setLocked] = useState(false);
  const audioCtxRef = useRef<AudioContext | null>(null);

  // Load persisted state.
  useEffect(() => {
    const p = loadPersisted();
    if (p) {
      if (p.clef) setClef(p.clef);
      if (p.states) {
        setAllStates(prev => ({ ...prev, ...p.states }));
      }
      if (p.stats) {
        setAllStats(prev => ({ ...prev, ...p.stats }));
      }
    }
    setLoaded(true);
  }, []);

  // Reset current note when clef changes.
  useEffect(() => {
    setCurrentNote(pickNext(notesForClef(clef), allStates[clef], null));
    setStep(0);
    setStreak(0);
    setFeedback(null);
    setPickedAnswer(null);
    setLocked(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clef]);

  // Persist whenever states/stats/clef change.
  useEffect(() => {
    if (!loaded) return;
    try {
      const payload: PersistShape = { clef, states: allStates, stats: allStats };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
    } catch {
      /* quota or privacy mode — ignore */
    }
  }, [clef, allStates, allStats, loaded]);

  const getCtx = () => {
    if (!audioCtxRef.current) {
      const AC = (window.AudioContext ||
        (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext);
      if (AC) audioCtxRef.current = new AC();
    }
    return audioCtxRef.current;
  };

  const playNote = useCallback((freq: number) => {
    try {
      const ctx = getCtx();
      if (!ctx) return;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.value = freq;
      const t = ctx.currentTime;
      gain.gain.setValueAtTime(0, t);
      gain.gain.linearRampToValueAtTime(0.2, t + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.7);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(t);
      osc.stop(t + 0.75);
    } catch { /* no-op */ }
  }, []);

  const playError = useCallback(() => {
    try {
      const ctx = getCtx();
      if (!ctx) return;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.value = 150;
      const t = ctx.currentTime;
      gain.gain.setValueAtTime(0, t);
      gain.gain.linearRampToValueAtTime(0.13, t + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.35);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(t);
      osc.stop(t + 0.4);
    } catch { /* no-op */ }
  }, []);

  // Answer buttons show distinct pitch classes: C, D, E, F, G, A, B.
  // Matching is by pitch-class name, not exact ID — "C" matches C3/C4/C5/C6.
  const pitchClasses = useMemo(() => ['C', 'D', 'E', 'F', 'G', 'A', 'B'], []);

  const handleAnswer = useCallback((pitchClass: string) => {
    if (locked) return;
    setLocked(true);
    setPickedAnswer(pitchClass);

    const correct = pitchClass === currentNote.name;
    if (correct) playNote(currentNote.freq);
    else playError();

    const newStep = step + 1;
    const prevStats = allStats[clef];
    const newStreak = correct ? streak + 1 : 0;
    const newStats = {
      correct: prevStats.correct + (correct ? 1 : 0),
      total: prevStats.total + 1,
      bestStreak: Math.max(prevStats.bestStreak, newStreak),
    };

    setFeedback(correct ? 'correct' : 'incorrect');
    setStreak(newStreak);
    setAllStats(prev => ({ ...prev, [clef]: newStats }));

    const newStates = updateStates(allStates[clef], currentNote.id, correct, newStep);
    setAllStates(prev => ({ ...prev, [clef]: newStates }));
    setStep(newStep);

    const delay = correct ? 700 : 1400;
    setTimeout(() => {
      const next = pickNext(activeNotes, newStates, currentNote.id);
      setCurrentNote(next);
      setFeedback(null);
      setPickedAnswer(null);
      setLocked(false);
    }, delay);
  }, [locked, currentNote, step, streak, allStats, allStates, clef, activeNotes, playNote, playError]);

  // Keyboard shortcuts: 1-7 for C-B.
  useEffect(() => {
    const map: Record<string, string> = { '1': 'C', '2': 'D', '3': 'E', '4': 'F', '5': 'G', '6': 'A', '7': 'B' };
    const onKey = (e: KeyboardEvent) => {
      if (locked) return;
      const pc = map[e.key];
      if (pc) handleAnswer(pc);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [handleAnswer, locked]);

  const stats = allStats[clef];
  const accuracy = stats.total > 0 ? Math.round((stats.correct / stats.total) * 100) : 0;
  const states = allStates[clef];

  const octaveSub = (octave: number) => {
    const subs = ['\u2080', '\u2081', '\u2082', '\u2083', '\u2084', '\u2085', '\u2086', '\u2087', '\u2088', '\u2089'];
    return subs[octave] ?? String(octave);
  };

  const resetCurrent = () => {
    const fresh = initialStates(activeNotes);
    setAllStates(prev => ({ ...prev, [clef]: fresh }));
    setAllStats(prev => ({ ...prev, [clef]: { correct: 0, total: 0, bestStreak: 0 } }));
    setStreak(0);
    setStep(0);
    setCurrentNote(pickNext(activeNotes, fresh, null));
    setFeedback(null);
    setPickedAnswer(null);
    setLocked(false);
  };

  // ---------- Staff rendering ----------
  // Grand staff needs more vertical room; we draw both clefs stacked.
  // Treble staff lives at y 40-100 (ink-local), bass staff at y 40-100 shifted by +90 in grand mode.
  const renderStaff = () => {
    const ink = PAL.text;
    const dim = PAL.border;
    const noteColor =
      feedback === 'correct' ? PAL.good :
      feedback === 'incorrect' ? PAL.bad :
      PAL.accent;

    const isGrand = clef === 'grand';
    const viewHeight = isGrand ? 250 : 140;
    const bassShift = isGrand ? 110 : 0;

    const showTreble = clef === 'treble' || clef === 'grand';
    const showBass = clef === 'bass' || clef === 'grand';

    // Note x-position (constant).
    const NOTE_X = 200;

    // Compute y for the current note in the SVG.
    // For treble, y is already in 40..100 range.
    // For bass, y is in 40..100 in bass-local coords — shift by bassShift in grand mode.
    const noteY = currentNote.clef === 'treble'
      ? currentNote.y
      : currentNote.y + bassShift;

    return (
      <svg viewBox={`0 0 340 ${viewHeight}`} className="staff-svg" style={{ width: '100%', maxWidth: '560px' }}>
        {/* Treble staff */}
        {showTreble && (
          <g>
            {[40, 55, 70, 85, 100].map(y => (
              <line key={`t-${y}`} x1="14" y1={y} x2="326" y2={y} stroke={ink} strokeWidth="0.8" opacity="0.65" />
            ))}
            <line x1="14"  y1="40" x2="14"  y2="100" stroke={ink} strokeWidth="0.8" opacity="0.65" />
            <line x1="326" y1="40" x2="326" y2="100" stroke={ink} strokeWidth="0.8" opacity="0.65" />
            <text x="22" y="96" fontSize="58" fill={ink} style={{ fontFamily: "'Noto Music','Bravura','Segoe UI Symbol','Apple Symbols', serif" }}>
              {'\u{1D11E}'}
            </text>
          </g>
        )}

        {/* Bass staff */}
        {showBass && (
          <g transform={`translate(0, ${bassShift})`}>
            {[40, 55, 70, 85, 100].map(y => (
              <line key={`b-${y}`} x1="14" y1={y} x2="326" y2={y} stroke={ink} strokeWidth="0.8" opacity="0.65" />
            ))}
            <line x1="14"  y1="40" x2="14"  y2="100" stroke={ink} strokeWidth="0.8" opacity="0.65" />
            <line x1="326" y1="40" x2="326" y2="100" stroke={ink} strokeWidth="0.8" opacity="0.65" />
            <text x="26" y="74" fontSize="42" fill={ink} style={{ fontFamily: "'Noto Music','Bravura','Segoe UI Symbol','Apple Symbols', serif" }}>
              {'\u{1D122}'}
            </text>
          </g>
        )}

        {/* Ledger lines between the two staves in grand mode (middle C area). */}
        {isGrand && currentNote.id === 'C4' && (
          <line x1={NOTE_X - 12} y1={115} x2={NOTE_X + 12} y2={115} stroke={ink} strokeWidth="1" opacity="0.7" />
        )}

        {/* Ledger lines for notes outside the staff (treble-only mode). */}
        {clef === 'treble' && currentNote.y <= 25 && (
          <line x1={NOTE_X - 12} y1={25} x2={NOTE_X + 12} y2={25} stroke={ink} strokeWidth="1" opacity="0.7" />
        )}
        {clef === 'treble' && currentNote.y <= 10 && (
          <line x1={NOTE_X - 12} y1={10} x2={NOTE_X + 12} y2={10} stroke={ink} strokeWidth="1" opacity="0.7" />
        )}
        {clef === 'treble' && currentNote.y >= 115 && (
          <line x1={NOTE_X - 12} y1={115} x2={NOTE_X + 12} y2={115} stroke={ink} strokeWidth="1" opacity="0.7" />
        )}
        {clef === 'bass' && currentNote.y <= 25 && (
          <line x1={NOTE_X - 12} y1={25} x2={NOTE_X + 12} y2={25} stroke={ink} strokeWidth="1" opacity="0.7" />
        )}
        {clef === 'bass' && currentNote.y >= 115 && (
          <line x1={NOTE_X - 12} y1={115} x2={NOTE_X + 12} y2={115} stroke={ink} strokeWidth="1" opacity="0.7" />
        )}

        {/* Note head */}
        <g transform={`translate(${NOTE_X}, ${noteY})`}>
          <ellipse cx="0" cy="0" rx="9" ry="6.2" fill="none" stroke={noteColor} strokeWidth="2.4" transform="rotate(-18)"
            style={{ transition: 'stroke 0.25s ease' }} />
          <ellipse cx="0" cy="0" rx="4.5" ry="2.4" fill={noteColor} transform="rotate(-18)"
            style={{ transition: 'fill 0.25s ease' }} />
        </g>

        {/* Dim placeholder */}
        {!showTreble && !showBass && (
          <line x1="14" y1="70" x2="326" y2="70" stroke={dim} strokeWidth="0.5" />
        )}
      </svg>
    );
  };

  // ---------- Keyboard buttons ----------
  const renderKeyboard = () => {
    // Mastery = mean level across all notes of this pitch class in the active set.
    const masteryByPitch: Record<string, number> = {};
    pitchClasses.forEach(pc => {
      const members = activeNotes.filter(n => n.name === pc);
      if (members.length === 0) {
        masteryByPitch[pc] = 0;
        return;
      }
      const sum = members.reduce((acc, n) => acc + (states[n.id]?.level ?? 0), 0);
      masteryByPitch[pc] = sum / members.length;
    });

    return (
      <div style={{ display: 'flex', gap: '5px', width: '100%', maxWidth: '560px' }}>
        {pitchClasses.map(pc => {
          const isPicked = pickedAnswer === pc;
          const isCorrectAnswer = feedback && pc === currentNote.name;
          const isWrongPick = feedback === 'incorrect' && isPicked;

          let bg = PAL.bgButton;
          let fg = PAL.text;
          let border = PAL.border;
          let shadow = '0 2px 0 rgba(0,0,0,0.25), inset 0 -2px 0 rgba(0,0,0,0.25)';
          let scale = 1;

          if (isCorrectAnswer) {
            bg = PAL.good; fg = PAL.bg; border = PAL.good;
            shadow = '0 0 22px rgba(122,171,90,0.45), inset 0 -2px 0 rgba(0,0,0,0.25)';
            scale = 1.03;
          } else if (isWrongPick) {
            bg = PAL.bad; fg = PAL.bg; border = PAL.bad;
            shadow = '0 0 22px rgba(199,122,90,0.4), inset 0 -2px 0 rgba(0,0,0,0.25)';
          }

          const level = Math.round(masteryByPitch[pc]);

          return (
            <button
              key={pc}
              onClick={() => handleAnswer(pc)}
              disabled={locked}
              style={{
                flex: 1,
                position: 'relative',
                backgroundColor: bg,
                color: fg,
                border: `1px solid ${border}`,
                borderRadius: '3px',
                boxShadow: shadow,
                transform: `scale(${scale})`,
                cursor: locked ? 'default' : 'pointer',
                minHeight: '88px',
                padding: '10px 0 16px',
                fontFamily: PAL.serif,
                transition: 'transform 0.15s ease, background-color 0.2s ease, box-shadow 0.2s ease',
                WebkitTapHighlightColor: 'transparent',
              }}
            >
              <div style={{ fontSize: '1.6rem', fontWeight: 600, lineHeight: 1 }}>{pc}</div>
              <div style={{
                position: 'absolute', left: 0, right: 0, bottom: 6,
                display: 'flex', justifyContent: 'center', gap: '3px',
              }}>
                {[0,1,2,3,4].map(i => (
                  <div key={i} style={{
                    width: 4, height: 4, borderRadius: '50%',
                    backgroundColor: i < level ? fg : 'transparent',
                    border: `1px solid ${fg}`, opacity: 0.5,
                  }} />
                ))}
              </div>
            </button>
          );
        })}
      </div>
    );
  };

  const clefButton = (k: ClefKey, label: string) => (
    <button
      onClick={() => setClef(k)}
      style={{
        background: clef === k ? PAL.accent : PAL.bgCard,
        color: clef === k ? PAL.bg : PAL.textDim,
        border: `1px solid ${clef === k ? PAL.accent : PAL.border}`,
        borderRadius: 3,
        padding: '6px 14px',
        fontFamily: PAL.mono,
        fontSize: '0.72rem',
        letterSpacing: '0.08em',
        textTransform: 'uppercase',
        cursor: 'pointer',
        fontWeight: clef === k ? 700 : 500,
      }}
    >
      {label}
    </button>
  );

  return (
    <div style={{
      minHeight: '100vh',
      background: PAL.bg,
      color: PAL.text,
      fontFamily: PAL.serif,
      display: 'flex', flexDirection: 'column', alignItems: 'center',
      padding: '1.5rem 1rem 3rem',
    }}>
      <style>{`
        @keyframes ladderNoteAppear { 0% { opacity: 0; transform: translateY(-5px); } 100% { opacity: 1; transform: translateY(0); } }
        @keyframes ladderShake { 0%,100%{transform:translateX(0)} 20%{transform:translateX(-4px)} 40%{transform:translateX(3px)} 60%{transform:translateX(-3px)} 80%{transform:translateX(2px)} }
        button:active:not(:disabled) { transform: scale(0.97) !important; }
        .staff-svg { display: block; }
      `}</style>

      {/* Header */}
      <div style={{
        width: '100%', maxWidth: 560, display: 'flex',
        justifyContent: 'space-between', alignItems: 'flex-end',
        marginBottom: '1rem',
      }}>
        <div>
          <div style={{ fontFamily: PAL.serif, fontSize: '1.8rem', fontWeight: 500, lineHeight: 1, color: PAL.text }}>
            ladder
          </div>
          <div style={{ fontFamily: PAL.mono, fontSize: '0.65rem', color: PAL.textMuted, marginTop: 4, letterSpacing: '0.1em', textTransform: 'uppercase' }}>
            note recognition · zpd spaced repetition
          </div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontFamily: PAL.mono, fontSize: '0.6rem', color: PAL.textMuted, letterSpacing: '0.1em', textTransform: 'uppercase' }}>streak</div>
          <div style={{ fontFamily: PAL.serif, fontSize: '1.8rem', fontWeight: 500, lineHeight: 1, color: PAL.accent }}>{streak}</div>
        </div>
      </div>

      {/* Clef selector */}
      <div style={{ width: '100%', maxWidth: 560, display: 'flex', gap: 6, marginBottom: '1rem' }}>
        {clefButton('treble', 'treble')}
        {clefButton('bass', 'bass')}
        {clefButton('grand', 'grand')}
        <button
          onClick={resetCurrent}
          title="Reset progress for this clef"
          style={{
            marginLeft: 'auto',
            background: PAL.bgCard,
            color: PAL.textMuted,
            border: `1px solid ${PAL.border}`,
            borderRadius: 3,
            padding: '6px 10px',
            fontFamily: PAL.mono,
            fontSize: '0.65rem',
            letterSpacing: '0.08em',
            textTransform: 'uppercase',
            cursor: 'pointer',
          }}
        >
          reset
        </button>
      </div>

      {/* Staff card */}
      <div style={{
        width: '100%', maxWidth: 560,
        background: PAL.bgCard,
        border: `1px solid ${PAL.border}`,
        borderRadius: 3,
        padding: '18px 14px 14px',
        display: 'flex', flexDirection: 'column', alignItems: 'center',
        animation: feedback === 'incorrect' ? 'ladderShake 0.4s ease' : undefined,
      }}>
        <div key={currentNote.id + '-' + step} style={{ width: '100%', display: 'flex', justifyContent: 'center', animation: 'ladderNoteAppear 0.25s ease' }}>
          {renderStaff()}
        </div>
        <div style={{ minHeight: 28, marginTop: 4, textAlign: 'center' }}>
          {feedback === null && (
            <div style={{ fontStyle: 'italic', color: PAL.textDim, fontSize: '0.95rem' }}>what note is this?</div>
          )}
          {feedback === 'correct' && (
            <div style={{ fontStyle: 'italic', color: PAL.good, fontSize: '1rem', fontWeight: 500 }}>
              {'\u2713 '}{currentNote.name}{octaveSub(currentNote.octave)}
            </div>
          )}
          {feedback === 'incorrect' && (
            <div style={{ fontStyle: 'italic', color: PAL.bad, fontSize: '1rem', fontWeight: 500 }}>
              that was {currentNote.name}{octaveSub(currentNote.octave)}
            </div>
          )}
        </div>
      </div>

      {/* Keyboard */}
      <div style={{ width: '100%', maxWidth: 560, marginTop: '1rem' }}>
        {renderKeyboard()}
      </div>

      {/* Stats strip */}
      <div style={{
        width: '100%', maxWidth: 560, marginTop: '1.5rem',
        display: 'flex', justifyContent: 'space-between',
        color: PAL.textDim, fontSize: '0.72rem', fontFamily: PAL.mono,
      }}>
        <div>
          <span style={{ textTransform: 'uppercase', letterSpacing: '0.1em' }}>seen</span>
          <span style={{ margin: '0 6px', opacity: 0.5 }}>·</span>
          <span style={{ color: PAL.text }}>{stats.total}</span>
        </div>
        <div>
          <span style={{ textTransform: 'uppercase', letterSpacing: '0.1em' }}>accuracy</span>
          <span style={{ margin: '0 6px', opacity: 0.5 }}>·</span>
          <span style={{ color: PAL.text }}>{accuracy}%</span>
        </div>
        <div>
          <span style={{ textTransform: 'uppercase', letterSpacing: '0.1em' }}>best</span>
          <span style={{ margin: '0 6px', opacity: 0.5 }}>·</span>
          <span style={{ color: PAL.text }}>{stats.bestStreak}</span>
        </div>
      </div>

      {/* Footer */}
      <div style={{
        marginTop: '1.5rem', textAlign: 'center', maxWidth: 420,
        fontSize: '0.8rem', color: PAL.textMuted, fontStyle: 'italic',
        lineHeight: 1.55,
      }}>
        Notes you miss return sooner; notes you know drift further back. Dots on each key show
        mastery. Keys 1–7 answer C–B. Progress persists per clef.
      </div>
    </div>
  );
}
