# @rdm/stego

Tiny zero-width steganography codec. One method, no dependencies.

```ts
import { embed, extract, strip } from '@rdm/stego';

const carrier = 'shave my head and read.';
const stamped = embed(carrier, 'the body is the message.');

// looks identical
console.log(stamped); // 'shave my head and read.' (with invisible chars)

// decode
extract(stamped); // 'the body is the message.'

// remove the channel
strip(stamped); // 'shave my head and read.'
```

## scheme

Bits are written as two zero-width characters; payloads are framed by a third
so a decoder can find them inside arbitrary surrounding prose.

| symbol | codepoint | meaning      |
| ------ | --------- | ------------ |
| ZERO   | U+200B    | bit 0        |
| ONE    | U+200C    | bit 1        |
| FRAME  | U+2060    | payload edge |

A payload is `FRAME (bits…) FRAME`, eight bits per UTF-8 byte. The decoder
ignores any visible characters between the frame markers, so payloads survive
copy-paste through rich-text editors that re-flow whitespace.

## why

Inspired by elder-plinius's [ST3GG](https://github.com/elder-plinius/ST3GG) —
ST3GG implements a hundred-plus techniques across images, audio, packets,
archives, and Unicode. ST3GG is AGPL-3.0; this package is a fresh, much
smaller implementation of the well-known zero-width Unicode method only, so
the host site can stay under its current license.
