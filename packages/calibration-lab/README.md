# @rdm/calibration-lab

The lab behind the calibration talk at the Haze (deck: `/talks/calibration`,
source `apps/site/src/pages/talks/calibration.astro`). Python, run with `uv`.
`NOTES.md` is the long-form companion: every derivation, every result, and
where the analogies stop being formal.

One command reproduces every number in the deck:

```sh
cd packages/calibration-lab
uv sync --extra dev
uv run python -m lab.run                 # synthetic data, LSA encoder, ~8 min on 4 cores
uv run python -m lab.figures             # results -> apps/site/src/components/haze/*.astro + numbers.json
uv run --extra dev pytest -q             # 21 tests: metrics, maps, conformal, the loop
```

## Swapping in the real data

Nothing in the pipeline knows which dataset it is reading. The synthetic file
has the same columns as Kaggle's, plus a `truth.csv` sidecar with each row's
true probability; when the sidecar is absent every oracle metric switches off
and every figure falls back to label-only measures.

1. **Data.** Accept the rules at
   <https://www.kaggle.com/competitions/nlp-getting-started>, then either
   download `train.csv` from the Data tab or
   `kaggle competitions download -c nlp-getting-started && unzip nlp-getting-started.zip`.
   Put `train.csv` at `data/real/train.csv` (gitignored: competition data is
   not ours to redistribute). Only `train.csv` matters; `test.csv` has no labels.
2. **EmbeddingGemma.** Accept the Gemma licence at
   <https://huggingface.co/google/embeddinggemma-300m>, then
   `huggingface-cli login` (or `export HF_TOKEN=...`), then
   `uv sync --extra gemma --extra dev`. That pulls torch; on a Mac it will use
   MPS. The model card says float16 is unsupported; sentence-transformers
   loads it in float32 by default, which is correct.
3. **Run it.**
   ```sh
   uv run python -m lab.run --data data/real/train.csv --encoder lsa      # baseline, minutes
   uv run python -m lab.run --data data/real/train.csv --encoder gemma    # 5 prompt variants x 7.6k tweets
   uv run python -m lab.figures results/real-gemma
   ```
   The gemma run embeds the corpus once per task prefix (none,
   classification, clustering, search, custom) and caches each to `cache/`, so
   re-runs are fast. It also fills the task-prefix table and figure, which stay
   empty on the LSA runs.
4. **Optional heads.** `uv sync --extra tabpfn` then add `--tabpfn` for TabPFN
   as the nonlinear head (first 128 dims). TabPFN downloads its weights from
   Hugging Face on first use; newer releases are licence-gated there too.
5. **Optional Jev.** `export TYPESAFE_API_KEY=...`, `uv sync --extra jev`, add
   `--jev`. Scores the calibration and test splits (about 3,800 calls) against
   `POST https://api.typesafe.ai/v1/systemone` with the wire shape from
   `packages/jev-mock/src/protocol.ts`, caching every answer. Untested from the
   sandbox this was written in (no network to TypeSafe); check the first few
   responses by hand. Without a key, synthetic runs use a clearly labelled mock
   and real runs omit Jev.
6. **Look.** `pnpm dev` from the repo root, open
   `localhost:4321/talks/calibration`. Arrow keys move, `n` shows speaker
   notes, `f` is fullscreen, the URL hash is the slide number. Under 760px wide
   and in print it becomes a stacked reading version with notes inline.

## Layout

| file | what |
| --- | --- |
| `lab/synth.py` | synthetic Disaster Tweets with a known `p_true` per row |
| `lab/data.py` | loading, the stratified train / calibration / test split, the water-keyword drift split |
| `lab/embed.py` | LSA (offline) and EmbeddingGemma encoders, task prefixes, Matryoshka truncation, cache |
| `lab/models.py` | the ladder: keyword empirical Bayes, naive Bayes, TF-IDF LR and LightGBM, probes (ridge, unpenalised, MLP, TabPFN), the hard-wall sweep |
| `lab/jev.py` | Jev client and the synthetic-only mock |
| `lab/metrics.py` | Brier, log loss, Murphy, binned ECE, the Richardson sweep, the cumulative walk test, smooth ECE, labels needed |
| `lab/recal.py` | temperature, Platt, beta, isotonic, histogram binning, Venn-Abers |
| `lab/conformal.py` | split and Mondrian conformal sets, adaptive conformal inference |
| `lab/hitl.py` | the storm stream and the labeling-loop simulation |
| `lab/run.py` | everything above, in order, into `results/<data>-<encoder>/` |
| `lab/figures.py` | results -> themed SVG figures and the numbers the slides quote |

## Things that are deliberately simple

The split is one stratified 50/20/30 draw, not cross-fitted, so small
differences between models (third decimal of AUC) are inside the noise; the
summary's ECE values sit at a noise floor of about 0.015 for 2,284 test rows,
which is exactly what the ruler slide is about. The labeling loop scores the
same frozen model throughout; retraining the encoder head inside the loop is
the obvious next experiment and is not done here.
