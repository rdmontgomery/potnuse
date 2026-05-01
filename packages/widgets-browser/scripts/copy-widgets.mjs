import { cpSync, mkdirSync, rmSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const src = resolve(here, '..', 'widgets');
const dst = resolve(here, '..', 'dist', 'widgets');

if (existsSync(dst)) rmSync(dst, { recursive: true });
mkdirSync(dst, { recursive: true });
cpSync(src, dst, { recursive: true });
console.log(`copied ${src} -> ${dst}`);
