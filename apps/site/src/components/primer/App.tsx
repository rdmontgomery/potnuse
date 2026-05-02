import { useState, useEffect, useCallback, useMemo, useRef } from 'react';

type Mode = 'letters' | 'words' | 'pictures' | 'spell';

interface Tile { id: string; letter: string; }

interface LetterCard {
  kind: 'letter';
  id: string;
  letter: string;
  exemplar: string;
  emoji: string;
}

interface WordCard {
  kind: 'word';
  id: string;
  word: string;
  emoji: string;
}

type Card = LetterCard | WordCard;

// Each letter shown alongside one exemplar word + emoji whose name starts with
// that letter's most-common short sound.
const LETTERS: LetterCard[] = [
  { kind: 'letter', id: 'A', letter: 'A', exemplar: 'apple',    emoji: '\u{1F34E}' },
  { kind: 'letter', id: 'B', letter: 'B', exemplar: 'ball',     emoji: '⚽' },
  { kind: 'letter', id: 'C', letter: 'C', exemplar: 'cat',      emoji: '\u{1F431}' },
  { kind: 'letter', id: 'D', letter: 'D', exemplar: 'dog',      emoji: '\u{1F436}' },
  { kind: 'letter', id: 'E', letter: 'E', exemplar: 'egg',      emoji: '\u{1F95A}' },
  { kind: 'letter', id: 'F', letter: 'F', exemplar: 'fish',     emoji: '\u{1F41F}' },
  { kind: 'letter', id: 'G', letter: 'G', exemplar: 'goat',     emoji: '\u{1F410}' },
  { kind: 'letter', id: 'H', letter: 'H', exemplar: 'hat',      emoji: '\u{1F3A9}' },
  { kind: 'letter', id: 'I', letter: 'I', exemplar: 'insect',   emoji: '\u{1F41B}' },
  { kind: 'letter', id: 'J', letter: 'J', exemplar: 'juice',    emoji: '\u{1F9C3}' },
  { kind: 'letter', id: 'K', letter: 'K', exemplar: 'key',      emoji: '\u{1F511}' },
  { kind: 'letter', id: 'L', letter: 'L', exemplar: 'lion',     emoji: '\u{1F981}' },
  { kind: 'letter', id: 'M', letter: 'M', exemplar: 'moon',     emoji: '\u{1F319}' },
  { kind: 'letter', id: 'N', letter: 'N', exemplar: 'nose',     emoji: '\u{1F443}' },
  { kind: 'letter', id: 'O', letter: 'O', exemplar: 'octopus',  emoji: '\u{1F419}' },
  { kind: 'letter', id: 'P', letter: 'P', exemplar: 'pig',      emoji: '\u{1F437}' },
  { kind: 'letter', id: 'Q', letter: 'Q', exemplar: 'queen',    emoji: '\u{1F478}' },
  { kind: 'letter', id: 'R', letter: 'R', exemplar: 'rainbow',  emoji: '\u{1F308}' },
  { kind: 'letter', id: 'S', letter: 'S', exemplar: 'sun',      emoji: '☀️' },
  { kind: 'letter', id: 'T', letter: 'T', exemplar: 'tree',     emoji: '\u{1F333}' },
  { kind: 'letter', id: 'U', letter: 'U', exemplar: 'umbrella', emoji: '☂️' },
  { kind: 'letter', id: 'V', letter: 'V', exemplar: 'violin',   emoji: '\u{1F3BB}' },
  { kind: 'letter', id: 'W', letter: 'W', exemplar: 'whale',    emoji: '\u{1F433}' },
  { kind: 'letter', id: 'X', letter: 'X', exemplar: 'fox',      emoji: '\u{1F98A}' },
  { kind: 'letter', id: 'Y', letter: 'Y', exemplar: 'yarn',     emoji: '\u{1F9F6}' },
  { kind: 'letter', id: 'Z', letter: 'Z', exemplar: 'zebra',    emoji: '\u{1F993}' },
];

