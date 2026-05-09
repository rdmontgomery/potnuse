// Pixel-art sprite definitions used by the image-sprite experiments
// (12–15). Each sprite is a 14×14 grid expressed as one character per
// cell against a small palette. These are original drawings in the
// 16-bit-era pixel-art vocabulary — not reproductions of any
// trademarked character design.
//
// To swap in real ripped sprites, drop a PNG at
//   apps/site/public/sprites/<name>.png
// and use <img src="/sprites/<name>.png" /> instead of <PixelSpriteSvg>.
// The hooks for that are in the experiment files (search for "DROP-IN").

import { useEffect, useState, type SVGProps } from 'react';

// ─── Palette ──────────────────────────────────────────────────────────

// 1 char → fill. '.' is transparent (no rect drawn).
type Palette = Record<string, string>;

const COMMON: Palette = {
  '.': '',
  W: '#fafaf2', // pompom white
  T: '#d8b88a', // tan body
  C: '#b89370', // tan shadow
  K: '#1c0f02', // ink / outline
  R: '#a14b3a', // moogle wing-rim
  Y: '#f3c93a', // chocobo yellow
  O: '#cf7c20', // chocobo beak
  L: '#8e6b18', // chocobo leg
  G: '#56913f', // cactuar green
  D: '#33621e', // cactuar shadow
  M: '#7d3a3a', // tonberry robe
  S: '#dad6c2', // tonberry knife
  N: '#e6da7a', // moogle horn
};

// ─── Sprite definitions ──────────────────────────────────────────────

export type SpriteFrames = string[][]; // [frame][row]

// Each sprite is 14 columns × 14 rows. Frames swap legs / pompom for a
// walk-cycle. Two-frame cycles are enough to read as walking.

const moogleFrames: SpriteFrames = [
  // Frame 0
  [
    '..............',
    '......WWW.....',
    '.....WWWWW....',
    '.....WWWWW....',
    '......WNW.....',
    '.......N......',
    '....TTTTT.....',
    '...TCTTTCT....',
    '...TKTTTKT....',
    '..RTTTTTTTR...',
    '..RTTTTTTTR...',
    '...CTTTTTC....',
    '....T.T.T.....',
    '....K...K.....',
  ],
  // Frame 1 — pompom bobs, legs swap
  [
    '......WWW.....',
    '.....WWWWW....',
    '......WWW.....',
    '......WNW.....',
    '.......N......',
    '....TTTTT.....',
    '...TCTTTCT....',
    '...TKTTTKT....',
    '..RTTTTTTTR...',
    '..RTTTTTTTR...',
    '...CTTTTTC....',
    '....T.T.T.....',
    '....KK.KK.....',
    '..............',
  ],
];

const chocoboFrames: SpriteFrames = [
  [
    '..............',
    '......YYY.....',
    '.....YYYYY....',
    '.....YYYKY....',
    '....YYYYYY....',
    '..OYYYYYY.....',
    '....YYYYY.....',
    '.....YYYY.....',
    '.....YYYY.....',
    '.....YYYY.....',
    '....YYYYY.....',
    '....LL.LL.....',
    '....L...L.....',
    '..............',
  ],
  [
    '..............',
    '......YYY.....',
    '.....YYYYY....',
    '.....YYYKY....',
    '....YYYYYY....',
    '..OYYYYYY.....',
    '....YYYYY.....',
    '.....YYYY.....',
    '.....YYYY.....',
    '.....YYYY.....',
    '....YYYYY.....',
    '....LL.LL.....',
    '...L.....L....',
    '..............',
  ],
];

const cactuarFrames: SpriteFrames = [
  [
    '......G.......',
    '.....GGG......',
    '.....GGG......',
    '....GKGKG.....',
    '....GGGGG.....',
    '...GGGGGGG....',
    '..GGGGGGGGG...',
    '..GGGGKGGGG...',
    '...GGGGGGG....',
    '....GGGGG.....',
    'G...GGGGG...G.',
    'GG..DGGGD..GG.',
    '....GGGGG.....',
    '.....G.G......',
  ],
  [
    '......G.......',
    '.....GGG......',
    '.....GGG......',
    '....GKGKG.....',
    '....GGGGG.....',
    '...GGGGGGG....',
    '..GGGGGGGGG...',
    '..GGGGKGGGG...',
    '...GGGGGGG....',
    '....GGGGG.....',
    'G...GGGGG...G.',
    'GG..DGGGD..GG.',
    '.....GGG......',
    '....G...G.....',
  ],
];

