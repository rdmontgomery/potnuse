// @rdm/liaison-build — projects the Ahn et al. 2011 flavor network from the
// pinned bipartite source data into a single static liaison-graph.json that the
// /liaison page consumes. No runtime fetch: this runs at build time against the
// committed raw/ files, and its output is committed too.
//
// Citation: Ahn Y-Y, Ahnert SE, Bagrow JP, Barabasi A-L. "Flavor network and
// the principles of food pairing." Scientific Reports 1:196 (2011).
//
// THE ORDER PARAMETER (everything downstream ranks neighbors by this):
//
//     liaison strength   w_ij = |compounds(i) ∩ compounds(j)|
//
// i.e. the number of shared flavor (aroma) compounds between two ingredients.
// We also emit a normalized weight (Jaccard) because the raw count inflates
// trivially-similar pairs (bell_pepper / green_bell_pepper). See README.

import { readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const HERE = dirname(fileURLToPath(import.meta.url));
const RAW = join(HERE, 'raw');
const OUT = join(HERE, '..', '..', 'apps', 'site', 'public', 'liaison-graph.json');

// How many ranked neighbors to retain per ingredient. The graph renders far
// fewer (top-N is adjustable in the UI), but ranking + multi-select bridging
// needs a deep enough adjacency list to be honest.
const TOP_K = 60;

// ---------------------------------------------------------------------------
// Parse helpers. The Ahn files are tab/comma separated with `#`-comment lines.
// ---------------------------------------------------------------------------
function readLines(file) {
  return readFileSync(join(RAW, file), 'utf8')
    .split('\n')
    .map((l) => l.replace(/\r$/, ''))
    .filter((l) => l.length > 0 && !l.startsWith('#'));
}

function sha256(file) {
  return createHash('sha256')
    .update(readFileSync(join(RAW, file)))
    .digest('hex');
}

// ---------------------------------------------------------------------------
// 1. Ingredients: id -> { name, category }
// ---------------------------------------------------------------------------
const ingrName = new Map(); // numeric id -> name
const ingrCategory = new Map(); // numeric id -> category
for (const line of readLines('ingr_info.tsv')) {
  const [id, name, category] = line.split('\t');
  ingrName.set(Number(id), name);
  ingrCategory.set(Number(id), category);
}

// ---------------------------------------------------------------------------
// 2. Bipartite edges: ingredient id -> Set(compound id)
// ---------------------------------------------------------------------------
const compoundsOf = new Map(); // ingredient id -> Set<compound id>
for (const line of readLines('ingr_comp.tsv')) {
  const [ingr, comp] = line.split('\t').map(Number);
  if (!compoundsOf.has(ingr)) compoundsOf.set(ingr, new Set());
  compoundsOf.get(ingr).add(comp);
}

// Invert for the projection: compound id -> [ingredient ids].
const ingredientsWithCompound = new Map();
for (const [ingr, comps] of compoundsOf) {
  for (const c of comps) {
    if (!ingredientsWithCompound.has(c)) ingredientsWithCompound.set(c, []);
    ingredientsWithCompound.get(c).push(ingr);
  }
}

// ---------------------------------------------------------------------------
// 3. Project bipartite -> ingredient↔ingredient.
//
//    For every compound, every pair of ingredients that contains it shares
//    that compound. Accumulating across all compounds gives, for each pair,
//    w_ij = |compounds(i) ∩ compounds(j)|  — THE ORDER PARAMETER.
// ---------------------------------------------------------------------------
const pairKey = (a, b) => (a < b ? a * 100000 + b : b * 100000 + a);
const sharedCount = new Map(); // packed pair key -> w_ij

for (const ingrs of ingredientsWithCompound.values()) {
  for (let a = 0; a < ingrs.length; a++) {
    for (let b = a + 1; b < ingrs.length; b++) {
      const k = pairKey(ingrs[a], ingrs[b]);
      sharedCount.set(k, (sharedCount.get(k) || 0) + 1);
    }
  }
}

// w_ij lookup for an arbitrary ordered/unordered pair (0 if no shared compound).
function w(i, j) {
  if (i === j) return 0;
  return sharedCount.get(pairKey(i, j)) || 0;
}

// Build ranked adjacency per ingredient.
//   normalized weight = Jaccard = |Ci ∩ Cj| / |Ci ∪ Cj|
//                                = w_ij / (|Ci| + |Cj| − w_ij)
const neighbors = new Map(); // ingredient id -> [{ j, shared, jaccard }]
for (const k of sharedCount.keys()) {
  const i = Math.floor(k / 100000);
  const j = k % 100000;
  const shared = sharedCount.get(k);
  const ci = compoundsOf.get(i).size;
  const cj = compoundsOf.get(j).size;
  const jaccard = shared / (ci + cj - shared);
  if (!neighbors.has(i)) neighbors.set(i, []);
  if (!neighbors.has(j)) neighbors.set(j, []);
  neighbors.get(i).push({ j, shared, jaccard });
  neighbors.get(j).push({ j: i, shared, jaccard });
}

// ---------------------------------------------------------------------------
// 4. Cuisine prevalence + the Western-prior tendency, from the recipe data.
//
//    The canonical srep00196-s3.csv labels recipes by 11 world regions
//    (NorthAmerican, EastAsian, ...). For each cuisine we compute:
//      - prevalence P_c(i): fraction of that cuisine's recipes containing i
//      - pairing tendency: mean w_ij over ingredient pairs that co-occur in
//        the cuisine's recipes, minus the network baseline. This is the
//        paper's central finding made measurable: Western cuisines come out
//        POSITIVE (they favor shared-compound pairs), East Asian NEGATIVE.
// ---------------------------------------------------------------------------
const nameToId = new Map();
for (const [id, name] of ingrName) nameToId.set(name, id);

const recipes = []; // { cuisine, ids:number[] }
for (const line of readLines('srep00196-s3.csv')) {
  const parts = line.split(',');
  const cuisine = parts[0];
  const ids = [];
  for (let p = 1; p < parts.length; p++) {
    const id = nameToId.get(parts[p]);
    if (id !== undefined) ids.push(id);
  }
  if (ids.length) recipes.push({ cuisine, ids });
}

const cuisineRecipeCount = new Map();
const cuisineIngrCount = new Map(); // cuisine -> Map(ingr id -> recipe count)
const cuisinePairSum = new Map(); // cuisine -> summed w_ij over co-occurring pairs
const cuisinePairN = new Map(); // cuisine -> number of pairs counted
for (const { cuisine, ids } of recipes) {
  cuisineRecipeCount.set(cuisine, (cuisineRecipeCount.get(cuisine) || 0) + 1);
  if (!cuisineIngrCount.has(cuisine)) cuisineIngrCount.set(cuisine, new Map());
  const cm = cuisineIngrCount.get(cuisine);
  const uniq = [...new Set(ids)];
  for (const id of uniq) cm.set(id, (cm.get(id) || 0) + 1);
  let psum = cuisinePairSum.get(cuisine) || 0;
  let pn = cuisinePairN.get(cuisine) || 0;
  for (let a = 0; a < uniq.length; a++) {
    for (let b = a + 1; b < uniq.length; b++) {
      psum += w(uniq[a], uniq[b]);
      pn += 1;
    }
  }
  cuisinePairSum.set(cuisine, psum);
  cuisinePairN.set(cuisine, pn);
}

// Network baseline: mean w_ij over all ingredient pairs (zeros included), so
// "tendency" answers "do this cuisine's pairs share more compounds than chance?"
const totalIngredients = ingrName.size;
const allPairs = (totalIngredients * (totalIngredients - 1)) / 2;
let sumAll = 0;
for (const v of sharedCount.values()) sumAll += v;
const baseline = sumAll / allPairs;

// ---------------------------------------------------------------------------
// 4b. Cajun/Creole — a CURATED overlay (distinct provenance, flagged as such).
//
//     The canonical Ahn recipe file has NO Cajun/Creole label (it aggregates
//     to 11 world regions). Cajun/Creole is hand-authored here over the Ahn
//     ingredient table so it can be a first-class cuisine in the tool, and is
//     marked curated:true everywhere so the UI can be honest about it.
//     Weights are rough prevalence priors for the cuisine's canon (the holy
//     trinity, the spice/seafood/pork core, the filé/okra thickeners).
// ---------------------------------------------------------------------------
const CAJUN_PREVALENCE = {
  onion: 0.9, celery: 0.85, bell_pepper: 0.8, green_bell_pepper: 0.55,
  garlic: 0.85, cayenne: 0.75, black_pepper: 0.8, thyme: 0.55, bay: 0.45,
  parsley: 0.4, scallion: 0.5, tomato: 0.45, okra: 0.45, sassafras: 0.25,
  rice: 0.7, wheat: 0.5, butter: 0.55, vegetable_oil: 0.6, shrimp: 0.6,
  oyster: 0.35, crab: 0.3, catfish: 0.3, chicken: 0.55, pork: 0.55,
  pork_sausage: 0.45, smoked_sausage: 0.4, ham: 0.35, beef: 0.3,
  milk: 0.3, cream: 0.25, vinegar: 0.3, mustard: 0.3, lemon: 0.3,
  hot_pepper_sauce: 0.5, paprika: 0.45, oregano: 0.35, basil: 0.25,
  chicken_broth: 0.4, fish: 0.35, lard: 0.3, cane_molasses: 0.2,
};

// ---------------------------------------------------------------------------
// 5. Assemble nodes + adjacency, keyed by ingredient NAME for legibility.
// ---------------------------------------------------------------------------
const CUISINE_KEYS = [...cuisineRecipeCount.keys()].sort(
  (a, b) => cuisineRecipeCount.get(b) - cuisineRecipeCount.get(a),
);

const nodes = [];
for (const [id, name] of ingrName) {
  const comps = compoundsOf.get(id);
  if (!comps || comps.size === 0) continue; // ingredients with no compounds can't liaise
  const cuisines = {};
  for (const c of CUISINE_KEYS) {
    const cm = cuisineIngrCount.get(c);
    const n = cm?.get(id) || 0;
    if (n > 0) {
      const prev = n / cuisineRecipeCount.get(c);
      cuisines[c] = Math.round(prev * 1000) / 1000;
    }
  }
  if (CAJUN_PREVALENCE[name] !== undefined) {
    cuisines.CajunCreole = CAJUN_PREVALENCE[name];
  }
  nodes.push({
    id: name,
    name,
    category: ingrCategory.get(id) || 'unknown',
    ncomp: comps.size,
    cuisines,
  });
}

const adj = {};
for (const node of nodes) {
  const id = nameToId.get(node.id);
  const list = (neighbors.get(id) || [])
    .sort((p, q) => q.shared - p.shared || q.jaccard - p.jaccard)
    .slice(0, TOP_K);
  // compact: [neighborName, shared, jaccardRounded]
  adj[node.id] = list.map((e) => [
    ingrName.get(e.j),
    e.shared,
    Math.round(e.jaccard * 1000) / 1000,
  ]);
}

// Per-cuisine tendency. Cajun/Creole tendency is computed over its curated
// ingredient set (prevalence-weighted), so the toggle still teaches something.
const cuisines = [];
const LABELS = {
  NorthAmerican: 'North American', SouthernEuropean: 'Southern European',
  LatinAmerican: 'Latin American', WesternEuropean: 'Western European',
  EastAsian: 'East Asian', MiddleEastern: 'Middle Eastern',
  SouthAsian: 'South Asian', SoutheastAsian: 'Southeast Asian',
  EasternEuropean: 'Eastern European', NorthernEuropean: 'Northern European',
  African: 'African', CajunCreole: 'Cajun / Creole',
};
for (const c of CUISINE_KEYS) {
  const mean = cuisinePairSum.get(c) / Math.max(1, cuisinePairN.get(c));
  cuisines.push({
    key: c,
    label: LABELS[c] || c,
    recipeCount: cuisineRecipeCount.get(c),
    meanSharedPerPair: Math.round(mean * 100) / 100,
    tendency: Math.round((mean - baseline) * 100) / 100,
    curated: false,
  });
}
// Cajun/Creole curated tendency.
{
  const cajunIds = Object.keys(CAJUN_PREVALENCE)
    .map((n) => nameToId.get(n))
    .filter((x) => x !== undefined && compoundsOf.has(x));
  let psum = 0;
  let pn = 0;
  for (let a = 0; a < cajunIds.length; a++) {
    for (let b = a + 1; b < cajunIds.length; b++) {
      psum += w(cajunIds[a], cajunIds[b]);
      pn += 1;
    }
  }
  const mean = psum / Math.max(1, pn);
  cuisines.push({
    key: 'CajunCreole',
    label: 'Cajun / Creole',
    recipeCount: null,
    meanSharedPerPair: Math.round(mean * 100) / 100,
    tendency: Math.round((mean - baseline) * 100) / 100,
    curated: true,
  });
}

const payload = {
  meta: {
    title: 'Liaison — flavor network projection',
    citation:
      'Ahn Y-Y, Ahnert SE, Bagrow JP, Barabasi A-L. Flavor network and the principles of food pairing. Sci Rep 1:196 (2011).',
    orderParameter: 'w_ij = |compounds(i) ∩ compounds(j)| (shared aroma compounds)',
    normalized: 'Jaccard = w_ij / (|Ci| + |Cj| − w_ij)',
    generated: new Date().toISOString().slice(0, 10),
    topK: TOP_K,
    networkBaselineSharedPerPair: Math.round(baseline * 1000) / 1000,
    nodeCount: nodes.length,
    edgeCount: sharedCount.size,
    source: {
      mirror: 'github.com/lingcheng99/Flavor-Network (data/)',
      sha256: {
        'ingr_info.tsv': sha256('ingr_info.tsv'),
        'comp_info.tsv': sha256('comp_info.tsv'),
        'ingr_comp.tsv': sha256('ingr_comp.tsv'),
        'srep00196-s3.csv': sha256('srep00196-s3.csv'),
      },
    },
  },
  cuisines,
  nodes,
  adj,
};

writeFileSync(OUT, JSON.stringify(payload));

// ---------------------------------------------------------------------------
// Build-time hand-check (printed, not shipped): known pairings should rank.
// ---------------------------------------------------------------------------
function top(name, n = 6) {
  const list = adj[name];
  if (!list) return `  ${name}: (not found)`;
  return (
    `  ${name} top-${n} by shared compounds:\n` +
    list
      .slice(0, n)
      .map(([nm, s, j]) => `    ${nm.padEnd(22)} shared=${s} jaccard=${j}`)
      .join('\n')
  );
}
console.log(`liaison-graph.json written: ${nodes.length} nodes, ${sharedCount.size} edges`);
console.log(`network baseline shared/pair = ${Math.round(baseline * 1000) / 1000}`);
console.log('cuisine tendencies (mean shared/pair − baseline):');
for (const c of cuisines)
  console.log(
    `  ${c.label.padEnd(20)} tendency=${c.tendency >= 0 ? '+' : ''}${c.tendency}` +
      `${c.curated ? '  [curated]' : ''}`,
  );
console.log('hand-check:');
console.log(top('coffee'));
console.log(top('strawberry'));
console.log(top('cocoa'));
console.log(top('bell_pepper'));
