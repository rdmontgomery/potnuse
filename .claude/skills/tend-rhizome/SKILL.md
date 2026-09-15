---
name: tend-rhizome
description: Monthly tending pass over the rhizome graph — advance node `state`, propose missing `connects` edges, and flag orphans, dangling links and unmapped routes. Use when asked to tend, prune, or groom the rhizome, or when fired by the rhizome tending Routine.
---

# tend-rhizome

A monthly pass that keeps `state` and `connects` honest. Half of it is
arithmetic and belongs to a script; the other half needs reading, and that half
is yours.

## The division of labour

`@rdm/rhizome-tend` computes every number: age, quiet days, in-degree, inbound
accrual normalised by corpus growth, and a proposed state per node. It reads no
content and makes no judgement.

You read the content. You override the arithmetic where reading contradicts it,
you propose the edges a graph walk cannot see, and you write the PR. You never
merge it.

## Procedure

### 1. Run the mechanical pass

```
pnpm --filter @rdm/rhizome-tend tend
```

Exit code 0 means nothing to review. **Stop there.** No PR, no comment, no
message to Rick. A routine that produces an empty PR every month teaches him to
stop opening them.

Exit code 1 means there are findings. `--json` gives the same report as
structured data; `--since-days N` changes the observation window from its
default of 120 days.

If the report prints the `no STATIC_NODES parsed` warning, the regex in
`packages/rhizome-tend/src/graph.ts` has drifted from
`apps/site/src/lib/graph.ts`. Fix that first — every in-degree involving a
static page is wrong until you do.

### 2. Read before you accept

For every node with a proposed state change, read the file. The script is
counting links and commits; it cannot tell a finished piece from an abandoned
one. Accept the proposal only if reading agrees.

Override it when reading says otherwise, and say so in the PR body. Cases that
come up:

- A `stable` proposal for a piece that is visibly a stub. It stopped being
  edited because it was abandoned, not because it settled. Leave it
  `seedling` and say why.
- A `fossil` proposal for a piece that is still correct and still the best
  entry point to its subject. Low traffic is not decay. Leave it `stable`.
- A `germinating` proposal driven by one inbound link from a piece that only
  mentions it in passing. Accrual of 1.0 on a corpus that grew by 1 is a small
  sample, not a trend.

### 3. Do the part the script cannot

- **Propose edges.** Look for nodes that share substance but no link. This is
  the highest-value output of the whole routine — a state bump changes a
  breathing rate, a new edge changes what the rhizome argues.
- **Orphans.** A node with zero inbound links is unreachable by the door.
  Propose the two or three edges that would weave it in.
- **Dangling connects.** `buildGraph` drops targets that match no node,
  silently. These are almost always typos and always worth fixing.
- **Unmapped routes.** Live pages missing from `STATIC_NODES` are invisible on
  `/rhizome`. Propose the entry, with a `description` and `connects` you wrote
  after reading the page.
- **Contradictions.** A `stable` node that newer work has since argued against
  is worth flagging in prose, even though no counter exists for it.

### 4. Write the PR

Branch `rhizome/tending-YYYY-MM`. Title `rhizome: tending YYYY-MM`.

Edit only `state:` and `connects:` in frontmatter, plus `STATIC_NODES` in
`apps/site/src/lib/graph.ts`. **Never edit prose.** The writing is Rick's voice
and this routine has no business in it.

The body carries the script's table verbatim, then one line per change with its
justification, then the proposals you could not make mechanically. Mark
overrides explicitly — the interesting content of the PR is where you disagreed
with the numbers and why.

Run `pnpm build` before pushing; a bad `connects` entry will not fail the build
but a malformed frontmatter block will.

Open the PR. Do not merge it, do not enable auto-merge, and do not push edge
insertions without review — proposing an edge is reversible, writing one lets
this routine slowly rewrite the graph's argument.

If last month's tending PR is still open, push to that branch instead of
opening a second one.

## Two things not to "fix"

**The script ignores frontmatter-only commits** when computing quiet days. That
is deliberate: frontmatter churn is exactly what this routine writes, so
counting it would let each run reset every node's clock and nothing would ever
settle.

**`accrual` is null, not zero, when the corpus did not grow.** A flat in-degree
during a month when nothing was published is a missing denominator, not a
stagnant node. The same reasoning is why `fossil` requires corpus growth as
evidence.

## Cadence

Monthly. At roughly two posts a month a weekly run has nothing to say.
