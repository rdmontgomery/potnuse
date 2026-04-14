import { useMemo, useRef, useEffect, useState } from 'react';
import { K, FONTS } from '@/lib/allons-jouer/tokens';
import { ACCORDION_NOTES } from '@/lib/allons-jouer/accordion';
import type { Song, LessonMode, DetectedNote } from '@/lib/allons-jouer/types';

interface Props {
  song: Song;
  lessonStep: number;
  mode: LessonMode;
  trackPosition: number;
  detectedNote: DetectedNote | null;
  demoNote: DetectedNote | null;
  isPlaying: boolean;
  isComplete: boolean;
}

const ROW_HEIGHT = 36;
const ROW_GAP = 2;
const TRACK_HEIGHT = ROW_HEIGHT * 10 + ROW_GAP * 9;
const PLAY_LINE_FRAC = 0.15; // play line at 15% from left
const LABEL_WIDTH = 36;

export function NoteTrack({ song, lessonStep, mode, trackPosition, detectedNote, demoNote, isPlaying, isComplete }: Props) {
  const viewportRef = useRef<HTMLDivElement>(null);
  const [viewportWidth, setViewportWidth] = useState(600);

  useEffect(() => {
    if (!viewportRef.current) return;
    const obs = new ResizeObserver(entries => {
      for (const e of entries) setViewportWidth(e.contentRect.width);
    });
    obs.observe(viewportRef.current);
    return () => obs.disconnect();
  }, []);

  const trackWidth = viewportWidth - LABEL_WIDTH;
  const playLineX = trackWidth * PLAY_LINE_FRAC;

  // Pre-compute start times and pxPerMs
  const { startTimes, totalDuration, pxPerMs } = useMemo(() => {
    const starts: number[] = [];
    let t = 0;
    for (const n of song.notes) {
      starts.push(t);
      t += n.duration;
    }
    // Show ~5 seconds of music in the visible area
    const px = trackWidth / 5000;
    return { startTimes: starts, totalDuration: t, pxPerMs: px };
  }, [song.notes, trackWidth]);

  // Button rows: 10→1 top to bottom (index 0 = button 10, index 9 = button 1)
  const buttonForRow = (rowIndex: number) => 10 - rowIndex;

  // Compute track offset
  const getOffset = () => {
    if (isComplete && !isPlaying) {
      return playLineX - totalDuration * pxPerMs;
    }
    // During demo, always scroll smoothly via trackPosition
    if (isPlaying) {
      return playLineX - trackPosition * pxPerMs;
    }
    if (mode === 'ownPace') {
      if (lessonStep < startTimes.length) {
        return playLineX - startTimes[lessonStep] * pxPerMs;
      }
      return playLineX - totalDuration * pxPerMs;
    }
    // keepUp: driven by trackPosition
    return playLineX - trackPosition * pxPerMs;
  };

  const offset = getOffset();

  // Render note blocks
  const noteBlocks = useMemo(() => {
    return song.notes.map((n, i) => {
      const rowIndex = 10 - n.button; // button 10 → row 0, button 1 → row 9
      const x = startTimes[i] * pxPerMs;
      const w = Math.max(n.duration * pxPerMs, 4); // min 4px width
      const color = n.dir === 'push' ? K.push : K.pull;
      const brightColor = n.dir === 'push' ? K.pushBright : K.pullBright;

      return { i, rowIndex, x, w, color, brightColor, dir: n.dir, button: n.button };
    });
  }, [song.notes, startTimes, pxPerMs]);

  return (
    <div style={{
      display: 'flex',
      borderRadius: 8,
      border: `1px solid ${K.border}`,
      background: K.bg,
      overflow: 'hidden',
    }}>
      {/* Row labels */}
      <div style={{
        width: LABEL_WIDTH, flexShrink: 0,
        display: 'flex', flexDirection: 'column', gap: ROW_GAP,
        background: K.bgCard,
        borderRight: `1px solid ${K.border}`,
        zIndex: 2,
      }}>
        {Array.from({ length: 10 }, (_, rowIndex) => {
          const btnNum = buttonForRow(rowIndex);
          const activeNote = isPlaying ? demoNote : detectedNote;
          const isActive = activeNote?.button === btnNum;
          return (
            <div key={btnNum} style={{
              height: ROW_HEIGHT, display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 11, fontFamily: FONTS.mono,
              color: isActive ? K.text : K.textMuted,
              background: isActive ? (activeNote?.dir === 'push' ? K.push + '33' : K.pull + '33') : 'transparent',
              transition: 'all 0.1s',
            }}>
              {btnNum}
            </div>
          );
        })}
      </div>

      {/* Track viewport */}
      <div ref={viewportRef} style={{
        flex: 1, position: 'relative', height: TRACK_HEIGHT + ROW_GAP * 9,
        overflow: 'hidden',
      }}>
        {/* Scrolling track */}
        <div style={{
          position: 'absolute', top: 0, left: 0,
          width: totalDuration * pxPerMs + trackWidth,
          height: '100%',
          transform: `translateX(${offset}px)`,
          transition: mode === 'ownPace' && !isPlaying ? 'transform 0.3s ease-out' : 'none',
        }}>
          {/* Row grid lines */}
          {Array.from({ length: 9 }, (_, i) => (
            <div key={`grid-${i}`} style={{
              position: 'absolute',
              top: (i + 1) * (ROW_HEIGHT + ROW_GAP) - ROW_GAP / 2,
              left: 0, right: 0, height: 1,
              background: K.border + '66',
            }} />
          ))}

          {/* Note blocks */}
          {noteBlocks.map(({ i, rowIndex, x, w, color, brightColor, dir, button }) => {
            // During demo, highlight based on trackPosition and demoNote
            const noteStart = startTimes[i];
            const noteEnd = noteStart + song.notes[i].duration;
            const isDemoActive = isPlaying && trackPosition >= noteStart && trackPosition < noteEnd;
            const isDemoPlayed = isPlaying && trackPosition >= noteEnd;

            const isPast = isPlaying ? isDemoPlayed : i < lessonStep;
            const isCurrent = isPlaying ? isDemoActive : (i === lessonStep && !isComplete);
            const isFuture = isPlaying ? (!isDemoActive && !isDemoPlayed) : i > lessonStep;

            const activeNote = isPlaying ? demoNote : detectedNote;
            const isBeingPlayed = isCurrent && activeNote?.button === button && activeNote?.dir === dir;

            let bg: string = color;
            let opacity = 0.6;
            let shadow = 'none';

            if (isPast) { opacity = 0.25; }
            if (isCurrent) {
              opacity = 1;
              bg = brightColor;
              shadow = `0 0 8px ${brightColor}66`;
            }
            if (isBeingPlayed) {
              shadow = `0 0 16px ${brightColor}`;
            }
            if (isFuture) { opacity = 0.5; }

            return (
              <div key={i} style={{
                position: 'absolute',
                left: x,
                top: rowIndex * (ROW_HEIGHT + ROW_GAP) + 2,
                width: w,
                height: ROW_HEIGHT - 4,
                background: bg,
                opacity,
                borderRadius: 4,
                boxShadow: shadow,
                transition: 'opacity 0.2s, box-shadow 0.2s',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                {w > 30 && (
                  <span style={{
                    fontSize: 10, fontFamily: FONTS.mono,
                    color: isCurrent ? '#fff' : K.text,
                    opacity: isCurrent ? 1 : 0.7,
                    userSelect: 'none',
                  }}>
                    {ACCORDION_NOTES.find(b => b.button === song.notes[i].button)?.[dir]?.note}
                  </span>
                )}
              </div>
            );
          })}
        </div>

        {/* Play line */}
        <div style={{
          position: 'absolute',
          left: playLineX, top: 0, bottom: 0,
          width: 2,
          background: K.accent,
          boxShadow: `0 0 8px ${K.accent}66`,
          zIndex: 1,
        }} />
      </div>
    </div>
  );
}
