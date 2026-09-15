import { useEffect, useRef, useState } from 'react';
import { PITCH_NAMES, mod12 } from '@/lib/music/pitchClass';
import { getPiano } from '@/lib/music/audio';
import { takeOver } from '@/lib/music/audioBus';

// Operate for Module 6. Four pre-baked progressions sit side by side
// so the listener can A/B the diatonic reference against versions that
// insert a secondary dominant or a borrowed chord. The point is
// audible: chromatic chords add a momentary other-key gravity before
// the diatonic resolution catches it.

interface Chord {
  label: string;
  midi: number[];
}

interface Progression {
  id: string;
  label: string;
  chords: Chord[];
  caption: string;
}

const PROGRESSIONS: Progression[] = [
  {
    id: 'diatonic',
    label: 'pure diatonic — I IV V I',
    chords: [
      { label: 'I', midi: [60, 64, 67] },
      { label: 'IV', midi: [65, 69, 72] },
      { label: 'V', midi: [67, 71, 74] },
      { label: 'I', midi: [60, 64, 67] },
    ],
    caption:
      'The diatonic reference. No chromatic notes; nothing leans outside the key.',
  },
  {
    id: 'sec-dom-v',
    label: 'with V/V — I V/V V I',
    chords: [
      { label: 'I', midi: [60, 64, 67] },
      { label: 'V/V', midi: [62, 66, 69] }, // D F# A
      { label: 'V', midi: [67, 71, 74] },
      { label: 'I', midi: [60, 64, 67] },
    ],
    caption:
      'V/V tonicizes V. The F♯ pulls toward G; V catches the fall and resolves I.',
  },
  {
    id: 'mixture-bVI',
    label: 'with ♭VI mixture — I IV ♭VI V',
    chords: [
      { label: 'I', midi: [60, 64, 67] },
      { label: 'IV', midi: [65, 69, 72] },
      { label: '♭VI', midi: [68, 72, 75] }, // Ab C Eb
      { label: 'V', midi: [67, 71, 74] },
    ],
    caption:
      'A♭ major borrowed from C minor — a sudden drop in color, then V re-asserts the major key.',
  },
  {
    id: 'sec-dom-vi',
    label: 'with V/vi — I V/vi vi V',
    chords: [
      { label: 'I', midi: [60, 64, 67] },
      { label: 'V/vi', midi: [64, 68, 71] }, // E G# B
      { label: 'vi', midi: [69, 72, 76] }, // A C E
      { label: 'V', midi: [67, 71, 74] },
    ],
    caption:
      'E major tonicizes vi. The G♯ is a leading-tone to A — borrowed from outside the key for one chord only.',
  },
];

const CHORD_S = 1.1;
const GAP_MS = 80;

function midiToTonePitch(midi: number): string {
  const pc = mod12(midi);
  const octave = Math.floor(midi / 12) - 1;
  return `${PITCH_NAMES[pc]}${octave}`;
}

export default function Module6Operate() {
  const [progId, setProgId] = useState(PROGRESSIONS[0].id);
  const [busy, setBusy] = useState(false);
  const [activeIndex, setActiveIndex] = useState<number | null>(null);
  const timersRef = useRef<number[]>([]);
  const busHandleRef = useRef<(() => void) | null>(null);

  const cancelTimers = () => {
    for (const t of timersRef.current) window.clearTimeout(t);
    timersRef.current = [];
  };

  useEffect(() => {
    return () => {
      busHandleRef.current?.();
      busHandleRef.current = null;
      cancelTimers();
    };
  }, []);

  const prog = PROGRESSIONS.find((p) => p.id === progId) ?? PROGRESSIONS[0];

  const play = async () => {
    if (busy) return;
    cancelTimers();
    setBusy(true);
    setActiveIndex(null);
    busHandleRef.current = takeOver(
      () => cancelTimers(),
      () => {
        setActiveIndex(null);
        setBusy(false);
      },
    );

    let piano;
    try {
      piano = await getPiano();
    } catch (err) {
      console.error('m6 operate load failed', err);
      setBusy(false);
      return;
    }

    const stepMs = CHORD_S * 1000 + GAP_MS;
    for (let i = 0; i < prog.chords.length; i++) {
      const slotIndex = i;
      const t = window.setTimeout(() => {
        const pitches = prog.chords[slotIndex].midi.map(midiToTonePitch);
        piano!.triggerAttackRelease(pitches, CHORD_S, undefined, 0.75);
        setActiveIndex(slotIndex);
      }, i * stepMs);
      timersRef.current.push(t);
    }
    const finalT = window.setTimeout(() => {
      busHandleRef.current?.();
      busHandleRef.current = null;
      setActiveIndex(null);
      setBusy(false);
    }, prog.chords.length * stepMs);
    timersRef.current.push(finalT);
  };

  return (
    <div className="m6-operate">
      <div className="m6-prog-picker">
        {PROGRESSIONS.map((p) => (
          <button
            key={p.id}
            type="button"
            className={p.id === progId ? 'm6-prog-btn active' : 'm6-prog-btn'}
            onClick={() => {
              if (busy) return;
              setProgId(p.id);
            }}
            disabled={busy}
          >
            {p.label}
          </button>
        ))}
      </div>

      <div className="m6-prog-display">
        {prog.chords.map((c, i) => (
          <div
            key={i}
            className={`m6-prog-step ${i === activeIndex ? 'ringing' : ''}`}
          >
            <span className="m6-prog-roman">{c.label}</span>
          </div>
        ))}
      </div>

      <button
        type="button"
        className="m6-operate-play"
        onClick={() => void play()}
        disabled={busy}
      >
        {busy ? 'playing…' : 'play'}
      </button>

      <p className="m6-operate-caption">{prog.caption}</p>
    </div>
  );
}
