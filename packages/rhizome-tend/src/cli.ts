/**
 * The mechanical half of rhizome tending: numbers only, no judgement.
 *
 * Usage (from the repo root):
 *   pnpm --filter @rdm/rhizome-tend tend
 *   pnpm --filter @rdm/rhizome-tend tend -- --json
 *   pnpm --filter @rdm/rhizome-tend tend -- --since-days 60
 *
 * Exit code is 1 when there is something to review, so a scheduled run can
 * stay silent on a quiet month.
 */

import { observe } from './observe.ts';
import { formatTable, hasFindings } from './report.ts';

function parseArgs(argv: string[]): { json: boolean; sinceDays: number } {
  let json = false;
  let sinceDays = 120;
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--json') json = true;
    else if (arg === '--since-days') {
      const value = Number(argv[++i]);
      if (!Number.isFinite(value) || value <= 0) {
        throw new Error('--since-days needs a positive number of days');
      }
      sinceDays = value;
    } else if (arg !== undefined && arg.startsWith('--')) {
      throw new Error(`unknown flag: ${arg}`);
    }
  }
  return { json, sinceDays };
}

const args = parseArgs(process.argv.slice(2));
const report = observe({ cwd: process.cwd(), sinceDays: args.sinceDays });
console.log(args.json ? JSON.stringify(report, null, 2) : formatTable(report));
process.exitCode = hasFindings(report) ? 1 : 0;
