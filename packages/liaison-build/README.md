# @rdm/liaison-build

Build-time projection of the **Ahn et al. 2011 flavor network** into the single
static `liaison-graph.json` consumed by the `/liaison` page. No runtime fetch:
this runs against the committed `raw/` files and its output is committed too.

```sh
pnpm --filter @rdm/liaison-build build
# -> apps/site/public/liaison-graph.json
```

## The order parameter

```
liaison strength   w_ij = |compounds(i) ∩ compounds(j)|   (shared aroma compounds)
normalized         Jaccard = w_ij / (|Ci| + |Cj| − w_ij)
```

`build.mjs` projects the ingredient↔compound bipartite graph (`ingr_comp.tsv`)
down to ingredient↔ingredient by counting shared compounds per pair. Raw count
is the headline liaison strength; Jaccard is the normalized weight that corrects
trivially-similar near-twins (cocoa / roasted cocoa).

## Output shape

```jsonc
{
  "meta":   { "orderParameter", "normalized", "networkBaselineSharedPerPair",
              "source": { "sha256": { ... } }, ... },
  "cuisines": [ { "key", "label", "tendency", "curated", ... } ],
  "nodes":  [ { "id", "name", "category", "ncomp", "cuisines": {region: prevalence} } ],
  "adj":    { "<ingredient>": [ ["<neighbor>", shared, jaccard], ... up to topK ] }
}
```

## Cuisines & the Western prior

Per cuisine we compute ingredient prevalence and a **shared-compound tendency**:
the mean `w_ij` over pairs co-occurring in that cuisine's recipes minus the
network baseline. Western cuisines come out higher (they favor shared-compound
pairs), East Asian lower — the paper's central result, measured rather than
asserted, and surfaced in the UI.

`Cajun/Creole` is a **curated overlay** (flagged `curated: true`), not Ahn data —
see `PROVENANCE.md` for why and how.

## Provenance

See [`PROVENANCE.md`](./PROVENANCE.md): source mirror, sha256 digests, citation.
