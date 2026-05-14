import * as Tone from 'tone';
import type { Song, Tier } from './types';

// Audio engine. Lead + comp go to a sampled piano (Salamander); bass goes to
// a monosynth tuned to a soft upright-bass tone. The slider doesn't pause
// audio — it just changes which tier's notes fire on the next onset. Notes
// already triggered ring out normally.

let piano: Tone.Sampler | null = null;
let bass: Tone.MonoSynth | null = null;
let scheduled: number[] = [];
let getTier: () => Tier = () => 0;
let loadPromise: Promise<void> | null = null;

const PIANO_URLS: Record<string, string> = {
  C3: 'C3.mp3',
  'F#3': 'Fs3.mp3',
  A3: 'A3.mp3',
  C4: 'C4.mp3',
  'F#4': 'Fs4.mp3',
  A4: 'A4.mp3',
  C5: 'C5.mp3',
  'F#5': 'Fs5.mp3',
};

// One-time async setup: resume the AudioContext (must run inside a user
// gesture) and load piano samples. Idempotent.
export function loadAudio(): Promise<void> {
  if (loadPromise) return loadPromise;
  loadPromise = (async () => {
    await Tone.start();
    piano = new Tone.Sampler({
      urls: PIANO_URLS,
      baseUrl: 'https://tonejs.github.io/audio/salamander/',
      release: 1,
    }).toDestination();
    piano.volume.value = -4;
    bass = new Tone.MonoSynth({
      oscillator: { type: 'sine' },
      envelope: { attack: 0.005, decay: 0.25, sustain: 0.2, release: 0.5 },
      filter: { Q: 1, type: 'lowpass', rolloff: -24 },
      filterEnvelope: {
        attack: 0.01,
        decay: 0.3,
        sustain: 0.1,
        release: 0.5,
        baseFrequency: 80,
        octaves: 2.5,
      },
    }).toDestination();
    bass.volume.value = -10;
    await Tone.loaded();
  })();
  return loadPromise;
}

// Translate a VexFlow-style pitch ("eb/4") to Tone's pitch format ("Eb4").
function toTonePitch(p: string): string {
  const [letter, oct] = p.split('/');
  return letter[0].toUpperCase() + letter.slice(1) + oct;
}

// 16th-step duration -> Tone notation string. Decomposes non-standard lengths
// into a seconds value so anything within a bar plays cleanly.
function stepDurToTone(steps: number, bpm: number): number {
  // seconds per sixteenth = (60 / bpm) / 4
  return (steps * 60) / (bpm * 4);
}

// 16th-step onset -> bar:beat:sixteenth string for Transport scheduling.
function stepToBBS(step: number): string {
  const bar = Math.floor(step / 16);
  const beat = Math.floor((step % 16) / 4);
  const sx = step % 4;
  return `${bar}:${beat}:${sx}`;
}

// Schedule all notes/chords onto Tone.Transport. The tierGetter is called
// fresh inside each scheduled callback, so slider changes are picked up at
// the next note onset.
export function setupSong(song: Song, tierGetter: () => Tier): void {
  getTier = tierGetter;
  const transport = Tone.getTransport();
  // Clear any previously scheduled events from a prior setupSong call.
  for (const id of scheduled) transport.clear(id);
  scheduled = [];

  transport.bpm.value = song.bpm;
  transport.loop = true;
  transport.loopStart = 0;
  transport.loopEnd = `${song.bars}m`;

  for (const n of song.notes) {
    const onset = stepToBBS(n.step);
    const dur = stepDurToTone(n.dur, song.bpm);
    const id = transport.schedule((time) => {
      if (n.tier !== getTier()) return;
      const pitch = toTonePitch(n.pitch);
      if (n.voice === 'bass') {
        bass?.triggerAttackRelease(pitch, dur, time);
      } else {
        piano?.triggerAttackRelease(pitch, dur, time, 0.75);
      }
    }, onset);
    scheduled.push(id);
  }

  for (const c of song.chords) {
    const onset = stepToBBS(c.step);
    const dur = stepDurToTone(c.dur, song.bpm);
    const id = transport.schedule((time) => {
      if (c.tier !== getTier()) return;
      const pitches = c.pitches.map(toTonePitch);
      piano?.triggerAttackRelease(pitches, dur, time, 0.4);
    }, onset);
    scheduled.push(id);
  }
}

export function play(): void {
  Tone.getTransport().start();
}

export function pause(): void {
  Tone.getTransport().pause();
}

export function stop(): void {
  const transport = Tone.getTransport();
  transport.stop();
  transport.position = 0;
}

export function isPlaying(): boolean {
  return Tone.getTransport().state === 'started';
}
