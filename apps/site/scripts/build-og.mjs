import sharp from 'sharp';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const src = resolve('public/og-default.svg');
const out = resolve('public/og-default.png');
const svg = readFileSync(src);

await sharp(svg, { density: 144 })
  .resize(1200, 630)
  .png()
  .toFile(out);

console.log(`wrote ${out}`);
