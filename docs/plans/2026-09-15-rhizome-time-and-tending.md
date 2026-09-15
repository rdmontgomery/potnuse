# rhizome: temporal field + a tending routine

Two changes to `/rhizome`. The first is shipped in this commit: nodes carry a
date and a uniform vertical field, so the graph acquires a time gradient. The
second is a proposal: a scheduled routine that advances `state`.

## Part one — the temporal field (shipped)

Every node already had a `date` in frontmatter; it just never reached the
client. It does now, and drives two things.

**Charge.** Each dated node gets a charge in `[-1, +1]`, newest positive. The
mapping blends two normalisations:

- **calendar** — position within `[tMin, tMax]`. Honest about gaps, but
  collapses a burst into one indistinguishable band.
- **rank** — position in the sorted order. Spreads evenly, but lies about the
  quiet months.

`TIME_RANK_MIX = 0.5` splits the difference. With the current corpus — nine
nodes inside three weeks of April/May, then a four-month gap, then
`foundation-block` — the blend keeps the spring flurry legible *as a cluster*
while the gap stays visibly a gap. Pure calendar would stack nine dots on one
line; pure rank would erase the summer.

Charges are then re-centred to sum to zero. Without that, a corpus skewed old
carries a net downward force and the whole graph sags off-centre rather than
tilting.

**The field itself** is uniform — `vy -= charge * FIELD` — not a spring toward
a target height. This matters. A spring-to-target is a layered layout wearing
a physics costume: it dictates where each node goes and topology can only
perturb it. A uniform field applies the same force regardless of displacement,
so link tension can genuinely win, and a well-connected old node visibly
*resists* being pushed down. That resistance is the interesting signal. An
arborescent time axis would be the wrong object for a page named rhizome; a
bias that topology can overrule is the right one.

Cost: the field cannot guarantee spacing. Measured against the current graph,
link tension compresses the nominal span by roughly 45%, which is why `FIELD`
is tuned to 5.5 rather than the 3.0 the arithmetic suggests.

**Two readability layers** on top:

- A **time axis** — one faint rule per month that has nodes, labelled in the
  left gutter. The rule rides the *actual* mean y of that month's nodes,
  recomputed per frame, not the field's nominal equilibrium. A gridline that
  sits where the nodes aren't is worse than no gridline.
- A **recency glow** — a radial halo decaying over 45 days. This is the direct
  answer to "which of these is new?", and it does not depend on the reader
  correctly decoding vertical position.

Plus a `time field` toggle. Turning it off relaxes to pure topology, which
answers a question the static layout cannot: *is this cluster thematic or just
contemporaneous?*

`prefers-reduced-motion` gets the field with no ramp animation; the layout
still stratifies.

---

## Part two — the tending routine (proposal)

### The objection first

`state` is currently dead. Ten content nodes, nine of them `seedling`, so the
breathing rates that encode state render an almost uniform map.

The obvious fix is a cron that bumps state on a timer. Don't do that. If
`state` becomes a function of age, it duplicates `date` — and `date` now has
its own channel in the layout. Two visual variables showing one quantity is a
regression dressed as a feature.

And the mechanical part needs no agent at all. `daysSince(lastEdit) > 90` is a
build-time expression. Paying for a model to evaluate it monthly is theatre.

### The reframe: state is about tending, not age

Make `state` encode something the date cannot: **whether the rhizome is still
growing into this node.**

| state | meaning | signal |
|---|---|---|
| `seedling` | exists, not yet woven in | low in-degree, recently created |
| `germinating` | actively accruing edges or edits | in-degree or content changed since last run |
| `stable` | settled, still cited by newer work | no recent edits, but newer nodes still link in |
| `fossil` | the corpus grew past it | no edits *and* no new inbound links across N runs |

The order parameter is concrete and measurable from git: **inbound-link
accrual rate, normalised by corpus growth.** A node is `stable` if its
in-degree keeps pace as the corpus expands; `fossil` if it flatlines while
everything around it grows. That is a birth-death process on citations, and it
is the same quantity a memory benchmark has to define. The rhizome is n=12 —
a toy — but it is a toy with real data, which beats another analogy.

Current in-degrees, for calibration:

```
 8  mumford-magick        4  allons-jouer         2  ladder
 4  necromantic-circle    4  care-for-an-esper    2  calibrate
 3  colophon              3  toner-tu-map         2  foundation-block
 3  dsl-hobbies           1  invisible-ink        0  primer
```

`primer` is an orphan — nothing links to it. `mumford-magick` is the hub. That
spread is already informative and currently invisible.

### Architecture

Split by what actually needs reading.

**Mechanical pass** — `@rdm/rhizome-tend`, plain Node, no model. Shipped as a
workspace package rather than a loose `scripts/` file because vitest only globs
`packages/*/src/**`, and the pure parts of this deserve tests.

It reconstructs the whole graph at arbitrary git revisions — `git ls-tree` plus
`git show`, no `astro:content` — and diffs two samples. Per node: creation date,
last *prose* edit, in-degree, in-degree delta, corpus delta, accrual, and a
proposed state with the numbers attached. Exit 1 when there is something to
review, 0 on a quiet month.

Two calls worth recording. Frontmatter-only commits do not count as edits,
because frontmatter churn is what this routine writes — counting it would let
each run reset every node's clock and nothing would ever settle; classification
is by diff hunk line numbers against the frontmatter fence, which is exact where
reading the diff text cannot distinguish a markdown bullet from a YAML list
item. And node age comes from frontmatter, not the git add date: several nodes
were committed weeks after they were written, and the ladder should not disagree
with the map about how old something is.

**Judgment pass** — the agent. Reads the script's output, then reads the
content for every node it proposes to change. Overrides the arithmetic where
reading contradicts it. Then does the part that genuinely needs a model:

- propose new `connects` edges between nodes that share substance but no link
- flag orphans (`primer`, today)
- flag pages that exist but aren't in the graph at all — `landman`, `lift`,
  `miette/piglet` are live routes and invisible to `/rhizome` because they're
  missing from `STATIC_NODES`
- flag a `stable` node contradicted by something newer

**Output** — one PR titled `rhizome: tending YYYY-MM`, with the numbers in the
body and a one-line justification per state change. Never auto-merged. State
is content, and content is voice.

### Wiring

A Routine (`create_trigger`, fresh session per fire), whose prompt is one
line: follow `.claude/skills/tend-rhizome/SKILL.md`. The logic lives in git,
versioned and reviewable, not buried in a trigger's prompt field where it
can't be diffed. The skill is written and checked in; the Routine itself is
not created yet — say the word.

**Monthly, not weekly.** At roughly two posts a month a weekly run has nothing
to say, and a routine that mostly produces empty PRs trains you to stop
reading them. Hard rule: no proposed changes, no PR, no message.

### One bug, while we're here

`CLAUDE.md` documents the ladder as `seedling → germinating → stable →
fossil`. Botanically that's backwards — germination precedes the seedling.
Your own phrasing had it the right way round. Either fix the order (a rename
across twelve files and one enum) or keep it and say somewhere that the
sequence is metaphorical, not horticultural. Cheapest moment to decide is
before a routine starts writing the field automatically.

### Out of scope

Automatic edge *insertion*. Proposing edges is cheap and reversible; writing
them without review lets the routine slowly rewrite the graph's argument.
