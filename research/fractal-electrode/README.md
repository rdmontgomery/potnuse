# fractal-electrode: the experiment behind "the fractal you should have grown"

Reproduces, from first-principles electrostatics, the claims and critiques in
the exchange `the fractal you should have grown`, and runs the inverse-design
experiment proposed in its closing margin.

Physical model: quasi-static conduction in a homogeneous electrolyte,
`div(sigma grad phi) = 0`, electrode at `phi = 1`, distant return at `phi = 0`.
The field on a "tissue plane" a fixed gap above the electrode is what
stimulates; the surface-charge density on the electrode is the harmonic measure.

## files

- `lib.py` — finite-volume Laplace/conduction solver (sparse), electrode
  geometry generators (solid pad, H-tree, dielectric-breakdown / DLA clusters
  with tunable dimension via the exponent eta), harmonic-measure and
  box-counting helpers.
- `partA.py` — forward comparison at fixed pixel footprint. Does a sparse
  fractal deliver the same field as a solid pad at a fraction of the coverage?
  Sweeps eta -> D. Writes `figs/A1_harmonic_measure.png`, `figs/A2_tradeoff.png`.
- `partB.py` — inverse design by topology optimization. A single feed must
  produce a multi-spot target field on the tissue plane under a tight metal
  (transparency) budget. Adjoint is hand-derived (conduction is self-adjoint).
  Writes `figs/B1_inverse_design.png`.
- `partB_robust.py` — re-runs the inverse design across target counts and
  budgets and records the emergent box-counting dimension.
- `replot_A.py` — regenerates the Part A summary figure from saved JSON.

Run: `python partA.py && python partB.py && python partB_robust.py`
(`--smoke` on partA/partB for a fast small-grid sanity check).

## headline results

- **The trade-off breaks.** A solid pad and a 24%-coverage H-tree deliver the
  *same* tissue field; a 14%-coverage DLA delivers ~89%. You can buy large
  optical transparency at near-zero field cost.
- **For raw efficiency, sparsity is the lever, not a magic dimension.** Across
  the achievable fractal regime, field-per-coverage is roughly D-independent.
- **But addressable, distributed stimulation does pick a dimension.** When the
  optimizer must route field from one feed to several separated targets under a
  transparency budget, it builds a branching tree whose box-counting dimension
  is **D = 1.27–1.40 (mean 1.34)** across configurations — the neuronal range,
  and *not* the H-tree's D -> 2.

## caveats

2D, quasi-static, single homogeneous medium. No electrochemistry, no
charge-injection limit, no double-layer, no biofouling or foreign-body
response. The emergent dimension is from box-counting a single optimised
structure per configuration. This is a thinking instrument, not a device model.
