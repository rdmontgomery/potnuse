import { useEffect, useRef, useMemo } from 'react';
import { useAppStore } from './useAppStore';
import { SONGS } from './songs';
import { rateDuration } from './pitchUtils';

export function useLesson() {
  const detectedNote = useAppStore(s => s.detectedNote);
  const selectedSong = useAppStore(s => s.selectedSong);
  const lessonStep = useAppStore(s => s.lessonStep);
  const lessonMode = useAppStore(s => s.lessonMode);
  const trackPosition = useAppStore(s => s.trackPosition);
  const isPlaying = useAppStore(s => s.isPlaying);
  const screen = useAppStore(s => s.screen);
  const { advanceLesson, completeSong, setTimingResult } = useAppStore.getState();

  const lastStepFiredRef = useRef<number>(-1);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hitRef = useRef<boolean>(false);

  const song = useMemo(() => SONGS.find(s => s.id === selectedSong), [selectedSong]);

  // Pre-compute start times for keepUp mode
  const startTimes = useMemo(() => {
    if (!song) return [];
    const starts: number[] = [];
    let t = 0;
    for (const n of song.notes) {
      starts.push(t);
      t += n.duration;
    }
    return starts;
  }, [song]);

  // Own Pace mode: detect correct note → advance
  useEffect(() => {
    if (screen !== 'lesson' || !song || !detectedNote || lessonMode !== 'ownPace' || isPlaying) return;
    if (lessonStep >= song.notes.length) return;

    const target = song.notes[lessonStep];
    if (detectedNote.button !== target.button || detectedNote.dir !== target.dir) return;
    if (lastStepFiredRef.current === lessonStep) return;

    lastStepFiredRef.current = lessonStep;
    if (timerRef.current) clearTimeout(timerRef.current);

    timerRef.current = setTimeout(() => {
      const held = useAppStore.getState().lastHoldDuration;
      if (held > 50) {
        const rating = rateDuration(held, target.duration);
        setTimingResult(rating);
        setTimeout(() => setTimingResult(null), 800);
      }

      if (lessonStep < song.notes.length - 1) {
        advanceLesson();
      } else {
        completeSong(song.id);
      }
    }, 400);
  }, [detectedNote, screen, selectedSong, lessonStep, lessonMode, isPlaying, advanceLesson, completeSong, setTimingResult, song]);

  // Keep Up mode: auto-advance based on trackPosition
  useEffect(() => {
    if (screen !== 'lesson' || !song || lessonMode !== 'keepUp' || isPlaying) return;
    if (lessonStep >= song.notes.length) return;

    const noteEnd = startTimes[lessonStep] + song.notes[lessonStep].duration;
    if (trackPosition >= noteEnd) {
      if (lessonStep < song.notes.length - 1) {
        advanceLesson();
      } else {
        completeSong(song.id);
      }
    }
  }, [trackPosition, screen, song, lessonMode, isPlaying, lessonStep, startTimes, advanceLesson, completeSong]);

  // Keep Up mode: detect hits during active window
  useEffect(() => {
    if (screen !== 'lesson' || !song || !detectedNote || lessonMode !== 'keepUp' || isPlaying) return;
    if (lessonStep >= song.notes.length) return;

    const target = song.notes[lessonStep];
    const noteStart = startTimes[lessonStep];
    const noteEnd = noteStart + target.duration;

    if (trackPosition >= noteStart && trackPosition < noteEnd) {
      if (detectedNote.button === target.button && detectedNote.dir === target.dir) {
        if (!hitRef.current) {
          hitRef.current = true;
          setTimingResult('good');
          setTimeout(() => setTimingResult(null), 400);
        }
      }
    }
  }, [detectedNote, trackPosition, screen, song, lessonMode, isPlaying, lessonStep, startTimes, setTimingResult]);

  // Reset fire-guard and hit tracking when step changes
  useEffect(() => {
    lastStepFiredRef.current = -1;
    hitRef.current = false;
  }, [lessonStep]);
}
