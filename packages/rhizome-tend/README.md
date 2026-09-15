# @rdm/rhizome-tend

The mechanical half of rhizome tending. Reads git and the content collections,
emits per-node signals and a proposed `state`. Reads no prose and makes no
judgement — that half lives in `.claude/skills/tend-rhizome/SKILL.md`.

```
pnpm --filter @rdm/rhizome-tend tend
pnpm --filter @rdm/rhizome-tend tend -- --json
pnpm --filter @rdm/rhizome-tend tend -- --since-days 60
```

Exit code is 1 when there is something to review, 0 on a quiet month, so a
scheduled run can stay silent.

## What it measures

`state` encodes tending, not age. Age already has a channel — the temporal
field on `/rhizome` renders it — so a state derived from age would be a second
view of one variable. What state adds is whether the rhizome is still growing
into a node.

The order parameter is **inbound-link accrual normalised by corpus growth**: a
node is settled if its in-degree keeps pace as the corpus expands, fossilised
if it flatlines while everything around it grows. Thresholds live in
`src/rules.ts`.

Two decisions worth not undoing:

- **Frontmatter-only commits do not count as edits.** Frontmatter churn is what
  the tending routine itself writes; counting it would let every run reset
  every node's clock and nothing would settle. Classification is by diff hunk
  line numbers against the frontmatter fence at that revision, which is exact —
  guessing from diff text cannot tell a markdown bullet from a YAML list item.
- **Accrual is `null`, not `0`, when the corpus did not grow.** That is a
  missing denominator, not a stagnant node. `fossil` likewise requires corpus
  growth as evidence rather than mere silence.

## Layout

| file | role |
|---|---|
| `graph.ts` | frontmatter and `STATIC_NODES` parsing, in-degree — pure |
| `rules.ts` | thresholds, accrual, state proposal — pure |
| `git.ts` | every bit of I/O in the package |
| `observe.ts` | samples two revisions, builds signals |
| `report.ts` | table rendering |
| `cli.ts` | entry point |

Unlike `@rdm/tape`, this package is CLI-only and never runs in a Worker, so
`node:` imports are fine.
