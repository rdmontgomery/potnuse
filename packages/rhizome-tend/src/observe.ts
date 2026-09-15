/**
 * Orchestration: sample the graph at two revisions and turn the difference
 * into per-node signals.
 */

import {
  nodeFromSource,
  parseStaticNodes,
  snapshot,
  type GraphSnapshot,
  type NodeCollection,
  type RawNode,
} from './graph.ts';
import {
  firstCommitDate,
  lastProseEditDate,
  listFiles,
  repoRoot,
  revBefore,
  revDate,
  showFile,
  type GitOptions,
} from './git.ts';
import { proposeState, type Proposal, type Signals, type Thresholds } from './rules.ts';

const CONTENT_DIR = 'apps/site/src/content';
const GRAPH_TS = 'apps/site/src/lib/graph.ts';
const PAGES_DIR = 'apps/site/src/pages';
const COLLECTIONS = ['essays', 'experiments', 'exchanges'] as const;
const DAY_MS = 86_400_000;

export interface Report {
  head: { rev: string; when: string };
  prior: { rev: string; when: string } | null;
  windowDays: number;
  corpusDelta: number;
  staticNodesFound: number;
  rows: Array<{ signals: Signals; proposal: Proposal }>;
  orphans: string[];
  dangling: Array<{ from: string; target: string }>;
  unmappedRoutes: string[];
}

function collectionOf(path: string): Exclude<NodeCollection, 'page'> | null {
  for (const c of COLLECTIONS) {
    if (path.startsWith(`${CONTENT_DIR}/${c}/`)) return c;
  }
  return null;
}

/** Rebuild the whole graph as it stood at one revision. */
export function graphAt(rev: string, opts: GitOptions): GraphSnapshot {
  const nodes: RawNode[] = [];
  for (const path of listFiles(rev, CONTENT_DIR, opts)) {
    if (!/\.mdx?$/.test(path)) continue;
    const collection = collectionOf(path);
    if (!collection) continue;
    const source = showFile(rev, path, opts);
    if (source === null) continue;
    nodes.push(nodeFromSource(collection, path, source));
  }
  const graphSource = showFile(rev, GRAPH_TS, opts);
  if (graphSource) nodes.push(...parseStaticNodes(graphSource));
  return snapshot(nodes);
}

/**
 * Live routes that no node claims — pages reachable in the browser but
 * invisible on /rhizome because nothing added them to STATIC_NODES.
 */
function unmappedRoutes(
  rev: string,
  known: Set<string>,
  opts: GitOptions,
): string[] {
  const skip = new Set(['index', '404', 'rhizome', 'graph.json']);
  const routes: string[] = [];
  for (const path of listFiles(rev, PAGES_DIR, opts)) {
    if (!path.endsWith('.astro')) continue;
    const rel = path.slice(PAGES_DIR.length + 1).replace(/\.astro$/, '');
    // Dynamic routes and collection templates are rendered from content that
    // already has nodes of its own.
    if (rel.includes('[')) continue;
    if (COLLECTIONS.some((c) => rel.startsWith(`${c}/`))) continue;
    const slug = rel.replace(/\/index$/, '');
    if (skip.has(slug) || skip.has(rel)) continue;
    if (known.has(slug)) continue;
    routes.push(`/${slug}`);
  }
  return routes.sort();
}

export interface ObserveOptions {
  cwd: string;
  sinceDays: number;
  now?: Date;
  thresholds?: Thresholds;
}

export function observe(options: ObserveOptions): Report {
  const opts: GitOptions = { cwd: repoRoot(options.cwd) };
  const now = options.now ?? new Date();

  const head = graphAt('HEAD', opts);
  const headRev = 'HEAD';
  const headWhen = revDate('HEAD', opts);

  const cutoff = new Date(now.getTime() - options.sinceDays * DAY_MS);
  const priorRev = revBefore(cutoff.toISOString(), opts);
  const prior = priorRev ? graphAt(priorRev, opts) : null;

  const corpusDelta = prior ? head.nodes.length - prior.nodes.length : 0;

  const rows = head.nodes.map((node) => {
    // Frontmatter date wins over the git add date. Several nodes were written
    // well before they were committed, and the frontmatter date is the one the
    // site displays and the temporal field on /rhizome renders — the ladder
    // should not disagree with the map about how old something is.
    const added = node.path ? firstCommitDate(node.path, opts) : null;
    const created = node.date ?? added;
    const lastProse = node.path ? lastProseEditDate(node.path, opts) : null;
    const since = (iso: string | null): number =>
      iso === null
        ? Number.POSITIVE_INFINITY
        : (now.getTime() - Date.parse(iso)) / DAY_MS;
    const ageDays = since(created);
    // No prose-only commit means the node has never been revised past its
    // first draft. Measure that silence from when it entered the repo, not
    // from its frontmatter date — a backdated draft was not sitting untended.
    const quietDays = lastProse ? since(lastProse) : since(added ?? created);

    const inDegree = head.inDegree[node.slug] ?? 0;
    const priorIn = prior ? (prior.inDegree[node.slug] ?? 0) : inDegree;

    const signals: Signals = {
      slug: node.slug,
      currentState: node.state,
      ageDays,
      quietDays,
      inDegree,
      outDegree: node.connects.length,
      inDegreeDelta: inDegree - priorIn,
      corpusDelta,
      windowDays: options.sinceDays,
    };
    return { signals, proposal: proposeState(signals, options.thresholds) };
  });

  rows.sort((a, b) => b.signals.inDegree - a.signals.inDegree);

  return {
    head: { rev: headRev, when: headWhen },
    prior: priorRev ? { rev: priorRev, when: revDate(priorRev, opts) } : null,
    windowDays: options.sinceDays,
    corpusDelta,
    staticNodesFound: head.nodes.filter((n) => n.collection === 'page').length,
    rows,
    orphans: head.nodes
      .filter((n) => (head.inDegree[n.slug] ?? 0) === 0)
      .map((n) => n.slug)
      .sort(),
    dangling: head.dangling,
    unmappedRoutes: unmappedRoutes(
      'HEAD',
      new Set(head.nodes.map((n) => n.slug)),
      opts,
    ),
  };
}