const tonberryFrames: SpriteFrames = [
  [
    '..............',
    '......MMM.....',
    '.....MMMMM....',
    '.....MKMKM....',
    '....MMMNMMM...',
    '...MMMMMMMM...',
    '..MMMMMMMMMS..',
    '..MMMMMMMMSS..',
    '..MMMMMMMM.S..',
    '..MMMMMMMM....',
    '..MMMMMMMM....',
    '...MM..MM.....',
    '...M....M.....',
    '..............',
  ],
  [
    '..............',
    '......MMM.....',
    '.....MMMMM....',
    '.....MKMKM....',
    '....MMMNMMM...',
    '...MMMMMMMM...',
    '..MMMMMMMMMS..',
    '..MMMMMMMMSS..',
    '..MMMMMMMM.S..',
    '..MMMMMMMM....',
    '..MMMMMMMM....',
    '...MM..MM.....',
    '....MM.M......',
    '..............',
  ],
];

export type PixelSpriteKind = 'moogle' | 'chocobo' | 'cactuar' | 'tonberry';

const SPRITE_DEFS: Record<PixelSpriteKind, SpriteFrames> = {
  moogle: moogleFrames,
  chocobo: chocoboFrames,
  cactuar: cactuarFrames,
  tonberry: tonberryFrames,
};

export const PIXEL_KINDS: PixelSpriteKind[] = [
  'moogle',
  'chocobo',
  'cactuar',
  'tonberry',
];

// ─── Renderer ────────────────────────────────────────────────────────

export function PixelSpriteSvg({
  kind,
  frame = 0,
  scale = 2,
  ...rest
}: {
  kind: PixelSpriteKind;
  frame?: 0 | 1;
  scale?: number;
} & Omit<SVGProps<SVGSVGElement>, 'children'>) {
  const grid = SPRITE_DEFS[kind][frame];
  const rows = grid.length;
  const cols = grid[0].length;
  const w = cols * scale;
  const h = rows * scale;

  const rects: React.ReactNode[] = [];
  for (let y = 0; y < rows; y++) {
    const row = grid[y];
    for (let x = 0; x < cols; x++) {
      const ch = row[x];
      const fill = COMMON[ch];
      if (!fill) continue;
      rects.push(
        <rect
          key={`${y},${x}`}
          x={x * scale}
          y={y * scale}
          width={scale}
          height={scale}
          fill={fill}
        />,
      );
    }
  }

  return (
    <svg
      {...rest}
      width={w}
      height={h}
      viewBox={`0 0 ${w} ${h}`}
      shapeRendering="crispEdges"
    >
      {rects}
    </svg>
  );
}

// ─── Walk cycle hook ─────────────────────────────────────────────────
// Toggles between frame 0 and 1 at a fixed cadence. Slows when held
// (passing `paused`) so a held sprite is visually still.

export function useWalkCycle(stepMs = 220, paused = false) {
  const [frame, setFrame] = useState<0 | 1>(0);
  useEffect(() => {
    if (paused) return;
    const t = window.setInterval(
      () => setFrame((f) => (f === 0 ? 1 : 0)),
      stepMs,
    );
    return () => clearInterval(t);
  }, [stepMs, paused]);
  return frame;
}

// ─── Bitmap export (for canvas blit) ─────────────────────────────────
// Some experiments draw sprites to a canvas via drawImage. This
// produces a per-kind, per-frame ImageBitmap once and caches it.

const bitmapCache = new Map<string, ImageBitmap>();

export async function getSpriteBitmap(
  kind: PixelSpriteKind,
  frame: 0 | 1,
  scale = 2,
): Promise<ImageBitmap> {
  const key = `${kind}:${frame}:${scale}`;
  const cached = bitmapCache.get(key);
  if (cached) return cached;

  const grid = SPRITE_DEFS[kind][frame];
  const rows = grid.length;
  const cols = grid[0].length;
  const off = new OffscreenCanvas(cols * scale, rows * scale);
  const ctx = off.getContext('2d')!;
  for (let y = 0; y < rows; y++) {
    const row = grid[y];
    for (let x = 0; x < cols; x++) {
      const ch = row[x];
      const fill = COMMON[ch];
      if (!fill) continue;
      ctx.fillStyle = fill;
      ctx.fillRect(x * scale, y * scale, scale, scale);
    }
  }
  const bm = await createImageBitmap(off);
  bitmapCache.set(key, bm);
  return bm;
}
