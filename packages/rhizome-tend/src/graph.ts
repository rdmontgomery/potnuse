/**
 * Reconstructing the rhizome graph from raw file sources.
 *
 * Deliberately independent of `astro:content` — this package reads the graph
 * at *arbitrary git revisions*, where the Astro loader cannot help. The
 * frontmatter parser here is a small subset of YAML: enough for the node
 * schema in `apps/site/src/content.config.ts`, and nothing more.
 */

export type NodeState = 'seedling' | 'germinating' | 'stable' | 'fossil';

export const NODE_STATES: readonly NodeState[] = [
  'seedling',
  'germinating',
  'stable',
  'fossil',
];

export type NodeCollection = 'essays' | 'experiments' | 'exchanges' | 'page';

export interface RawNode {
  slug: string;
  collection: NodeCollection;
  /** Repo-relative path, or null for a static node declared in graph.ts. */
  path: string | null;
  title: string;
  date: string | null;
  state: NodeState;
  connects: string[];
}

export interface GraphSnapshot {
  nodes: RawNode[];
  /** slug -> number of other nodes whose `connects` names it. */
  inDegree: Record<string, number>;
  /** `connects` targets that match no node. graph.ts drops these silently. */
  dangling: Array<{ from: string; target: string }>;
}

function isNodeState(value: string): value is NodeState {
  return (NODE_STATES as readonly string[]).includes(value);
}

function unquote(value: string): string {
  const trimmed = value.trim();
  const first = trimmed[0];
  if ((first === "'" || first === '"') && trimmed.endsWith(first)) {
    return trimmed.slice(1, -1);
  }
  return trimmed;
}

/** Line index (1-based) of the closing `---`, or 0 if there is no frontmatter. */
export function frontmatterEndLine(source: string): number {
  const lines = source.split('\n');
  if (lines[0]?.trim() !== '---') return 0;
  for (let i = 1; i < lines.length; i++) {
    if (lines[i]?.trim() === '---') return i + 1;
  }
  return 0;
}

/**
 * Parse the leading `---` block. Supports scalars, inline arrays
 * (`connects: [a, b]`) and block arrays (`connects:` then `  - a`). Values are
 * returned as strings or string arrays; no type coercion, no nesting.
 */
export function parseFrontmatter(
  source: string,
): Record<string, string | string[]> {
  const end = frontmatterEndLine(source);
  if (end === 0) return {};
  const lines = source.split('\n').slice(1, end - 1);
  const out: Record<string, string | string[]> = {};

  let blockKey: string | null = null;
  for (const line of lines) {
    const item = /^\s*-\s+(.*)$/.exec(line);
    if (blockKey && item) {
      (out[blockKey] as string[]).push(unquote(item[1] ?? ''));
      continue;
    }
    blockKey = null;

    const pair = /^([A-Za-z_][\w-]*):\s*(.*)$/.exec(line);
    if (!pair) continue;
    const key = pair[1] as string;
    const value = (pair[2] ?? '').trim();

    if (value === '') {
      // Either an empty scalar or the head of a block array; the next line
      // decides. Start as an array and collapse below if nothing follows.
      blockKey = key;
      out[key] = [];
      continue;
    }
    if (value.startsWith('[')) {
      const inner = value.slice(1, value.lastIndexOf(']'));
      out[key] = inner
        .split(',')
        .map((part) => unquote(part))
        .filter((part) => part.length > 0);
      continue;
    }
    out[key] = unquote(value);
  }

  // A key that opened a block but collected nothing was an empty scalar.
  for (const [key, value] of Object.entries(out)) {
    if (Array.isArray(value) && value.length === 0 && key !== 'connects' && key !== 'tags') {
      out[key] = '';
    }
  }
  return out;
}

function asArray(value: string | string[] | undefined): string[] {
  if (Array.isArray(value)) return value;
  if (typeof value === 'string' && value.length > 0) return [value];
  return [];
}

/** Build a node from one content file's source. */
export function nodeFromSource(
  collection: Exclude<NodeCollection, 'page'>,
  path: string,
  source: string,
): RawNode {
  const fm = parseFrontmatter(source);
  const slug = (path.split('/').pop() ?? path).replace(/\.mdx?$/, '');
  const rawState = typeof fm.state === 'string' ? fm.state : 'seedling';
  const date = typeof fm.date === 'string' && fm.date.length > 0 ? fm.date : null;
  return {
    slug,
    collection,
    path,
    title: typeof fm.title === 'string' ? fm.title : slug,
    date,
    state: isNodeState(rawState) ? rawState : 'seedling',
    connects: asArray(fm.connects),
  };
}

/**
 * Pull the STATIC_NODES literal out of `apps/site/src/lib/graph.ts`.
 *
 * Regex over source is ugly, but the alternative is importing a module that
 * depends on `astro:content` — impossible here, and impossible at an old
 * revision regardless. The shape is stable and hand-maintained; callers should
 * surface a warning when this returns nothing.
 */
export function parseStaticNodes(source: string): RawNode[] {
  const block = /const STATIC_NODES[^=]*=\s*\[([\s\S]*?)\n\];/.exec(source);
  if (!block?.[1]) return [];

  const nodes: RawNode[] = [];
  for (const chunk of block[1].split(/\n\s{2}\},?/)) {
    const str = (key: string): string | null => {
      const hit = new RegExp(`\\b${key}:\\s*['"]([^'"]*)['"]`).exec(chunk);
      return hit?.[1] ?? null;
    };
    const slug = str('slug');
    if (!slug) continue;
    const rawState = str('state') ?? 'stable';
    const connectsRaw = /\bconnects:\s*\[([^\]]*)\]/.exec(chunk)?.[1] ?? '';
    nodes.push({
      slug,
      collection: 'page',
      path: null,
      title: str('title') ?? slug,
      date: str('date'),
      state: isNodeState(rawState) ? rawState : 'stable',
      connects: connectsRaw
        .split(',')
        .map((part) => unquote(part))
        .filter((part) => part.length > 0),
    });
  }
  return nodes;
}

/**
 * In-degree over the whole node set. `connects` may name either a bare slug or
 * a qualified `collection/slug` id, matching graph.ts's own tolerance.
 */
export function snapshot(nodes: RawNode[]): GraphSnapshot {
  const bySlug = new Map(nodes.map((n) => [n.slug, n]));
  const byId = new Map(nodes.map((n) => [`${n.collection}/${n.slug}`, n]));
  const inDegree: Record<string, number> = {};
  for (const n of nodes) inDegree[n.slug] = 0;

  const dangling: Array<{ from: string; target: string }> = [];
  for (const n of nodes) {
    // A node listing the same target twice still only counts once.
    for (const target of new Set(n.connects)) {
      const hit = bySlug.get(target) ?? byId.get(target);
      if (!hit || hit.slug === n.slug) {
        if (!hit) dangling.push({ from: n.slug, target });
        continue;
      }
      inDegree[hit.slug] = (inDegree[hit.slug] ?? 0) + 1;
    }
  }
  return { nodes, inDegree, dangling };
}
