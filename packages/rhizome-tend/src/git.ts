/**
 * Thin git wrappers. All the I/O in this package lives here so everything else
 * stays pure and testable.
 */

import { execFileSync } from 'node:child_process';
import { frontmatterEndLine } from './graph.ts';

export interface GitOptions {
  cwd: string;
}

function git(args: string[], opts: GitOptions): string {
  return execFileSync('git', args, {
    cwd: opts.cwd,
    encoding: 'utf8',
    maxBuffer: 64 * 1024 * 1024,
  });
}

function tryGit(args: string[], opts: GitOptions): string | null {
  try {
    return git(args, opts);
  } catch {
    return null;
  }
}

export function repoRoot(cwd: string): string {
  return git(['rev-parse', '--show-toplevel'], { cwd }).trim();
}

/** Newest commit at or before an ISO instant, or null if history starts later. */
export function revBefore(iso: string, opts: GitOptions): string | null {
  const out = git(['rev-list', '-1', `--before=${iso}`, 'HEAD'], opts).trim();
  return out.length > 0 ? out : null;
}

export function revDate(rev: string, opts: GitOptions): string {
  return git(['show', '-s', '--format=%aI', rev], opts).trim();
}

export function listFiles(
  rev: string,
  dir: string,
  opts: GitOptions,
): string[] {
  const out = tryGit(['ls-tree', '-r', '--name-only', rev, '--', dir], opts);
  if (out === null) return [];
  return out.split('\n').filter((line) => line.length > 0);
}

export function showFile(
  rev: string,
  path: string,
  opts: GitOptions,
): string | null {
  return tryGit(['show', `${rev}:${path}`], opts);
}

/** ISO date of the commit that introduced a path. */
export function firstCommitDate(
  path: string,
  opts: GitOptions,
): string | null {
  const out = tryGit(
    ['log', '--format=%aI', '--reverse', '--diff-filter=A', '--', path],
    opts,
  );
  const first = out?.split('\n').find((line) => line.length > 0);
  if (first) return first;
  // A file added before the history we have, or renamed past --diff-filter=A.
  const any = tryGit(['log', '--format=%aI', '--', path], opts);
  const lines = any?.split('\n').filter((line) => line.length > 0) ?? [];
  return lines[lines.length - 1] ?? null;
}

/**
 * ISO date of the last commit that changed prose rather than frontmatter.
 *
 * Frontmatter churn (a state bump, a tag, a `connects` entry) is exactly what
 * this routine itself writes. Counting it as an edit would let the routine
 * reset every node's clock on every run and nothing would ever settle.
 *
 * Classification is by hunk line numbers against the frontmatter fence at that
 * revision — exact, rather than guessing from the diff text, where a markdown
 * bullet and a YAML list item look identical.
 */
export function lastProseEditDate(
  path: string,
  opts: GitOptions,
): string | null {
  const log = tryGit(['log', '--format=%H %aI', '--', path], opts);
  if (!log) return null;

  for (const line of log.split('\n').filter((l) => l.length > 0)) {
    const [sha, date] = line.split(' ');
    if (!sha || !date) continue;

    const after = showFile(sha, path, opts);
    // Deleted at this commit: nothing to classify, keep walking back.
    if (after === null) continue;
    const fenceEnd = frontmatterEndLine(after);

    const diff = tryGit(
      ['show', '--format=', '--unified=0', sha, '--', path],
      opts,
    );
    if (!diff) continue;

    for (const hunk of diff.split('\n')) {
      const header = /^@@ -\d+(?:,(\d+))? \+(\d+)(?:,(\d+))? @@/.exec(hunk);
      if (!header) continue;
      const newStart = Number(header[2]);
      const newCount = header[3] === undefined ? 1 : Number(header[3]);
      // Pure deletion (newCount 0) anchors at newStart, which is the line it
      // was removed from; treating it the same way is close enough.
      const lastTouched = newStart + Math.max(newCount, 1) - 1;
      if (lastTouched > fenceEnd) return date;
    }
  }
  return null;
}
