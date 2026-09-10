#!/usr/bin/env node
// Graph doctor — connectivity check for the rhizome.
//
// The site's only navigation affordance is a door to a random node, walked
// over `connects` edges. A node with no usable edges is unreachable; a graph
// that splits into components means the random walk can never cross between
// them. This script measures that directly.
//
// Order parameter: size of the largest weakly-connected component / N.
//   1.0  => fully connected, every node reachable from every other.
//   < 1  => the rhizome has fractured into islands.
//
// Exit code is non-zero when the graph is fractured or any orphan/dead-end
// exists, so this can also gate CI if we ever want it to.

import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const SITE = join(__dirname, '..');
const CONTENT = join(SITE, 'src', 'content');
const COLLECTIONS = ['essays', 'experiments', 'exchanges'];
const STALE_DAYS = 90; // a seedling untouched this long wants attention

// --- tiny frontmatter reader (only the fields we need) --------------------
function parseFrontmatter(src) {
  const m = src.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  if (!m) return {};
  const out = {};
  for (const line of m[1].split(/\r?\n/)) {
    const kv = line.match(/^(\w+):\s*(.*)$/);
    if (!kv) continue;
    const [, key, rawVal] = kv;
    let val = rawVal.trim();
    if (val.startsWith('[') && val.endsWith(']')) {
      val = val
        .slice(1, -1)
        .split(',')
        .map((s) => s.trim().replace(/^['"]|['"]$/g, ''))
        .filter(Boolean);
    } else {
      val = val.replace(/^['"]|['"]$/g, '');
    }
    out[key] = val;
  }
  return out;
}

// --- collect content nodes -------------------------------------------------
const nodes = new Map(); // slug -> { slug, collection, state, date, connects }

for (const collection of COLLECTIONS) {
  const dir = join(CONTENT, collection);
  let files = [];
  try {
    files = readdirSync(dir).filter((f) => f.endsWith('.mdx'));
  } catch {
    continue;
  }
  for (const file of files) {
    const slug = file.replace(/\.mdx$/, '');
    const fm = parseFrontmatter(readFileSync(join(dir, file), 'utf8'));
    nodes.set(slug, {
      slug,
      collection,
      state: fm.state || 'unknown',
      date: fm.date || null,
      connects: Array.isArray(fm.connects) ? fm.connects : [],
    });
  }
}

// --- collect STATIC_NODES from graph.ts (parsed, so it can't drift) --------
const graphTs = readFileSync(join(SITE, 'src', 'lib', 'graph.ts'), 'utf8');
const staticBlock = graphTs.match(/STATIC_NODES[\s\S]*?=\s*\[([\s\S]*?)\n\];/);
if (staticBlock) {
  const re = /slug:\s*'([^']+)'[\s\S]*?connects:\s*\[([^\]]*)\]/g;
  let mm;
  while ((mm = re.exec(staticBlock[1]))) {
    const slug = mm[1];
    const connects = mm[2]
      .split(',')
      .map((s) => s.trim().replace(/^['"]|['"]$/g, ''))
      .filter(Boolean);
    if (!nodes.has(slug)) {
      nodes.set(slug, { slug, collection: 'page', state: 'static', date: null, connects });
    }
  }
}

const all = [...nodes.values()];
const N = all.length;

// --- build undirected adjacency (edges are walkable both ways for reachability)
const adj = new Map(all.map((n) => [n.slug, new Set()]));
const dangling = []; // edges pointing at slugs that don't exist
for (const n of all) {
  for (const target of n.connects) {
    if (!nodes.has(target)) {
      dangling.push({ from: n.slug, to: target });
      continue;
    }
    adj.get(n.slug).add(target);
    adj.get(target).add(n.slug);
  }
}

// --- weakly-connected components ------------------------------------------
const seen = new Set();
const components = [];
for (const n of all) {
  if (seen.has(n.slug)) continue;
  const stack = [n.slug];
  const comp = [];
  while (stack.length) {
    const s = stack.pop();
    if (seen.has(s)) continue;
    seen.add(s);
    comp.push(s);
    for (const nb of adj.get(s)) stack.push(nb);
  }
  components.push(comp.sort());
}
components.sort((a, b) => b.length - a.length);
const largest = components[0]?.length ?? 0;
const phi = N ? largest / N : 0;

// --- diagnostics -----------------------------------------------------------
const orphans = all.filter((n) => adj.get(n.slug).size === 0); // no edges at all
const deadEnds = all.filter((n) => n.connects.length === 0 && adj.get(n.slug).size > 0); // only reachable, never outgoing

const now = Date.now();
const staleSeedlings = all.filter((n) => {
  if (n.state !== 'seedling' || !n.date) return false;
  const ageDays = (now - new Date(n.date).getTime()) / 86400000;
  return ageDays > STALE_DAYS;
});

// --- report ----------------------------------------------------------------
const pct = (x) => (x * 100).toFixed(1) + '%';
console.log('# Rhizome graph doctor\n');
console.log(`Nodes: ${N}   Components: ${components.length}`);
console.log(`Connectivity φ (largest WCC / N): ${phi.toFixed(3)}  (${pct(phi)})\n`);

if (components.length > 1) {
  console.log('FRACTURED — the random walk cannot cross between these islands:');
  components.forEach((c, i) => console.log(`  [${i + 1}] (${c.length}) ${c.join(', ')}`));
  console.log('');
}
if (orphans.length) {
  console.log('ORPHANS (no edges — unreachable by the door):');
  orphans.forEach((n) => console.log(`  - ${n.slug} (${n.collection})`));
  console.log('');
}
if (deadEnds.length) {
  console.log('DEAD-ENDS (reachable but connect to nothing — walk terminates here):');
  deadEnds.forEach((n) => console.log(`  - ${n.slug} (${n.collection})`));
  console.log('');
}
if (dangling.length) {
  console.log('DANGLING EDGES (connects to a slug that does not exist):');
  dangling.forEach((d) => console.log(`  - ${d.from} -> ${d.to}`));
  console.log('');
}
if (staleSeedlings.length) {
  console.log(`STALE SEEDLINGS (>${STALE_DAYS}d, still state: seedling):`);
  staleSeedlings.forEach((n) => console.log(`  - ${n.slug} (last: ${n.date})`));
  console.log('');
}
if (components.length === 1 && !orphans.length && !deadEnds.length && !dangling.length) {
  console.log('Graph is whole. Every node is reachable. Nothing to garden.');
}

const unhealthy = components.length > 1 || orphans.length || dangling.length;
process.exit(unhealthy ? 1 : 0);
