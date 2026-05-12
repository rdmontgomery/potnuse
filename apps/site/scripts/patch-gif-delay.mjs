// Quick GIF frame-delay patcher. Walks the GIF blocks properly so we
// don't false-match `21 F9 04` inside compressed image data, and writes
// every Graphics Control Extension's delay field to the new value.
//
// Delays are in centiseconds (1/100 sec). Run via:
//   node _patch-gif-delay.mjs <input> <output> <delayCs>

import fs from 'node:fs';

function patchDelay(inputPath, outputPath, newDelayCs) {
  const buf = fs.readFileSync(inputPath);
  if (buf.toString('ascii', 0, 6) !== 'GIF89a' && buf.toString('ascii', 0, 6) !== 'GIF87a') {
    throw new Error(`not a GIF: ${inputPath}`);
  }
  let i = 6;
  // Logical Screen Descriptor: 7 bytes; packed at offset 10
  const packedLSD = buf[10];
  i += 7;
  const hasGCT = (packedLSD & 0x80) !== 0;
  const gctSize = packedLSD & 0x07;
  if (hasGCT) i += 3 * (1 << (gctSize + 1));

  while (i < buf.length) {
    const b = buf[i];
    if (b === 0x3b) break;
    if (b === 0x21) {
      const label = buf[i + 1];
      if (label === 0xf9) {
        // 21 F9 04 packed delay_lo delay_hi trans 00
        buf[i + 4] = newDelayCs & 0xff;
        buf[i + 5] = (newDelayCs >> 8) & 0xff;
        i += 8;
      } else {
        // Generic extension: 21 [label] sub-blocks ... 00
        i += 2;
        while (buf[i] !== 0x00) i += buf[i] + 1;
        i += 1;
      }
    } else if (b === 0x2c) {
      // Image descriptor: 0x2C + 9 bytes (the 9th is packed)
      const packed = buf[i + 9];
      i += 10;
      const hasLCT = (packed & 0x80) !== 0;
      const lctSize = packed & 0x07;
      if (hasLCT) i += 3 * (1 << (lctSize + 1));
      // LZW min code size byte
      i += 1;
      // Image data sub-blocks until terminator
      while (buf[i] !== 0x00) i += buf[i] + 1;
      i += 1;
    } else {
      throw new Error(`unexpected byte 0x${b.toString(16)} at offset ${i}`);
    }
  }

  fs.writeFileSync(outputPath, buf);
}

const [, , input, output, delay] = process.argv;
if (!input || !output || !delay) {
  console.error('usage: node _patch-gif-delay.mjs <input> <output> <delayCs>');
  process.exit(1);
}
patchDelay(input, output, parseInt(delay, 10));
console.log(`wrote ${output} with delay ${delay}cs`);
