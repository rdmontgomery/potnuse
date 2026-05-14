import {
  Renderer,
  Stave,
  StaveNote,
  Voice,
  Formatter,
  Accidental,
  StaveConnector,
  Beam,
} from 'vexflow';
import type { Song, PNote, Tier } from './types';

// Layout constants. The grand staff is rendered as a series of 4-bar systems
// stacked vertically. VexFlow draws in pixel coords; the SVG is wrapped in a
// container that we scale via CSS.
const BARS_PER_SYSTEM = 4;
const BAR_WIDTH = 170;
const CLEF_WIDTH = 70;
const SYSTEM_HEIGHT = 200;
const PAD_X = 16;
const PAD_Y = 24;
const TREBLE_OFFSET = 0;
const BASS_OFFSET = 90;

// Duration: sixteenth-note steps -> VexFlow duration code.
const DUR_CODE: Record<number, string> = {
  16: 'w',
  8: 'h',
  4: 'q',
  2: '8',
  1: '16',
};

// Decompose an arbitrary sixteenth-step duration into a sequence of legal
// note/rest durations using a greedy largest-first walk. Returns the list of
// sixteenth-step lengths to emit in order.
function decompose(sixteenths: number): number[] {
  const out: number[] = [];
  let remaining = sixteenths;
  const units = [16, 8, 4, 2, 1];
  while (remaining > 0) {
    const u = units.find((n) => n <= remaining);
    if (u === undefined) break;
    out.push(u);
    remaining -= u;
  }
  return out;
}

// Determine the stave a note belongs to, by pitch register. Bass voice always
// goes on the bass stave; lead voice goes on the treble stave.
function staveFor(voice: 'bass' | 'lead'): 'treble' | 'bass' {
  return voice === 'bass' ? 'bass' : 'treble';
}

// Build the tickables for a single bar's voice. Fills gaps with rests so the
// voice satisfies VexFlow's strict-tick requirement.
function buildBarTickables(
  notes: PNote[],
  barStart: number,
  clef: 'treble' | 'bass',
): StaveNote[] {
  const sorted = [...notes].sort((a, b) => a.step - b.step);
  const out: StaveNote[] = [];
  let pos = 0;

  const pushRest = (steps: number) => {
    for (const s of decompose(steps)) {
      const code = DUR_CODE[s];
      // Rest keys: middle-line rests look right on both clefs.
      const restKey = clef === 'treble' ? 'b/4' : 'd/3';
      out.push(new StaveNote({ keys: [restKey], duration: code + 'r', clef }));
    }
  };

  const pushNote = (pitch: string, steps: number) => {
    for (const s of decompose(steps)) {
      const code = DUR_CODE[s];
      out.push(new StaveNote({ keys: [pitch], duration: code, clef }));
    }
  };

  for (const n of sorted) {
    const offset = n.step - barStart;
    if (offset > pos) pushRest(offset - pos);
    pushNote(n.pitch, n.dur);
    pos = offset + n.dur;
  }
  if (pos < 16) pushRest(16 - pos);
  return out;
}

// Group notes that should be beamed together. We beam consecutive eighths or
// sixteenths within a beat (4 sixteenths). Notes spanning beat boundaries break
// the beam group.
function autoBeam(notes: StaveNote[]): Beam[] {
  const beams: Beam[] = [];
  let group: StaveNote[] = [];
  const flush = () => {
    if (group.length >= 2) beams.push(new Beam(group));
    group = [];
  };
  for (const n of notes) {
    const d = n.getDuration();
    if (d === '8' || d === '16') {
      group.push(n);
    } else {
      flush();
    }
  }
  flush();
  return beams;
}

export interface EngraveResult {
  width: number;
  height: number;
}

