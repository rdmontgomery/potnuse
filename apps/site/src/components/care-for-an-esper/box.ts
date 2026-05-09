// Adaptive ASCII box renderer.
// Returns an array of lines (no trailing newline) at exactly `cols` width.
// The box owns the box-drawing characters; callers pass plain content.

const TOP = (cols: number) => '╔' + '═'.repeat(cols - 2) + '╗';
const BOT = (cols: number) => '╚' + '═'.repeat(cols - 2) + '╝';
const SEP = (cols: number) => '╠' + '═'.repeat(cols - 2) + '╣';

function padLeft(line: string, inner: number): string {
  if (line.length >= inner) return line.slice(0, inner);
  return line + ' '.repeat(inner - line.length);
}

function padCenter(line: string, inner: number): string {
  if (line.length >= inner) return line.slice(0, inner);
  const total = inner - line.length;
  const left = Math.floor(total / 2);
  const right = total - left;
  return ' '.repeat(left) + line + ' '.repeat(right);
}

// Word-wrap to a fixed character width, preserving paragraph breaks ('').
function wrap(text: string, width: number): string[] {
  const out: string[] = [];
  for (const para of text.split('\n')) {
    if (para === '') {
      out.push('');
      continue;
    }
    const words = para.split(/\s+/);
    let line = '';
    for (const w of words) {
      if (!line.length) {
        line = w;
        continue;
      }
      if (line.length + 1 + w.length <= width) {
        line += ' ' + w;
      } else {
        out.push(line);
        line = w;
      }
    }
    if (line.length) out.push(line);
  }
  return out;
}

export type DialogueRender = {
  lines: string[];
  cols: number;
};

export function renderDialogue(
  label: string | null,
  body: string,
  cols: number,
  align: 'left' | 'center' = 'left',
): DialogueRender {
  const inner = cols - 4; // "║ " + content + " ║"
  const pad = align === 'center' ? padCenter : padLeft;
  const lines: string[] = [TOP(cols)];
  if (label) {
    // Labels (speaker name) always left-aligned regardless of body align.
    lines.push('║ ' + padLeft(label, inner) + ' ║');
    lines.push(SEP(cols));
  }
  for (const w of wrap(body, inner)) {
    lines.push('║ ' + pad(w, inner) + ' ║');
  }
  lines.push(BOT(cols));
  return { lines, cols };
}
