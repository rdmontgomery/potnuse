# Liaison data provenance

The flavor network is **pinned**, not fetched at runtime. The raw source files
live in `raw/`, are committed, and `build.mjs` projects them into
`apps/site/public/liaison-graph.json` (also committed). Re-running the build is
the only way the graph changes.

## Primary source (canonical, pinned)

Ahn Y-Y, Ahnert SE, Bagrow JP, Barabási A-L. **"Flavor network and the
principles of food pairing."** *Scientific Reports* **1**:196 (2011).
<https://doi.org/10.1038/srep00196>

Files mirror the paper's supplementary data. Fetched from
`github.com/lingcheng99/Flavor-Network` (`data/`), one of the brief's listed
fallback mirrors, on 2026-05-31:

| file               | lines  | sha256 (first 16) | contents |
|--------------------|--------|-------------------|----------|
| `ingr_info.tsv`    | 1531   | `5ff493a5cc680a7d` | ingredient id, name, category |
| `comp_info.tsv`    | 1108   | `17ae9e5034ae0bd8` | compound id, name, CAS number |
| `ingr_comp.tsv`    | 36782  | `54ac1a13c20534ec` | ingredient↔compound bipartite edges |
| `srep00196-s3.csv` | 56502  | `34dfbe5c55eb1b22` | cuisine-labeled recipes (11 world regions) |

Full sha256 digests are recomputed and embedded in `liaison-graph.json`
(`meta.source.sha256`) on every build, so the output self-documents its inputs.

## Cuisine labels — an honest note

The canonical `srep00196-s3.csv` labels recipes by **11 world regions**
(NorthAmerican, SouthernEuropean, LatinAmerican, WesternEuropean, EastAsian,
MiddleEastern, SouthAsian, SoutheastAsian, EasternEuropean, NorthernEuropean,
African). It contains **no Cajun/Creole label** — the brief's assumption that it
does is incorrect against the actual file.

**Cajun/Creole is therefore a curated overlay**, not Ahn data. It is a
hand-authored ingredient-prevalence prior (`CAJUN_PREVALENCE` in `build.mjs`)
laid over the canonical Ahn ingredient table — the holy trinity, the
spice/seafood/pork core, the filé/okra thickeners. Every Cajun/Creole field in
the output carries `curated: true`, and the UI labels it as curated so the
distinction is never hidden. The flavor network itself (nodes, compounds,
liaisons) remains 100% canonical Ahn data.

## Reproduce

```sh
pnpm --filter @rdm/liaison-build build
```

Writes `apps/site/public/liaison-graph.json` and prints a hand-check of known
pairings (coffee→beef, cocoa→coffee, strawberry→apple) plus the per-cuisine
shared-compound tendencies.
