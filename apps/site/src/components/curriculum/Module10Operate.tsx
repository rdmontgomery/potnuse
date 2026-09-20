import { useEffect, useRef, useState } from 'react';
import * as Tone from 'tone';
import { SCHENKER_TIERS } from '@/lib/music/schenker';
import { getPiano, stepsToSeconds, toTonePitch } from '@/lib/music/audio';
import { takeOver } from '@/lib/music/audioBus';

// Operate for Module 10. The four tiers as audible passages. Switch
// between foreground (full chorale phrase) and Ursatz (six notes in
// four bars) and the same harmonic arc clarifies into structure as
// the elaborations fall away.

export default function Module10Operate() {
  const [tier, setTier] = useState(0);
  const [playing, setPlaying] = useState(false);
  const playEndRef = useRef<number | null>(null);
  const busHandleRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    return () => {
      busHandleRef.current?.();
      busHandleRef.current = null;
      if (playEndRef.current != null) {
        window.clearTimeout(playEndRef.current);
        playEndRef.current = null;
      }
    };
  }, []);

  const play = async () => {
    if (playing) return;
    setPlaying(true);
    let piano;
    try {
      piano = await getPiano();
    } catch (err) {
      console.error('m10 operate load failed', err);
      setPlaying(false);
      return;
    }
    const song = SCHENKER_TIERS[tier].song;
    const bpm = song.bpm;
    const start = Tone.now() + 0.05;
    let lastEnd = start;
    for (const note of song.notes) {
      const onset = start + stepsToSeconds(note.step, bpm);
      const dur = stepsToSeconds(note.dur, bpm);
      const velocity = note.voice === 'bass' ? 0.55 : 0.82;
      piano.triggerAttackRelease(toTonePitch(note.pitch), dur, onset, velocity);
      lastEnd = Math.max(lastEnd, onset + dur);
    }
    busHandleRef.current = takeOver(
      () => {
        if (playEndRef.current != null) {
          window.clearTimeout(playEndRef.current);
          playEndRef.current = null;
        }
      },
      () => setPlaying(false),
    );
    const tailMs = (lastEnd - Tone.now()) * 1000 + 250;
    playEndRef.current = window.setTimeout(() => {
      busHandleRef.current?.();
      busHandleRef.current = null;
      setPlaying(false);
      playEndRef.current = null;
    }, Math.max(500, tailMs));
  };

  const current = SCHENKER_TIERS[tier];

  return (
    <div className="m10-operate">
      <div className="m10-tier-row">
        <span className="m10-tier-label">tier</span>
        <div className="m10-tier-buttons">
          {SCHENKER_TIERS.map((t, j) => (
            <button
              key={t.id}
              type="button"
              className={j === tier ? 'm10-tier-btn active' : 'm10-tier-btn'}
              onClick={() => {
                if (playing) return;
                setTier(j);
              }}
              disabled={playing}
              aria-pressed={j === tier}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      <button
        type="button"
        className="m10-operate-play"
        onClick={() => void play()}
        disabled={playing}
      >
        {playing ? 'playing…' : `play ${current.label}`}
      </button>

      <p className="m10-operate-caption">
        Same harmony in all four tiers — the elaboration changes, not
        the underlying functional arc. The Ursatz sounds like a hymn
        cadence reduced to its bones; the foreground sounds like the
        hymn.
      </p>
    </div>
  );
}
