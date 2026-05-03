import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { Screen, BellowsDir, InputMode, DetectedNote, TimingResult, LessonMode } from './types';
import { getAllPhrases, initialPhraseStates, pickNextPhrase, updatePhraseState, type PhraseStates, type PhraseStats } from './phrases';

export type PhraseLayout = 'accordion' | 'keyboard';

interface AppState {
  screen: Screen;
  selectedSong: string | null;
  lessonStep: number;
  streak: number;
  completedSongs: string[];
  timingResult: TimingResult | null;
  bellowsDir: BellowsDir;
  detectedNote: DetectedNote | null;
  holdProgress: number;     // ms elapsed while holding
  lastHoldDuration: number; // ms held on last pointer-up (for timing rating)
  inputMode: InputMode;
  micError: string | null;
  isPlaying: boolean;
  demoNote: DetectedNote | null;
  lessonMode: LessonMode;
  trackPosition: number;
  tempoRatio: number;       // 0.6 | 0.8 | 1.0 — only affects Keep Up mode
  loopEnabled: boolean;

  // Phrase trainer (SRS)
  phraseStates: PhraseStates;
  phraseStats: PhraseStats;
  phraseCurrentId: string | null;
  phraseStep: number;       // SRS scheduling counter (across attempts)
  phraseStreak: number;
  phraseLayout: PhraseLayout;
}

interface AppActions {
  goHome: () => void;
  goTo: (screen: Screen) => void;
  startLesson: (songId: string, mode?: LessonMode, tempoRatio?: number) => void;
  advanceLesson: (hit?: boolean) => void;
  completeSong: (songId: string) => void;
  restartLesson: () => void;
  setLoopEnabled: (enabled: boolean) => void;
  toggleBellows: () => void;
  setBellows: (dir: BellowsDir) => void;
  setDetectedNote: (note: DetectedNote | null) => void;
  setHoldProgress: (ms: number) => void;
  setLastHoldDuration: (ms: number) => void;
  setTimingResult: (result: TimingResult | null) => void;
  setInputMode: (mode: InputMode) => void;
  setMicError: (err: string | null) => void;
  setIsPlaying: (playing: boolean) => void;
  setDemoNote: (note: DetectedNote | null) => void;
  setLessonMode: (mode: LessonMode) => void;
  setTrackPosition: (ms: number) => void;
  setTempoRatio: (ratio: number) => void;

  // Phrase trainer
  startPhraseTrainer: (layout?: PhraseLayout) => void;
  setPhraseLayout: (layout: PhraseLayout) => void;
  recordPhraseResult: (correct: boolean) => void;
  resetPhraseProgress: () => void;
}

export const INITIAL_STATE: AppState = {
  screen: 'home',
  selectedSong: null,
  lessonStep: 0,
  streak: 0,
  completedSongs: [],
  timingResult: null,
  bellowsDir: 'push',
  detectedNote: null,
  holdProgress: 0,
  lastHoldDuration: 0,
  inputMode: 'virtual',
  micError: null,
  isPlaying: false,
  demoNote: null,
  lessonMode: 'ownPace',
  trackPosition: 0,
  tempoRatio: 1,
  loopEnabled: false,
  phraseStates: initialPhraseStates(getAllPhrases()),
  phraseStats: { correct: 0, total: 0, bestStreak: 0 },
  phraseCurrentId: null,
  phraseStep: 0,
  phraseStreak: 0,
  phraseLayout: 'accordion',
};

