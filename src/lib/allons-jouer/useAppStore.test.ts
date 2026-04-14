import { describe, it, expect, beforeEach } from 'vitest';
import { useAppStore, INITIAL_STATE } from './useAppStore';

beforeEach(() => {
  useAppStore.setState({ ...INITIAL_STATE, completedSongs: [] });
});

describe('useAppStore', () => {
  it('starts on home screen', () => {
    expect(useAppStore.getState().screen).toBe('home');
  });

  it('startLesson sets screen, song, resets step and streak', () => {
    useAppStore.getState().startLesson('jolie-blonde');
    const s = useAppStore.getState();
    expect(s.screen).toBe('lesson');
    expect(s.selectedSong).toBe('jolie-blonde');
    expect(s.lessonStep).toBe(0);
    expect(s.streak).toBe(0);
  });

  it('goHome resets navigation state, keeps completedSongs', () => {
    useAppStore.getState().startLesson('jolie-blonde');
    useAppStore.getState().completeSong('jolie-blonde');
    useAppStore.getState().goHome();
    const s = useAppStore.getState();
    expect(s.screen).toBe('home');
    expect(s.selectedSong).toBeNull();
    expect(s.completedSongs).toContain('jolie-blonde');
  });

  it('advanceLesson increments step and streak', () => {
    useAppStore.setState({ lessonStep: 0, streak: 0 });
    useAppStore.getState().advanceLesson();
    expect(useAppStore.getState().lessonStep).toBe(1);
    expect(useAppStore.getState().streak).toBe(1);
  });

  it('completeSong adds id without duplicates', () => {
    useAppStore.getState().completeSong('jolie-blonde');
    useAppStore.getState().completeSong('jolie-blonde');
    expect(useAppStore.getState().completedSongs.filter(s => s === 'jolie-blonde')).toHaveLength(1);
  });

  it('toggleBellows alternates push/pull', () => {
    expect(useAppStore.getState().bellowsDir).toBe('push');
    useAppStore.getState().toggleBellows();
    expect(useAppStore.getState().bellowsDir).toBe('pull');
    useAppStore.getState().toggleBellows();
    expect(useAppStore.getState().bellowsDir).toBe('push');
  });
});