// CVC and near-CVC short words. Kept short so phonics blending works cleanly.
const WORDS: WordCard[] = [
  { kind: 'word', id: 'cat', word: 'cat', emoji: '\u{1F431}' },
  { kind: 'word', id: 'dog', word: 'dog', emoji: '\u{1F436}' },
  { kind: 'word', id: 'pig', word: 'pig', emoji: '\u{1F437}' },
  { kind: 'word', id: 'hen', word: 'hen', emoji: '\u{1F414}' },
  { kind: 'word', id: 'bug', word: 'bug', emoji: '\u{1F41B}' },
  { kind: 'word', id: 'sun', word: 'sun', emoji: '☀️' },
  { kind: 'word', id: 'cup', word: 'cup', emoji: '☕' },
  { kind: 'word', id: 'hat', word: 'hat', emoji: '\u{1F3A9}' },
  { kind: 'word', id: 'bed', word: 'bed', emoji: '\u{1F6CF}️' },
  { kind: 'word', id: 'bus', word: 'bus', emoji: '\u{1F68C}' },
  { kind: 'word', id: 'fox', word: 'fox', emoji: '\u{1F98A}' },
  { kind: 'word', id: 'pen', word: 'pen', emoji: '\u{1F58A}️' },
  { kind: 'word', id: 'ant', word: 'ant', emoji: '\u{1F41C}' },
  { kind: 'word', id: 'web', word: 'web', emoji: '\u{1F578}️' },
  { kind: 'word', id: 'log', word: 'log', emoji: '\u{1FAB5}' },
  { kind: 'word', id: 'jet', word: 'jet', emoji: '✈️' },
  { kind: 'word', id: 'nut', word: 'nut', emoji: '\u{1F95C}' },
  { kind: 'word', id: 'bag', word: 'bag', emoji: '\u{1F45C}' },
  { kind: 'word', id: 'mom', word: 'mom', emoji: '\u{1F469}' },
  { kind: 'word', id: 'dad', word: 'dad', emoji: '\u{1F468}' },
];

// ---------- SRS ----------
interface CardState { level: number; nextReview: number; seen: number; correct: number; }
type CardStates = Record<string, CardState>;

const INTERVAL = (level: number) => 2 + Math.pow(2, level);

function initialStates(cards: { id: string }[]): CardStates {
  const s: CardStates = {};
  cards.forEach((c, i) => {
    s[c.id] = { level: 0, nextReview: i, seen: 0, correct: 0 };
  });
  return s;
}

function shuffle<T>(arr: T[]): T[] {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

function pickNext<T extends { id: string }>(cards: T[], states: CardStates, excludeId: string | null): T {
  const pool = cards.filter(c => c.id !== excludeId);
  shuffle(pool);
  pool.sort((a, b) => states[a.id].nextReview - states[b.id].nextReview);
  return pool[0];
}

function pickDistractors<T extends { id: string; emoji: string }>(cards: T[], target: T, count = 2): T[] {
  const pool = cards.filter(c => c.id !== target.id && c.emoji !== target.emoji);
  shuffle(pool);
  return pool.slice(0, count);
}

function updateStates(states: CardStates, id: string, correct: boolean, step: number): CardStates {
  const s = states[id];
  const next = { ...states };
  if (correct) {
    const level = Math.min(s.level + 1, 5);
    next[id] = {
      ...s,
      level,
      nextReview: step + INTERVAL(level) + Math.floor(Math.random() * 2),
      seen: s.seen + 1,
      correct: s.correct + 1,
    };
  } else {
    next[id] = {
      ...s,
      level: 0,
      nextReview: step + 2 + Math.floor(Math.random() * 2),
      seen: s.seen + 1,
    };
  }
  return next;
}

// ---------- Persistence ----------
const STORAGE_KEY = 'primer';
interface PersistShape {
  mode: Mode;
  states: Record<Mode, CardStates>;
  stats: Record<Mode, { correct: number; total: number; bestStreak: number }>;
  spellHard?: boolean;
}
function loadPersisted(): PersistShape | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as PersistShape;
  } catch { return null; }
}

// ---------- Speech ----------
function pickVoice(): SpeechSynthesisVoice | null {
  if (typeof window === 'undefined' || !window.speechSynthesis) return null;
  const voices = window.speechSynthesis.getVoices();
  if (!voices.length) return null;
  const en = voices.filter(v => v.lang && v.lang.toLowerCase().startsWith('en'));
  const pref = en.find(v => /samantha|karen|google us english|microsoft zira|female/i.test(v.name));
  return pref ?? en[0] ?? voices[0];
}

// ---------- Palette ----------
const PAL = {
  bg: '#1a1207',
  bgCard: '#261d0f',
  bgButton: '#332814',
  border: '#3d2e1a',
  accent: '#e8a838',
  good: '#7aab5a',
  bad: '#c77a5a',
  text: '#f0e6d2',
  textDim: '#9e8e72',
  textMuted: '#6b5d48',
  serif: "'Crimson Pro', Georgia, serif",
  mono: "'JetBrains Mono', ui-monospace, 'SF Mono', monospace",
};

