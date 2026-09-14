# mflock

**Memory-flocking.** A memory-eval harness whose output is meant to force a
concrete, empirical definition of the *discourse order parameter*.

The framing lives in [THESIS.md](./THESIS.md) (and in the companion site node
`discourse-active-matter`). The one-line version: discourse is a driven,
dissipative active-matter system; meaning is the collective order that emerges
when utterances align; that order has an *order parameter*; and the wager is
that **existing memory benchmarks already measure a projection of it without
knowing.** This repo's job is to find the projection.

The method is deliberately empirical. We don't argue the order parameter into
existence — we implement three candidate definitions as pure functions over a
conversation trace ([`src/mflock/order_params.py`](./src/mflock/order_params.py)),
run real memory benchmarks through a model
([`src/harness/`](./src/harness/)), and check whether benchmark scores move the
way an order parameter would predict. If they collapse onto one curve against
the right slow variable, the wager pays out. If they don't, the framework is
decorative and gets retired.

## What's here

| Path | What it is |
|---|---|
| `THESIS.md` | The mflock framing (stub; Rick pastes it). |
| `BENCHMARKS.md` | What LongMemEval and RULER actually measure — unit of evaluation and scoring, per subtask. |
| `HYPOTHESIS.md` | The benchmark-category → order-parameter mapping, with the no-clean-analog cases flagged as research questions. |
| `src/mflock/order_params.py` | The three candidate order parameters. |
| `src/harness/adapters.py` | Benchmark loaders (HF `datasets`, with a bundled offline fixture). |
| `src/harness/run.py` | Runs a slice against the Anthropic API (or an offline mock). |
| `src/harness/score.py` | Per-category accuracy + order-parameter values → `results/*.json` and an embeddable `results/index.html`. |
| `data/` | Downloaded benchmark slices (gitignored). |
| `results/` | Run JSON + HTML report (gitignored). |

## Quickstart

Requires [uv](https://docs.astral.sh/uv/).

```sh
# install deps into a managed venv
uv sync

# sanity check
uv run python -c "import mflock; print(mflock.__version__)"

# run one LongMemEval slice end-to-end.
# with a key, it hits the real API; without one, it uses the offline mock model.
export ANTHROPIC_API_KEY=sk-...        # optional
uv run mflock-run   --slice 8          # writes results/raw_<ts>.json
uv run mflock-score                    # writes results/run_<ts>.json + results/index.html
```

Open `results/index.html` in a browser — it is self-contained (no external
deps) and embeddable directly into the blog.

### Offline by default

HuggingFace is not reachable from every environment (this one blocks it). The
harness ships a small LongMemEval-shaped fixture under
`src/harness/fixtures/`, so the full pipeline runs end-to-end with no network
and no API key. Point it at the real dataset with `--source hf` once `datasets`
can reach the hub.

## Status

Greenfield. Built ship-criteria-first: one LongMemEval slice runs end-to-end
and produces one JSON + one HTML before any breadth or polish. Everything here
is an early, ugly, working version — expect the order-parameter definitions and
the scoring judge to sharpen as real runs come in.
