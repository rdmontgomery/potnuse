import * as Tone from 'tone';

// Shared piano sampler for curriculum modules. One Salamander sampler
// instance lives for the page's lifetime; the first call to getPiano()
// resolves Tone.start() (which has to run inside a user gesture) and
// loads the sample bank. Subsequent calls hand back the same instance.
//
// The existing /experiments/pentimento page has its own private sampler
// in lib/pentimento/audio.ts; that singleton is bound to its Transport
// scheduling and is intentionally left alone. Module 0 — and the modules
// after it that just want a one-shot phrase — can reach for this one
// instead of dragging Transport into their world.

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

let _piano: Tone.Sampler | null = null;
let _pianoPromise: Promise<Tone.Sampler> | null = null;

export async function getPiano(): Promise<Tone.Sampler> {
  if (_piano) return _piano;
  if (_pianoPromise) return _pianoPromise;
  _pianoPromise = (async () => {
    await Tone.start();
    const sampler = new Tone.Sampler({
      urls: PIANO_URLS,
      baseUrl: 'https://tonejs.github.io/audio/salamander/',
      release: 1,
    }).toDestination();
    sampler.volume.value = -6;
    await Tone.loaded();
    _piano = sampler;
    return sampler;
  })();
  return _pianoPromise;
}

// VexFlow-style "eb/4" -> Tone-style "Eb4". Tone accepts standard pitch
// strings with case-sensitive letter + accidental.
export function toTonePitch(vex: string): string {
  const [head, oct] = vex.split('/');
  return head[0].toUpperCase() + head.slice(1) + oct;
}

// Sixteenth-step duration -> seconds at the given bpm.
export function stepsToSeconds(steps: number, bpm: number): number {
  return (steps * 60) / (bpm * 4);
}
