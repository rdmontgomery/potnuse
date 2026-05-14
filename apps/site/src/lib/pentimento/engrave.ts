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

// Layout constants. The grand staff renders as 4-bar systems stacked
// vertically. VexFlow draws in pixel coords; CSS scales the wrapping div.
const BARS_PER_SYSTEM = 4;
const BAR_WIDTH = 170;
const CLEF_WIDTH = 70;
const SYSTEM_HEIGHT = 200;
const PAD_X = 16;
const PAD_Y = 24;
const BASS_OFFSET = 90;

// Paper-style ink. Solid is near-black with a warm tint; ghost is the same
// at low alpha, drawn underneath the active tier so the next layer of
// complexity is faintly visible — the pentimento.
const SOLID_INK = '#1f1408';
const GHOST_INK = 'rgba(31, 20, 8, 0.22)';

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
}

// Build the tickables for one bar's voice, plus the beam groups. Eighth and
// sixteenth notes get beamed when they share a beat (avoids cross-beat beams
// that read badly).
function buildBarMaterial(
  notes: PNote[],
  barStart: number,
  clef: 'treble' | 'bass',
): BarMaterial {
  const sorted = [...notes].sort((a, b) => a.step - b.step);
  const tickables: StaveNote[] = [];
  const positions: number[] = [];
  let pos = 0;

  const push = (pitch: string | null, steps: number) => {
    for (const s of decompose(steps)) {
      const code = DUR_CODE[s];
      const isRest = pitch === null;
      const keys = isRest ? [clef === 'treble' ? 'b/4' : 'd/3'] : [pitch];
      tickables.push(
        new StaveNote({ keys, duration: isRest ? code + 'r' : code, clef }),
      );
      positions.push(pos);
      pos += s;
    }
  };

  for (const n of sorted) {
    const offset = n.step - barStart;
    if (offset > pos) push(null, offset - pos);
    push(n.pitch, n.dur);
  }
  if (pos < 16) push(null, 16 - pos);

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

  return { tickables, beams };
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

interface DrawContext {
  ctx: ReturnType<Renderer['getContext']>;
  song: Song;
  systems: number;
}

// Draw a single tier — staves and notes — into the active VexFlow context.
// `drawStaff` flag controls whether the staff lines/clefs/timesigs are drawn;
// the ghost pass sets it false so it doesn't double up the lines that the
// solid pass will draw on top.
function drawTier(
  dc: DrawContext,
  tier: Tier,
  drawStaff: boolean,
  collectLayout: boolean,
): BarLayout[] {
  const { ctx, song, systems } = dc;
  const layout: BarLayout[] = [];

  for (let s = 0; s < systems; s++) {
    const yTop = PAD_Y + s * SYSTEM_HEIGHT;
    const yTreble = yTop;
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

      if (drawStaff) {
        treble.setContext(ctx).draw();
        bass.setContext(ctx).draw();
      } else {
        // Voices need the stave bound to a context for measurement, even if we
        // don't paint the staff lines.
        treble.setContext(ctx);
        bass.setContext(ctx);
      }

      const barStart = barIndex * 16;
      const leadNotes = song.notes.filter(
        (n) => n.voice === 'lead' && n.tier === tier && n.step >= barStart && n.step < barStart + 16,
      );
      const bassNotes = song.notes.filter(
        (n) => n.voice === 'bass' && n.tier === tier && n.step >= barStart && n.step < barStart + 16,
      );

      const trebleMat = buildBarMaterial(leadNotes, barStart, 'treble');
      const bassMat = buildBarMaterial(bassNotes, barStart, 'bass');

      const trebleVoice = new Voice({ numBeats: 4, beatValue: 4 });
      trebleVoice.addTickables(trebleMat.tickables);
      const bassVoice = new Voice({ numBeats: 4, beatValue: 4 });
      bassVoice.addTickables(bassMat.tickables);

      Accidental.applyAccidentals([trebleVoice], 'C');
      Accidental.applyAccidentals([bassVoice], 'C');

      const formatter = new Formatter();
      formatter.joinVoices([trebleVoice]).format([trebleVoice], w - 30);
      formatter.joinVoices([bassVoice]).format([bassVoice], w - 30);

      trebleVoice.draw(ctx, treble);
      bassVoice.draw(ctx, bass);
      for (const beam of trebleMat.beams) beam.setContext(ctx).draw();
      for (const beam of bassMat.beams) beam.setContext(ctx).draw();

      if (collectLayout) {
        layout.push({
          bar: barIndex,
          notesX: treble.getNoteStartX(),
          notesWidth: treble.getNoteEndX() - treble.getNoteStartX(),
          yTop: treble.getYForLine(0) - 4,
          yBottom: bass.getYForLine(4) + 4,
        });
      }

      if (isSystemStart) {
        firstTreble = treble;
        firstBass = bass;
      }
      lastTreble = treble;
      lastBass = bass;

      x += w;
    }

    if (drawStaff && firstTreble && firstBass) {
      new StaveConnector(firstTreble, firstBass).setType('brace').setContext(ctx).draw();
      new StaveConnector(firstTreble, firstBass).setType('singleLeft').setContext(ctx).draw();
    }
    if (drawStaff && lastTreble && lastBass) {
      new StaveConnector(lastTreble, lastBass).setType('singleRight').setContext(ctx).draw();
    }
  }

  return layout;
}

// Engrave the active tier into the container. If `showGhosts` and a higher
// tier exists, that tier renders first in pale ink so its extra notes peek
// through underneath — the pentimento.
export function engrave(
  container: HTMLDivElement,
  song: Song,
  tier: Tier,
  options?: { showGhosts?: boolean },
): EngraveResult {
  container.innerHTML = '';
  const showGhosts = options?.showGhosts ?? true;
  const numTiers = song.tierLabels.length;

  const systems = Math.ceil(song.bars / BARS_PER_SYSTEM);
  const systemWidth = CLEF_WIDTH + BARS_PER_SYSTEM * BAR_WIDTH;
  const width = PAD_X * 2 + systemWidth;
  const height = PAD_Y * 2 + systems * SYSTEM_HEIGHT;

  const renderer = new Renderer(container, Renderer.Backends.SVG);
  renderer.resize(width, height);
  const ctx = renderer.getContext();
  const dc: DrawContext = { ctx, song, systems };

  // Ghost pass: render tier+1's notes in pale ink, with no staff lines so the
  // solid pass's lines don't double up.
  if (showGhosts && tier + 1 < numTiers) {
    ctx.setFillStyle(GHOST_INK);
    ctx.setStrokeStyle(GHOST_INK);
    drawTier(dc, tier + 1, false, false);
  }

  // Solid pass: full staff + active-tier notes in dark ink, on top of any
  // ghost notes that peeked through.
  ctx.setFillStyle(SOLID_INK);
  ctx.setStrokeStyle(SOLID_INK);
  const layout = drawTier(dc, tier, true, true);

  const svg = container.querySelector('svg');
  return { width, height, bars: layout, svg: svg as SVGSVGElement | null };
}