export const useAppStore = create<AppState & AppActions>()(
  persist(
    (set, get) => ({
      ...INITIAL_STATE,

      goHome: () => set({
        ...INITIAL_STATE,
        completedSongs: get().completedSongs,
        loopEnabled: get().loopEnabled,
        phraseStates: get().phraseStates,
        phraseStats: get().phraseStats,
        phraseLayout: get().phraseLayout,
      }),
      goTo: (screen) => set({ screen }),

      startLesson: (songId, mode = 'ownPace', tempoRatio = 1) => set({
        screen: 'lesson',
        selectedSong: songId,
        lessonStep: 0,
        streak: 0,
        timingResult: null,
        detectedNote: null,
        trackPosition: 0,
        lessonMode: mode,
        tempoRatio,
      }),

      advanceLesson: (hit = true) => set(s => ({ lessonStep: s.lessonStep + 1, streak: hit ? s.streak + 1 : 0 })),

      completeSong: (songId) => set(s => ({
        completedSongs: s.completedSongs.includes(songId)
          ? s.completedSongs
          : [...s.completedSongs, songId],
      })),

      restartLesson: () => set({ lessonStep: 0, streak: 0, timingResult: null, trackPosition: 0 }),

      toggleBellows: () => set(s => ({ bellowsDir: s.bellowsDir === 'push' ? 'pull' : 'push' })),
      setBellows: (dir) => set({ bellowsDir: dir }),

      setDetectedNote: (note) => set({ detectedNote: note }),
      setHoldProgress: (ms) => set({ holdProgress: ms }),
      setLastHoldDuration: (ms) => set({ lastHoldDuration: ms }),
      setTimingResult: (result) => set({ timingResult: result }),
      setInputMode: (mode) => set({ inputMode: mode }),
      setMicError: (err) => set({ micError: err }),
      setIsPlaying: (playing) => set({ isPlaying: playing }),
      setDemoNote: (note) => set({ demoNote: note }),
      setLessonMode: (mode) => set({ lessonMode: mode, lessonStep: 0, streak: 0, trackPosition: 0, timingResult: null }),
      setTrackPosition: (ms) => set({ trackPosition: ms }),
      setTempoRatio: (ratio) => set({ tempoRatio: ratio }),
      setLoopEnabled: (enabled) => set({ loopEnabled: enabled }),

      startPhraseTrainer: (layout) => {
        const phrases = getAllPhrases();
        const states = get().phraseStates;
        // If we don't yet have state for some phrases (deck grew between loads), fill them in.
        const merged: PhraseStates = { ...states };
        phrases.forEach((p, i) => {
          if (!merged[p.id]) merged[p.id] = { level: 0, nextReview: i, seen: 0, correct: 0 };
        });
        const next = pickNextPhrase(phrases, merged, null);
        set({
          screen: 'phrases',
          phraseStates: merged,
          phraseCurrentId: next?.id ?? null,
          phraseStep: 0,
          phraseStreak: 0,
          ...(layout ? { phraseLayout: layout } : {}),
        });
      },

      setPhraseLayout: (layout) => set({ phraseLayout: layout }),

      recordPhraseResult: (correct) => {
        const phrases = getAllPhrases();
        const { phraseStates, phraseStats, phraseCurrentId, phraseStep, phraseStreak } = get();
        if (!phraseCurrentId) return;
        const newStep = phraseStep + 1;
        const newStreak = correct ? phraseStreak + 1 : 0;
        const nextStates = updatePhraseState(phraseStates, phraseCurrentId, correct, newStep);
        const nextStats: PhraseStats = {
          correct: phraseStats.correct + (correct ? 1 : 0),
          total: phraseStats.total + 1,
          bestStreak: Math.max(phraseStats.bestStreak, newStreak),
        };
        const next = pickNextPhrase(phrases, nextStates, phraseCurrentId);
        set({
          phraseStates: nextStates,
          phraseStats: nextStats,
          phraseStreak: newStreak,
          phraseStep: newStep,
          phraseCurrentId: next?.id ?? phraseCurrentId,
        });
      },

      resetPhraseProgress: () => {
        const phrases = getAllPhrases();
        set({
          phraseStates: initialPhraseStates(phrases),
          phraseStats: { correct: 0, total: 0, bestStreak: 0 },
          phraseCurrentId: phrases[0]?.id ?? null,
          phraseStep: 0,
          phraseStreak: 0,
        });
      },
    }),
    {
      name: 'allons-jouer',
      // Persist progress and loop preference — everything else resets on load
      partialize: (state) => ({
        completedSongs: state.completedSongs,
        loopEnabled: state.loopEnabled,
        phraseStates: state.phraseStates,
        phraseStats: state.phraseStats,
        phraseLayout: state.phraseLayout,
      }),
    }
  )
);
