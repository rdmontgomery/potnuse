import {
  Renderer,
  Stave,
  StaveNote,
  Voice,
  Formatter,
  Accidental,
  Annotation,
  StaveConnector,
  Beam,
} from 'vexflow';
import type { Song, PNote, Tier } from './types';

// Layout constants. The grand staff renders as 4-bar systems stacked
// vertically. VexFlow draws in pixel coords; CSS scales the wrapping div.
// Compact mode shrinks every dimension so the staff fits in the curriculum
// spine column. Same engraver, two scales.
const FULL_LAYOUT = {
  barsPerSystem: 4,
  barWidth: 170,
  clefWidth: 70,
  systemHeight: 200,
  // VexFlow's brace + clef glyphs extend ~18px to the left of the stave's
  // start x, so padX has to clear that or the leftmost system gets sliced
  // by the SVG's left edge.
  padX: 26,
  padY: 24,
  bassOffset: 90,
  formatPad: 30,
} as const;

const COMPACT_LAYOUT = {
  barsPerSystem: 4,
  barWidth: 62,
  clefWidth: 30,
  systemHeight: 110,
  padX: 20,
  padY: 8,
  bassOffset: 50,
  formatPad: 14,
} as const;

const SOLID_INK = '#1f1408';

// Duration: sixteenth-note steps -> VexFlow duration code.
const DUR_CODE: Record<number, string> = {
  16: 'w',
  8: 'h',
  4: 'q',
  2: '8',
  1: '16',
};

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

interface BarMaterial {
  tickables: StaveNote[];
  beams: Beam[];
  // For each tickable, the PNote it came from — or null if the tickable is a
  // rest or part of a decomposed continuation. The first tickable of a multi-
  // unit decomposition carries the source note; later tickables carry null,
  // so that an annotator only labels the head of each logical note.
  sources: (PNote | null)[];
}

// Build tickables for one bar's voice, plus beam groups. Eighths and
// sixteenths beam together when they share a beat; beams break at beat lines.
function buildBarMaterial(
  notes: PNote[],
  barStart: number,
  clef: 'treble' | 'bass',
): BarMaterial {
  const sorted = [...notes].sort((a, b) => a.step - b.step);
  const tickables: StaveNote[] = [];
  const positions: number[] = [];
  const sources: (PNote | null)[] = [];
  let pos = 0;

  const pushUnit = (pitch: string | null, steps: number, source: PNote | null) => {
    let isHead = source !== null;
    for (const s of decompose(steps)) {
      const code = DUR_CODE[s];
      const isRest = pitch === null;
      const keys = isRest ? [clef === 'treble' ? 'b/4' : 'd/3'] : [pitch];
      tickables.push(
        new StaveNote({ keys, duration: isRest ? code + 'r' : code, clef }),
      );
      positions.push(pos);
      sources.push(isHead ? source : null);
      pos += s;
      isHead = false;
    }
  };

  for (const n of sorted) {
    const offset = n.step - barStart;
    if (offset > pos) pushUnit(null, offset - pos, null);
    pushUnit(n.pitch, n.dur, n);
  }
  if (pos < 16) pushUnit(null, 16 - pos, null);

  const beams: Beam[] = [];
  let group: StaveNote[] = [];
  let groupBeat = -1;
  const flush = () => {
    if (group.length >= 2) beams.push(new Beam(group));
    group = [];
  };
  for (let i = 0; i < tickables.length; i++) {
    const t = tickables[i];
    const d = t.getDuration();
    const beamable = !t.isRest() && (d === '8' || d === '16');
    const beat = Math.floor(positions[i] / 4);
    if (beamable) {
      if (beat !== groupBeat) {
        flush();
        groupBeat = beat;
      }
      group.push(t);
    } else {
      flush();
      groupBeat = -1;
    }
  }
  flush();

  return { tickables, beams, sources };
}

export interface BarLayout {
  bar: number;
  notesX: number;
  notesWidth: number;
  yTop: number;
  yBottom: number;
}

export interface EngraveResult {
  width: number;
  height: number;
  bars: BarLayout[];
  svg: SVGSVGElement | null;
}

export interface EngraveOptions {
  tier: Tier;
  // Render at the smaller, spine-friendly scale.
  compact?: boolean;
  // Only render a window of bars instead of the full song. Bars outside the
  // window aren't drawn, but the song's note onsets are still keyed off the
  // bar index, so this is purely a viewport.
  window?: { start: number; count: number };
  // Per-note label printed above the staff. Returning null or undefined
  // skips the annotation for that note. Only the first tickable of each
  // logical PNote is annotated, so multi-unit notes (whole = h + h, etc.)
  // get one label, not several.
  noteAnnotator?: (n: PNote) => string | null | undefined;
  // Key signature for the staff. Drawn on the first system, and passed to
  // Accidental.applyAccidentals so notes already in the key drop their
  // accidentals. Defaults to 'C' which renders every accidental explicitly.
  // Use VexFlow key names: 'C', 'G', 'D', 'A', 'E', 'B', 'F#', 'C#',
  // 'F', 'Bb', 'Eb', 'Ab', 'Db', 'Gb', 'Cb'.
  keySig?: string;
}

