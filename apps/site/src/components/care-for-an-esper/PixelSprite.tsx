// Pixel-art sprites for the wandering layer. Original 14×14
// designs in 16-bit-era pixel-art vocabulary — not reproductions of
// any specific trademarked character. SpriteManager renders them by
// pre-rasterizing to ImageBitmaps in an OffscreenCanvas, then
// drawImage-ing each frame.
//
// Five kinds: the four wanderers (moogle, tonberry, marlboro,
// cactuar) plus chocobo, which is also defined here so the type
// stays exhaustive even though Chocobo.tsx renders the chocobo
// cameo separately.

import type { SpriteKind } from './letters';

const PALETTE: Record<string, string> = {
  '.': '',
  W: '#fafaf2', // pompom white
  T: '#d8b88a', // moogle body
  C: '#b89370', // moogle body shadow
  K: '#1c0f02', // ink / outline
  R: '#a14b3a', // moogle wing-rim
  N: '#e6da7a', // moogle horn
  Y: '#f3c93a', // chocobo yellow
  O: '#cf7c20', // chocobo beak
  L: '#8e6b18', // chocobo leg
  G: '#56913f', // cactuar green
  D: '#33621e', // cactuar shadow
  M: '#7d3a3a', // tonberry robe
  S: '#dad6c2', // tonberry knife
  X: '#5e3a30', // marlboro body
  P: '#7a4a3a', // marlboro highlight
  E: '#7da353', // marlboro mouth interior
};

type Frames = [string[], string[]]; // exactly two frames

const moogle: Frames = [
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

const tonberry: Frames = [
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

const marlboro: Frames = [
  [
    '......X.X.X...',
    '.....XX.XX....',
    '.X..XXX.XXX...',
    'XX..XXXXXXX...',
    'XXX.XXXXXXXX..',
    'XXOXXXOXXXXX..',
    'XXXXXXXXXXXX..',
    'XXXXEEEEXXXX..',
    'XXXKKKKKKKXX..',
    'XXXXXXXXXXXX..',
    '.XXXXXXXXXX...',
    '..X.X.X.X.X...',
    '...X...X...X..',
    '..............',
  ],
  [
    '.X.X.X.X......',
    '.XX.XX.XX.....',
    'XXX.XXX.XX....',
    'XXX.XXXXXXX...',
    'XXXX.XXXXXXX..',
    'XXOXXXOXXXXX..',
    'XXXXXXXXXXXX..',
    'XXXXEEEEXXXX..',
    'XXXKKKKKKKXX..',
    'XXXXXXXXXXXX..',
    '.XXXXXXXXXX...',
    '...X.X.X.X....',
    '..X...X...X...',
    '..............',
  ],
];

const cactuar: Frames = [
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

const chocobo: Frames = [
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

const SPRITE_DEFS: Record<SpriteKind, Frames> = {
  moogle,
  tonberry,
  marlboro,
  cactuar,
  chocobo,
};

export const SPRITE_PX = 28; // 14 cells × 2 scale
export const SCALE = 2;

const bitmapCache = new Map<string, ImageBitmap>();

export async function getSpriteBitmap(
  kind: SpriteKind,
  frame: 0 | 1,
): Promise<ImageBitmap> {
  const key = `${kind}:${frame}`;
  const cached = bitmapCache.get(key);
  if (cached) return cached;

  const grid = SPRITE_DEFS[kind][frame];
  const rows = grid.length;
  const cols = grid[0].length;
  const off = new OffscreenCanvas(cols * SCALE, rows * SCALE);
  const ctx = off.getContext('2d')!;
  for (let y = 0; y < rows; y++) {
    const row = grid[y];
    for (let x = 0; x < cols; x++) {
      const ch = row[x];
      const fill = PALETTE[ch];
      if (!fill) continue;
      ctx.fillStyle = fill;
      ctx.fillRect(x * SCALE, y * SCALE, SCALE, SCALE);
    }
  }
  const bm = await createImageBitmap(off);
  bitmapCache.set(key, bm);
  return bm;
}
