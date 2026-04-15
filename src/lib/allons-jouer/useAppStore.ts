import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { Screen, BellowsDir, InputMode, DetectedNote, TimingResult, LessonMode } from './types';

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
}

interface AppActions {
  goHome: () => void;
  goTo: (screen: Screen) => void;
  startLesson: (songId: string) => void;
  advanceLesson: (hit?: boolean) => void;
  completeSong: (songId: string) => void;
  restartLesson: () => void;
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
};

export const useAppStore = create<AppState & AppActions>()(
  persist(
    (set, get) => ({
      ...INITIAL_STATE,

      goHome: () => set({ ...INITIAL_STATE, completedSongs: get().completedSongs }),
      goTo: (screen) => set({ screen }),

      startLesson: (songId) => set({
        screen: 'lesson',
        selectedSong: songId,
        lessonStep: 0,
        streak: 0,
        timingResult: null,
        detectedNote: null,
        trackPosition: 0,
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
    }),
    {
      name: 'allons-jouer',
      // Only persist progress — everything else resets on load
      partialize: (state) => ({ completedSongs: state.completedSongs }),
    }
  )
);