// ---------- Component ----------
export default function Primer() {
  const [mode, setMode] = useState<Mode>('letters');
  const [loaded, setLoaded] = useState(false);
  const [allStates, setAllStates] = useState<Record<Mode, CardStates>>(() => ({
    letters: initialStates(LETTERS),
    words: initialStates(WORDS),
    pictures: initialStates(WORDS),
    spell: initialStates(WORDS),
  }));
  const [allStats, setAllStats] = useState<Record<Mode, { correct: number; total: number; bestStreak: number }>>(() => ({
    letters: { correct: 0, total: 0, bestStreak: 0 },
    words: { correct: 0, total: 0, bestStreak: 0 },
    pictures: { correct: 0, total: 0, bestStreak: 0 },
    spell: { correct: 0, total: 0, bestStreak: 0 },
  }));
  const [streak, setStreak] = useState(0);
  const [step, setStep] = useState(0);

  const deck = useMemo(() => (mode === 'letters' ? LETTERS : WORDS) as Card[], [mode]);
  const [current, setCurrent] = useState<Card>(() => deck[0]);
  const [options, setOptions] = useState<Card[]>(() => deck.slice(0, 3));
  const [feedback, setFeedback] = useState<null | 'correct' | 'incorrect'>(null);
  const [pickedId, setPickedId] = useState<string | null>(null);
  const [locked, setLocked] = useState(false);
  const [voice, setVoice] = useState<SpeechSynthesisVoice | null>(null);

  // Spell-mode state.
  const [spellHard, setSpellHard] = useState(false);
  const [pool, setPool] = useState<Tile[]>([]);
  const [slots, setSlots] = useState<(Tile | null)[]>([]);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [dragPos, setDragPos] = useState<{ x: number; y: number } | null>(null);
  const dragOriginRef = useRef<{ x: number; y: number; offX: number; offY: number } | null>(null);
  const slotRefs = useRef<(HTMLDivElement | null)[]>([]);
  const poolRef = useRef<HTMLDivElement | null>(null);

  // Voices load asynchronously on most browsers.
  useEffect(() => {
    if (typeof window === 'undefined' || !window.speechSynthesis) return;
    const update = () => setVoice(pickVoice());
    update();
    window.speechSynthesis.addEventListener('voiceschanged', update);
    return () => window.speechSynthesis.removeEventListener('voiceschanged', update);
  }, []);

  // Speech helper (needs access to current voice).
  const speakSequence = useCallback((parts: { text: string; rate?: number; pitch?: number }[]) => {
    if (typeof window === 'undefined' || !window.speechSynthesis) return;
    try {
      window.speechSynthesis.cancel();
      parts.forEach(p => {
        const u = new SpeechSynthesisUtterance(p.text);
        u.rate = p.rate ?? 0.8;
        u.pitch = p.pitch ?? 1.15;
        if (voice) u.voice = voice;
        window.speechSynthesis.speak(u);
      });
    } catch { /* no-op */ }
  }, [voice]);

  // Slow speech naturally stretches the phonemes; the engine handles what our
  // ASCII phoneme-spellings could not. We say the word once stretched, then
  // again at normal speed for fluency. For letters we use the exemplar word
  // ("hat" slow → "hat" normal), which stretches the initial /h/ on screen.
  const speakPrompt = useCallback((card: Card) => {
    const text = card.kind === 'letter' ? card.exemplar : card.word;
    speakSequence([
      { text, rate: 0.2 },
      { text, rate: 0.95 },
    ]);
  }, [speakSequence]);

  // Load persisted state once.
  useEffect(() => {
    const p = loadPersisted();
    if (p) {
      if (p.mode) setMode(p.mode);
      if (p.states) setAllStates(prev => ({ ...prev, ...p.states }));
      if (p.stats) setAllStats(prev => ({ ...prev, ...p.stats }));
      if (typeof p.spellHard === 'boolean') setSpellHard(p.spellHard);
    }
    setLoaded(true);
  }, []);

  // Build a fresh round whenever mode changes (or after load).
  useEffect(() => {
    const states = allStates[mode];
    const next = pickNext(deck, states, null);
    setCurrent(next);
    if (mode === 'spell') {
      // Spell-setup effect populates pool/slots from the new current.
      setSlots([]);
      setPool([]);
    } else {
      const distractors = pickDistractors(deck, next, 2);
      setOptions(shuffle([next, ...distractors]));
    }
    setStep(0);
    setStreak(0);
    setFeedback(null);
    setPickedId(null);
    setLocked(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode]);

  // Persist whenever state changes.
  useEffect(() => {
    if (!loaded) return;
    try {
      const payload: PersistShape = { mode, states: allStates, stats: allStats, spellHard };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
    } catch { /* ignore */ }
  }, [mode, allStates, allStats, spellHard, loaded]);

  const isMatch = useCallback((option: Card, target: Card): boolean => {
    if (option.kind !== target.kind) return false;
    if (option.kind === 'letter' && target.kind === 'letter') return option.letter === target.letter;
    if (option.kind === 'word' && target.kind === 'word') return option.word === target.word;
    return false;
  }, []);

  const recordResult = useCallback((correct: boolean) => {
    setLocked(true);
    const newStep = step + 1;
    const newStreak = correct ? streak + 1 : 0;
    const prevStats = allStats[mode];
    const newStats = {
      correct: prevStats.correct + (correct ? 1 : 0),
      total: prevStats.total + 1,
      bestStreak: Math.max(prevStats.bestStreak, newStreak),
    };
    setFeedback(correct ? 'correct' : 'incorrect');
    setStreak(newStreak);
    setAllStats(prev => ({ ...prev, [mode]: newStats }));

    const newStates = updateStates(allStates[mode], current.id, correct, newStep);
    setAllStates(prev => ({ ...prev, [mode]: newStates }));
    setStep(newStep);

    // Reinforce either way: stretched-then-fluent reading of the target.
    speakPrompt(current);

    const delay = correct ? 1200 : 1700;
    setTimeout(() => {
      const next = pickNext(deck, newStates, current.id);
      setCurrent(next);
      if (mode !== 'spell') {
        const distractors = pickDistractors(deck, next, 2);
        setOptions(shuffle([next, ...distractors]));
      }
      setFeedback(null);
      setPickedId(null);
      setLocked(false);
    }, delay);
  }, [step, streak, allStats, allStates, mode, current, deck, speakPrompt]);

  const handleAnswer = useCallback((option: Card) => {
    if (locked) return;
    setPickedId(option.id);
    recordResult(isMatch(option, current));
  }, [locked, current, isMatch, recordResult]);

  // ---------- Spell mode ----------

  // Build a fresh tile pool for the current word when entering spell mode,
  // when the word advances, or when the difficulty toggles.
  useEffect(() => {
    if (mode !== 'spell' || current.kind !== 'word') return;
    const word = current.word;
    const baseTiles: Tile[] = word.split('').map((ch, i) => ({ id: `t${i}`, letter: ch }));
    let tiles = baseTiles;
    if (spellHard) {
      const used = new Set(word.split(''));
      const remaining = 'abcdefghijklmnopqrstuvwxyz'.split('').filter(ch => !used.has(ch));
      shuffle(remaining);
      const distCount = Math.min(2 + Math.floor(Math.random() * 2), remaining.length);
      const distractors: Tile[] = remaining.slice(0, distCount).map((ch, i) => ({ id: `d${i}`, letter: ch }));
      tiles = [...baseTiles, ...distractors];
    }
    // Re-shuffle if we accidentally land on the correct order (3-letter words can hit this often).
    let attempts = 0;
    do {
      shuffle(tiles);
      attempts++;
    } while (attempts < 6 && tiles.length === word.length && tiles.map(t => t.letter).join('') === word);
    setPool(tiles);
    setSlots(new Array(word.length).fill(null));
    setDraggingId(null);
    if (loaded) speakPrompt(current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [current, mode, spellHard, loaded]);

  // When all slots are filled, score the attempt.
  useEffect(() => {
    if (mode !== 'spell' || current.kind !== 'word' || locked) return;
    if (slots.length === 0 || !slots.every(s => s !== null)) return;
    const spelled = (slots as Tile[]).map(s => s.letter).join('');
    recordResult(spelled === current.word);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slots, mode, current, locked]);

  const moveTile = useCallback((tile: Tile, dest: number | 'pool') => {
    let sourceSlot = -1;
    for (let i = 0; i < slots.length; i++) {
      if (slots[i] && slots[i]!.id === tile.id) { sourceSlot = i; break; }
    }
    const fromPool = sourceSlot === -1;

    if (dest === 'pool') {
      if (fromPool) return;
      setSlots(s => { const ns = [...s]; ns[sourceSlot] = null; return ns; });
      setPool(p => p.some(t => t.id === tile.id) ? p : [...p, tile]);
      return;
    }
    if (!fromPool && sourceSlot === dest) return;
    const displaced = slots[dest];
    setSlots(s => {
      const ns = [...s];
      if (!fromPool) ns[sourceSlot] = null;
      ns[dest] = tile;
      return ns;
    });
    if (fromPool) {
      setPool(p => p.filter(t => t.id !== tile.id));
    }
    if (displaced) {
      setPool(p => p.some(t => t.id === displaced.id) ? p : [...p, displaced]);
    }
  }, [slots]);

  const handleTilePointerDown = (e: React.PointerEvent<HTMLDivElement>, tile: Tile) => {
    if (locked) return;
    e.preventDefault();
    const target = e.currentTarget;
    const rect = target.getBoundingClientRect();
    dragOriginRef.current = {
      x: rect.left,
      y: rect.top,
      offX: e.clientX - rect.left,
      offY: e.clientY - rect.top,
    };
    try { target.setPointerCapture(e.pointerId); } catch { /* */ }
    setDraggingId(tile.id);
    setDragPos({ x: e.clientX, y: e.clientY });
  };

  const handleTilePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (draggingId === null) return;
    setDragPos({ x: e.clientX, y: e.clientY });
  };

  const handleTilePointerUp = (e: React.PointerEvent<HTMLDivElement>, tile: Tile) => {
    if (draggingId === null) return;
    const x = e.clientX, y = e.clientY;
    let target: number | 'pool' | null = null;
    for (let i = 0; i < slotRefs.current.length; i++) {
      const el = slotRefs.current[i];
      if (!el) continue;
      const r = el.getBoundingClientRect();
      if (x >= r.left && x <= r.right && y >= r.top && y <= r.bottom) {
        target = i;
        break;
      }
    }
    if (target === null && poolRef.current) {
      const r = poolRef.current.getBoundingClientRect();
      if (x >= r.left && x <= r.right && y >= r.top && y <= r.bottom) target = 'pool';
    }
    if (target !== null) moveTile(tile, target);
    setDraggingId(null);
    setDragPos(null);
    dragOriginRef.current = null;
  };

  const renderTile = (tile: Tile) => {
    const isDragging = draggingId === tile.id;
    const transform = isDragging && dragPos && dragOriginRef.current
      ? `translate(${dragPos.x - dragOriginRef.current.offX - dragOriginRef.current.x}px, ${dragPos.y - dragOriginRef.current.offY - dragOriginRef.current.y}px) scale(1.05)`
      : undefined;
    return (
      <div
        key={tile.id}
        onPointerDown={(e) => handleTilePointerDown(e, tile)}
        onPointerMove={handleTilePointerMove}
        onPointerUp={(e) => handleTilePointerUp(e, tile)}
        onPointerCancel={(e) => handleTilePointerUp(e, tile)}
        style={{
          width: 56, height: 66,
          background: PAL.accent,
          color: PAL.bg,
          borderRadius: 6,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontFamily: PAL.serif,
          fontWeight: 600,
          fontSize: '2.4rem',
          lineHeight: 1,
          cursor: locked ? 'default' : 'grab',
          userSelect: 'none',
          touchAction: 'none',
          transform,
          zIndex: isDragging ? 100 : 1,
          position: 'relative',
          boxShadow: '0 2px 0 rgba(0,0,0,0.3), inset 0 -2px 0 rgba(0,0,0,0.15)',
          transition: isDragging ? 'none' : 'transform 0.15s ease, opacity 0.15s ease',
          opacity: isDragging ? 0.92 : 1,
          WebkitTapHighlightColor: 'transparent',
        }}
      >
        {tile.letter}
      </div>
    );
  };

  const stats = allStats[mode];
  const accuracy = stats.total > 0 ? Math.round((stats.correct / stats.total) * 100) : 0;

  const resetCurrent = () => {
    const fresh = initialStates(deck);
    setAllStates(prev => ({ ...prev, [mode]: fresh }));
    setAllStats(prev => ({ ...prev, [mode]: { correct: 0, total: 0, bestStreak: 0 } }));
    setStreak(0);
    setStep(0);
    const next = pickNext(deck, fresh, null);
    setCurrent(next);
    if (mode === 'spell') {
      setSlots([]);
      setPool([]);
    } else {
      setOptions(shuffle([next, ...pickDistractors(deck, next, 2)]));
    }
    setFeedback(null);
    setPickedId(null);
    setLocked(false);
  };

  // ---------- Render bits ----------
  const modeButton = (m: Mode, label: string) => (
    <button
      onClick={() => setMode(m)}
      style={{
        flex: 1,
        background: mode === m ? PAL.accent : PAL.bgCard,
        color: mode === m ? PAL.bg : PAL.textDim,
        border: `1px solid ${mode === m ? PAL.accent : PAL.border}`,
        borderRadius: 3,
        padding: '6px 8px',
        fontFamily: PAL.mono,
        fontSize: '0.72rem',
        letterSpacing: '0.06em',
        textTransform: 'uppercase',
        cursor: 'pointer',
        fontWeight: mode === m ? 700 : 500,
      }}
    >
      {label}
    </button>
  );

  const renderPromptCard = () => {
    const accent =
      feedback === 'correct' ? PAL.good :
      feedback === 'incorrect' ? PAL.bad :
      PAL.accent;

    if (current.kind === 'letter') {
      return (
        <div
          key={current.id + '-' + step}
          style={{
            display: 'flex', flexDirection: 'column', alignItems: 'center',
            animation: 'primerAppear 0.25s ease',
          }}
        >
          <div style={{
            display: 'flex', alignItems: 'baseline', gap: '0.4em',
            color: accent,
            fontFamily: PAL.serif,
            fontWeight: 500,
            lineHeight: 1,
            transition: 'color 0.25s ease',
          }}>
            <span style={{ fontSize: 'clamp(5rem, 22vw, 10rem)' }}>{current.letter}</span>
            <span style={{ fontSize: 'clamp(3.5rem, 15vw, 7rem)', opacity: 0.85 }}>{current.letter.toLowerCase()}</span>
          </div>
        </div>
      );
    }
    if (mode === 'spell') {
      return (
        <div
          key={current.id + '-' + step}
          style={{
            display: 'flex', flexDirection: 'column', alignItems: 'center',
            animation: 'primerAppear 0.25s ease',
          }}
        >
          <button
            onClick={() => current.kind === 'word' && speakPrompt(current)}
            aria-label="hear the word again"
            style={{
              background: 'transparent',
              border: 'none',
              fontSize: 'clamp(4.5rem, 18vw, 7.5rem)',
              lineHeight: 1,
              cursor: 'pointer',
              padding: '0.1em 0.2em',
              fontFamily: '"Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji",sans-serif',
              animation: feedback === null ? 'primerPulse 1.6s ease-in-out infinite' : undefined,
              WebkitTapHighlightColor: 'transparent',
            }}
          >
            {'\u{1F50A}'}
          </button>
        </div>
      );
    }
    if (mode === 'pictures') {
      return (
        <div
          key={current.id + '-' + step}
          style={{
            display: 'flex', flexDirection: 'column', alignItems: 'center',
            animation: 'primerAppear 0.25s ease',
          }}
        >
          <button
            onClick={() => speakPrompt(current)}
            aria-label={`hear ${current.word}`}
            style={{
              background: 'transparent',
              border: 'none',
              fontSize: 'clamp(5rem, 22vw, 9rem)',
              lineHeight: 1,
              cursor: 'pointer',
              padding: '0.1em 0.2em',
              fontFamily: '"Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji",sans-serif',
              filter: feedback === 'incorrect' ? 'grayscale(0.3)' : 'none',
              transition: 'filter 0.25s ease',
              WebkitTapHighlightColor: 'transparent',
            }}
          >
            {current.emoji}
          </button>
        </div>
      );
    }
    return (
      <div
        key={current.id + '-' + step}
        style={{
          display: 'flex', flexDirection: 'column', alignItems: 'center',
          animation: 'primerAppear 0.25s ease',
        }}
      >
        <button
          onClick={() => speakPrompt(current)}
          aria-label={`sound out ${current.word}`}
          style={{
            background: 'transparent',
            border: 'none',
            color: accent,
            fontFamily: PAL.serif,
            fontWeight: 500,
            fontSize: 'clamp(3.5rem, 14vw, 6.5rem)',
            lineHeight: 1,
            letterSpacing: '0.05em',
            cursor: 'pointer',
            padding: '0.1em 0.3em',
            transition: 'color 0.25s ease',
            WebkitTapHighlightColor: 'transparent',
          }}
        >
          {current.word}
        </button>
      </div>
    );
  };

  const renderOptions = () => {
    const wordButtons = mode === 'pictures';
    return (
      <div style={{
        display: 'grid',
        gridTemplateColumns: wordButtons ? '1fr' : 'repeat(3, 1fr)',
        gap: 8,
        width: '100%',
        maxWidth: 560,
      }}>
        {options.map(opt => {
          const isPicked = pickedId === opt.id;
          const isCorrect = isMatch(opt, current);
          const showCorrect = feedback !== null && isCorrect;
          const showWrong = feedback === 'incorrect' && isPicked;

          let bg = PAL.bgButton;
          let fg = PAL.text;
          let border = PAL.border;
          let shadow = '0 2px 0 rgba(0,0,0,0.25), inset 0 -2px 0 rgba(0,0,0,0.25)';
          let scale = 1;
          if (showCorrect) {
            bg = PAL.good; border = PAL.good; fg = PAL.bg;
            shadow = '0 0 26px rgba(122,171,90,0.5), inset 0 -2px 0 rgba(0,0,0,0.25)';
            scale = 1.04;
          } else if (showWrong) {
            bg = PAL.bad; border = PAL.bad; fg = PAL.bg;
            shadow = '0 0 26px rgba(199,122,90,0.45), inset 0 -2px 0 rgba(0,0,0,0.25)';
          }

          const label = opt.kind === 'letter' ? opt.exemplar : opt.word;

          return (
            <button
              key={opt.id}
              onClick={() => handleAnswer(opt)}
              disabled={locked}
              aria-label={label}
              style={{
                background: bg,
                color: fg,
                border: `1px solid ${border}`,
                borderRadius: 6,
                boxShadow: shadow,
                transform: `scale(${scale})`,
                cursor: locked ? 'default' : 'pointer',
                ...(wordButtons
                  ? {
                      padding: '1.1rem 0.6rem',
                      fontSize: 'clamp(2rem, 8vw, 3rem)',
                      fontFamily: PAL.serif,
                      fontWeight: 500,
                      letterSpacing: '0.04em',
                      lineHeight: 1,
                    }
                  : {
                      aspectRatio: '1 / 1',
                      fontSize: 'clamp(2.6rem, 11vw, 4.4rem)',
                      lineHeight: 1,
                      fontFamily: '"Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji",sans-serif',
                    }),
                transition: 'transform 0.15s ease, background 0.2s ease, box-shadow 0.2s ease, color 0.2s ease',
                WebkitTapHighlightColor: 'transparent',
              }}
            >
              {wordButtons ? (opt.kind === 'word' ? opt.word : opt.id) : opt.emoji}
            </button>
          );
        })}
      </div>
    );
  };

  const renderSpell = () => {
    const targetWord = current.kind === 'word' ? current.word : '';
    return (
      <div
        key={current.id + '-' + step}
        style={{
          width: '100%', display: 'flex', flexDirection: 'column', gap: 14,
          alignItems: 'center', animation: 'primerAppear 0.25s ease',
        }}
      >
        {/* Slots */}
        <div style={{ display: 'flex', gap: 8, justifyContent: 'center', flexWrap: 'wrap' }}>
          {slots.map((tile, i) => {
            const correctLetter = targetWord[i] ?? '';
            const isRight = feedback !== null && tile && tile.letter === correctLetter;
            const isWrong = feedback === 'incorrect' && tile && tile.letter !== correctLetter;
            let border = PAL.border;
            let bg: string = PAL.bg;
            if (isRight) { border = PAL.good; bg = 'rgba(122,171,90,0.18)'; }
            else if (isWrong) { border = PAL.bad; bg = 'rgba(199,122,90,0.18)'; }
            return (
              <div
                key={i}
                ref={(el) => { slotRefs.current[i] = el; }}
                style={{
                  width: 64, height: 76,
                  border: `2px dashed ${border}`,
                  background: bg,
                  borderRadius: 8,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  transition: 'background 0.2s ease, border-color 0.2s ease',
                }}
              >
                {tile && renderTile(tile)}
              </div>
            );
          })}
        </div>
        {/* Pool */}
        <div
          ref={poolRef}
          style={{
            width: '100%', minHeight: 90,
            display: 'flex', gap: 8, justifyContent: 'center', flexWrap: 'wrap',
            padding: 10,
            background: PAL.bgCard,
            border: `1px dashed ${PAL.border}`,
            borderRadius: 8,
          }}
        >
          {pool.map(tile => renderTile(tile))}
        </div>
      </div>
    );
  };

  const promptHint = (() => {
    if (feedback === 'correct') {
      if (current.kind === 'letter') return `${current.letter.toLowerCase()} is for ${current.exemplar}`;
      return current.word;
    }
    if (feedback === 'incorrect') {
      if (current.kind === 'letter') return `${current.letter.toLowerCase()} is for ${current.exemplar}`;
      return current.word;
    }
    if (mode === 'letters') return 'tap the picture that starts with this letter';
    if (mode === 'words') return 'tap the picture that matches this word';
    if (mode === 'pictures') return 'tap the word that matches this picture';
    return spellHard ? 'drag the right letters into place' : 'drag the letters into place';
  })();

  const promptColor =
    feedback === 'correct' ? PAL.good :
    feedback === 'incorrect' ? PAL.bad :
    PAL.textDim;

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
        @keyframes primerAppear { 0% { opacity: 0; transform: translateY(-6px); } 100% { opacity: 1; transform: translateY(0); } }
        @keyframes primerShake { 0%,100%{transform:translateX(0)} 20%{transform:translateX(-4px)} 40%{transform:translateX(3px)} 60%{transform:translateX(-3px)} 80%{transform:translateX(2px)} }
        @keyframes primerPulse { 0%,100% { transform: scale(1); } 50% { transform: scale(1.06); } }
        button:active:not(:disabled) { transform: scale(0.97) !important; }
      `}</style>

      {/* Header */}
      <div style={{
        width: '100%', maxWidth: 560, display: 'flex',
        justifyContent: 'space-between', alignItems: 'flex-end',
        marginBottom: '1rem',
      }}>
        <div>
          <div style={{ fontFamily: PAL.serif, fontSize: '1.8rem', fontWeight: 500, lineHeight: 1, color: PAL.text }}>
            primer
          </div>
          <div style={{ fontFamily: PAL.mono, fontSize: '0.65rem', color: PAL.textMuted, marginTop: 4, letterSpacing: '0.1em', textTransform: 'uppercase' }}>
            first reads · spaced repetition
          </div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontFamily: PAL.mono, fontSize: '0.6rem', color: PAL.textMuted, letterSpacing: '0.1em', textTransform: 'uppercase' }}>streak</div>
          <div style={{ fontFamily: PAL.serif, fontSize: '1.8rem', fontWeight: 500, lineHeight: 1, color: PAL.accent }}>{streak}</div>
        </div>
      </div>

      {/* Mode selector */}
      <div style={{ width: '100%', maxWidth: 560, display: 'flex', gap: 6, marginBottom: 6 }}>
        {modeButton('letters', 'letters')}
        {modeButton('words', 'words')}
        {modeButton('pictures', 'pictures')}
        {modeButton('spell', 'spell')}
      </div>

      {/* Action row */}
      <div style={{ width: '100%', maxWidth: 560, display: 'flex', gap: 6, marginBottom: '1rem' }}>
        <button
          onClick={() => speakPrompt(current)}
          title="Hear it again"
          style={{
            background: PAL.bgCard,
            color: PAL.accent,
            border: `1px solid ${PAL.border}`,
            borderRadius: 3,
            padding: '6px 12px',
            fontFamily: PAL.mono,
            fontSize: '0.65rem',
            letterSpacing: '0.08em',
            textTransform: 'uppercase',
            cursor: 'pointer',
          }}
        >
          {'\u{1F50A}'} say it
        </button>
        {mode === 'spell' && (
          <button
            onClick={() => setSpellHard(h => !h)}
            title={spellHard ? 'Drop extra letters' : 'Add letters that don’t belong'}
            style={{
              background: spellHard ? PAL.accent : PAL.bgCard,
              color: spellHard ? PAL.bg : PAL.textDim,
              border: `1px solid ${spellHard ? PAL.accent : PAL.border}`,
              borderRadius: 3,
              padding: '6px 10px',
              fontFamily: PAL.mono,
              fontSize: '0.65rem',
              letterSpacing: '0.08em',
              textTransform: 'uppercase',
              cursor: 'pointer',
              fontWeight: spellHard ? 700 : 500,
            }}
          >
            + extras
          </button>
        )}
        <button
          onClick={resetCurrent}
          title="Reset progress for this mode"
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

      {/* Prompt card */}
      <div style={{
        width: '100%', maxWidth: 560,
        background: PAL.bgCard,
        border: `1px solid ${PAL.border}`,
        borderRadius: 6,
        padding: '24px 14px 18px',
        display: 'flex', flexDirection: 'column', alignItems: 'center',
        animation: feedback === 'incorrect' ? 'primerShake 0.4s ease' : undefined,
      }}>
        {renderPromptCard()}
        <div style={{ minHeight: 28, marginTop: 14, textAlign: 'center' }}>
          <div style={{
            fontStyle: 'italic',
            color: promptColor,
            fontSize: '1rem',
            fontWeight: feedback ? 500 : 400,
            transition: 'color 0.25s ease',
          }}>
            {feedback === 'correct' && '✓ '}
            {promptHint}
          </div>
        </div>
      </div>

      {/* Options */}
      <div style={{ width: '100%', maxWidth: 560, marginTop: '1rem', display: 'flex', justifyContent: 'center' }}>
        {mode === 'spell' ? renderSpell() : renderOptions()}
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

    </div>
  );
}