// Engrave the active tier into the container. Single-pass: dark ink, full
// grand staff, beams, brace + system barlines. Compact + windowed when the
// curriculum spine asks for it.
export function engrave(
  container: HTMLDivElement,
  song: Song,
  options: EngraveOptions,
): EngraveResult {
  container.innerHTML = '';

  const { tier } = options;
  const keySig = options.keySig ?? 'C';
  const L = options.compact ? COMPACT_LAYOUT : FULL_LAYOUT;

  const windowStart = options.window?.start ?? 0;
  const windowCount = options.window?.count ?? song.bars;
  const lastBar = Math.min(song.bars, windowStart + windowCount);
  const visibleBars = Math.max(0, lastBar - windowStart);

  const systems = Math.ceil(visibleBars / L.barsPerSystem);
  const systemWidth = L.clefWidth + L.barsPerSystem * L.barWidth;
  const width = L.padX * 2 + systemWidth;
  const height = L.padY * 2 + systems * L.systemHeight;

  const renderer = new Renderer(container, Renderer.Backends.SVG);
  renderer.resize(width, height);
  const ctx = renderer.getContext();
  ctx.setFillStyle(SOLID_INK);
  ctx.setStrokeStyle(SOLID_INK);

  const layout: BarLayout[] = [];

  for (let s = 0; s < systems; s++) {
    const yTop = L.padY + s * L.systemHeight;
    const yBass = yTop + L.bassOffset;

    let x = L.padX;
    let firstTreble: Stave | null = null;
    let firstBass: Stave | null = null;
    let lastTreble: Stave | null = null;
    let lastBass: Stave | null = null;

    for (let b = 0; b < L.barsPerSystem; b++) {
      const barIndex = windowStart + s * L.barsPerSystem + b;
      if (barIndex >= lastBar) break;

      const isSystemStart = b === 0;
      const w = isSystemStart ? L.barWidth + L.clefWidth : L.barWidth;

      const treble = new Stave(x, yTop, w);
      const bass = new Stave(x, yBass, w);
      if (isSystemStart) {
        treble.addClef('treble');
        bass.addClef('bass');
        if (keySig !== 'C') {
          treble.addKeySignature(keySig);
          bass.addKeySignature(keySig);
        }
        if (s === 0) {
          treble.addTimeSignature('4/4');
          bass.addTimeSignature('4/4');
        }
      }

      treble.setContext(ctx).draw();
      bass.setContext(ctx).draw();

      const barStart = barIndex * 16;
      const leadNotes = song.notes.filter(
        (n) => n.voice === 'lead' && n.tier === tier && n.step >= barStart && n.step < barStart + 16,
      );
      const bassNotes = song.notes.filter(
        (n) => n.voice === 'bass' && n.tier === tier && n.step >= barStart && n.step < barStart + 16,
      );

      const trebleMat = buildBarMaterial(leadNotes, barStart, 'treble');
      const bassMat = buildBarMaterial(bassNotes, barStart, 'bass');

      if (options.noteAnnotator) {
        for (const mat of [trebleMat, bassMat]) {
          for (let i = 0; i < mat.tickables.length; i++) {
            const src = mat.sources[i];
            if (!src) continue;
            const label = options.noteAnnotator(src);
            if (label == null) continue;
            const ann = new Annotation(label).setVerticalJustification(
              Annotation.VerticalJustify.TOP,
            );
            mat.tickables[i].addModifier(ann, 0);
          }
        }
      }

      const trebleVoice = new Voice({ numBeats: 4, beatValue: 4 });
      trebleVoice.addTickables(trebleMat.tickables);
      const bassVoice = new Voice({ numBeats: 4, beatValue: 4 });
      bassVoice.addTickables(bassMat.tickables);

      Accidental.applyAccidentals([trebleVoice], keySig);
      Accidental.applyAccidentals([bassVoice], keySig);

      const formatter = new Formatter();
      formatter.joinVoices([trebleVoice]).format([trebleVoice], w - L.formatPad);
      formatter.joinVoices([bassVoice]).format([bassVoice], w - L.formatPad);

      trebleVoice.draw(ctx, treble);
      bassVoice.draw(ctx, bass);
      for (const beam of trebleMat.beams) beam.setContext(ctx).draw();
      for (const beam of bassMat.beams) beam.setContext(ctx).draw();

      layout.push({
        bar: barIndex,
        notesX: treble.getNoteStartX(),
        notesWidth: treble.getNoteEndX() - treble.getNoteStartX(),
        yTop: treble.getYForLine(0) - 4,
        yBottom: bass.getYForLine(4) + 4,
      });

      if (isSystemStart) {
        firstTreble = treble;
        firstBass = bass;
      }
      lastTreble = treble;
      lastBass = bass;

      x += w;
    }

    if (firstTreble && firstBass) {
      new StaveConnector(firstTreble, firstBass).setType('brace').setContext(ctx).draw();
      new StaveConnector(firstTreble, firstBass).setType('singleLeft').setContext(ctx).draw();
    }
    if (lastTreble && lastBass) {
      new StaveConnector(lastTreble, lastBass).setType('singleRight').setContext(ctx).draw();
    }
  }

  const svg = container.querySelector('svg');
  return { width, height, bars: layout, svg: svg as SVGSVGElement | null };
}