// Engrave the active tier of the song into the container element. Clears any
// prior contents.
export function engrave(
  container: HTMLDivElement,
  song: Song,
  tier: Tier,
): EngraveResult {
  // Clean slate every call — re-engraves when the tier changes.
  container.innerHTML = '';

  const systems = Math.ceil(song.bars / BARS_PER_SYSTEM);
  const systemWidth = CLEF_WIDTH + BARS_PER_SYSTEM * BAR_WIDTH;
  const width = PAD_X * 2 + systemWidth;
  const height = PAD_Y * 2 + systems * SYSTEM_HEIGHT;

  const renderer = new Renderer(container, Renderer.Backends.SVG);
  renderer.resize(width, height);
  const ctx = renderer.getContext();
  // Paint with the site's foreground color. VexFlow doesn't pull from CSS vars,
  // so we read the computed color from the container.
  const inkColor =
    getComputedStyle(container).getPropertyValue('color').trim() || '#f0e6d2';
  ctx.setStrokeStyle(inkColor);
  ctx.setFillStyle(inkColor);

  for (let s = 0; s < systems; s++) {
    const yTop = PAD_Y + s * SYSTEM_HEIGHT;
    const yTreble = yTop + TREBLE_OFFSET;
    const yBass = yTop + BASS_OFFSET;

    let x = PAD_X;
    let firstTreble: Stave | null = null;
    let firstBass: Stave | null = null;
    let lastTreble: Stave | null = null;
    let lastBass: Stave | null = null;

    for (let b = 0; b < BARS_PER_SYSTEM; b++) {
      const barIndex = s * BARS_PER_SYSTEM + b;
      if (barIndex >= song.bars) break;

      const isSystemStart = b === 0;
      const w = isSystemStart ? BAR_WIDTH + CLEF_WIDTH : BAR_WIDTH;

      const treble = new Stave(x, yTreble, w);
      const bass = new Stave(x, yBass, w);
      if (isSystemStart) {
        treble.addClef('treble');
        bass.addClef('bass');
        if (s === 0) {
          treble.addTimeSignature('4/4');
          bass.addTimeSignature('4/4');
        }
      }

      treble.setContext(ctx).draw();
      bass.setContext(ctx).draw();

      const barStart = barIndex * 16;
      const leadNotesInBar = song.notes.filter(
        (n) => n.voice === 'lead' && n.tier === tier && n.step >= barStart && n.step < barStart + 16,
      );
      const bassNotesInBar = song.notes.filter(
        (n) => n.voice === 'bass' && n.tier === tier && n.step >= barStart && n.step < barStart + 16,
      );

      const trebleTickables = buildBarTickables(leadNotesInBar, barStart, 'treble');
      const bassTickables = buildBarTickables(bassNotesInBar, barStart, 'bass');

      const trebleVoice = new Voice({ numBeats: 4, beatValue: 4 });
      trebleVoice.addTickables(trebleTickables);
      const bassVoice = new Voice({ numBeats: 4, beatValue: 4 });
      bassVoice.addTickables(bassTickables);

      Accidental.applyAccidentals([trebleVoice], 'C');
      Accidental.applyAccidentals([bassVoice], 'C');

      const formatter = new Formatter();
      formatter.joinVoices([trebleVoice]).format([trebleVoice], w - 30);
      formatter.joinVoices([bassVoice]).format([bassVoice], w - 30);

      const trebleBeams = autoBeam(trebleTickables);
      const bassBeams = autoBeam(bassTickables);

      trebleVoice.draw(ctx, treble);
      bassVoice.draw(ctx, bass);
      for (const beam of trebleBeams) beam.setContext(ctx).draw();
      for (const beam of bassBeams) beam.setContext(ctx).draw();

      if (isSystemStart) {
        firstTreble = treble;
        firstBass = bass;
      }
      lastTreble = treble;
      lastBass = bass;

      x += w;
    }

    if (firstTreble && firstBass) {
      new StaveConnector(firstTreble, firstBass)
        .setType('brace')
        .setContext(ctx)
        .draw();
      new StaveConnector(firstTreble, firstBass)
        .setType('singleLeft')
        .setContext(ctx)
        .draw();
    }
    if (lastTreble && lastBass) {
      new StaveConnector(lastTreble, lastBass)
        .setType('singleRight')
        .setContext(ctx)
        .draw();
    }
  }

  return { width, height };
}
