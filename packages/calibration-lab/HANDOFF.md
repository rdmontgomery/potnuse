# Handoff: the Haze calibration talk

Paste this into a new session to continue the work. It describes the project, what was tried, what worked, what was rejected, and what comes next.

---

## Who and what

I'm Rick. I'm giving a 10–15 minute talk at the Haze (New Orleans). The announced title is **"enjoy your logits! cronopios, famas, and the rules engine."** What I told my group: *"If I can get my story straight, I want to historicize System One models into the general data science practice and give guidance on when to reach for which tool and how to avoid gotchas."*

System One models are TypeSafe's Jev and its kind: a model that reads text plus a typed question and returns a probability (`noul` = yes/no, `choice` = one of k, `score` = ordinal) instead of prose. The thesis we arrived at: **System One is a classifier with an instruction-following front end. New question, no training data; old kind of answer.** The output types are the oldest in ML; what may be new is zero-shot breadth and training aimed at honest probabilities (TypeSafe calls it RLCD; the architecture and objective are unpublished).

The through-line of the talk: **the box always outputs a belief; check it.** Classification and regression are both distributions over an answer space (finite set vs. the real line), and their natural losses are the same rule: −log of the probability you gave to what happened (cross-entropy for Bernoulli/categorical, squared error for a Gaussian of fixed width). Calibration asks whether that belief is honest. When you can't retrain the model (Jev, an LLM API, a vendor score), the only honesty you control is the map you put after it, and most people don't know they're supposed to build and maintain one.

## How I like to work

Terse, honest, no filler; push back on substance. I think in physics (statistical mechanics, my grad work was magnetoconductance fluctuations and quantum scarring in GaAs/AlGaAs billiards) and want analogies tested as formal claims, with the line drawn where they stop being formal. **Examples before abstractions**: I rejected a round of charts because nearly every one explained an abstraction nobody had been grounded in. I like charts built up one layer per click. I'll critique piecemeal and redirect a lot; ship drafts I can react to.

## Where everything lives

Repo `rdmontgomery/potnuse` (pnpm monorepo; site in `apps/site`, Astro), branch **`claude/friendly-carson-nswqj3`**. Don't deploy without asking me. No PR opened.

**`packages/calibration-lab/`**: Python lab, run with `uv`.
- `lab/synth.py`: synthetic stand-in for Kaggle's "NLP with Disaster Tweets" `train.csv` (same columns, 7,613 rows, base rate 0.43) with a `truth.csv` sidecar holding each row's true probability. Oracle AUC 0.89.
- `lab/data.py`: loading, stratified train/cal/test (50/20/30) split, water-keyword drift split.
- `lab/embed.py`: LSA (offline stand-in) and EmbeddingGemma (`google/embeddinggemma-300m`, task prefixes, Matryoshka truncation), cached.
- `lab/models.py`: keyword empirical Bayes, naive Bayes, TF-IDF + LR, TF-IDF + LightGBM, linear probe, unpenalised probe ("hard wall"), MLP head, TabPFN head (runs at its shipped softmax temperature and at T = 1; needs `ignore_pretraining_limits` on CPU).
- `lab/jev.py`: Jev client (`POST https://api.typesafe.ai/v1/systemone`, untested) plus a synthetic-only mock biased toward "yes".
- `lab/metrics.py`: Brier, log loss, Murphy decomposition, binned ECE, Richardson sweep, cumulative-walk KS test, smooth ECE, labels-needed.
- `lab/recal.py`: temperature, Platt, beta, isotonic, histogram, Venn-Abers.
- `lab/conformal.py`: split and Mondrian conformal, adaptive conformal inference.
- `lab/hitl.py`: storm stream plus labeling-loop simulation (flagged-only, uncertainty, random, stratified audit; windowed and per-segment refits).
- `lab/run.py` writes `results/<data>-<encoder>/results.json` and `summary.md`. `lab/examples.py` writes tweet-level `examples.json`. `lab/figures.py` emits SVG Astro components to `apps/site/src/components/haze/` plus `numbers.json`.
- `scripts/review_page.py` (round-two review artifact), `scripts/board_*.py` (whiteboard layout), `scripts/bundle_deck.py` (self-contained deck preview).
- `NOTES.md`: long-form derivations and nine pre-registered predictions for the real run. `README.md`: the swap runbook. 21 pytest tests pass.

**Site**: `/talks/calibration` (draft 1, 16 slides) and `/talks/cronopios` (draft 2, **rejected**; see below). Earlier related posts by me: `/experiments/what-jev-is-selling`, `/experiments/probability-you-can-count-on`, `/experiments/confidence-has-a-temperature`, plus `packages/jev-mock` (TypeScript mock, field report on real Jev judgments, calibration-loop skill).

**Artifacts (claude.ai, private to me)**:
- **Idea-grammar whiteboard** (the current working surface): https://claude.ai/artifact/X1E8ukYvyc1NFsJJzhUexv
- Figure review, round two (examples first; my notes in db collections `critiques` and `critiques-v2`): https://claude.ai/artifact/G4XNHnHfTKLG4HYr5UAY5v
- Deck draft 1 preview: https://claude.ai/artifact/QLYMVwbYB6SkJmWGNipkUD
- Deck draft 2 preview (rejected): https://claude.ai/artifact/H2NKzF555E7a2XQBkorT6S

## The whiteboard: current state of the story

Modules, each draggable:
1. **The pipeline, three times**: raw facts → features → box → Y, with features chosen by a person, then learned, then borrowed (frozen encoder + head).
2. **Y is a belief**: drawings of the classifier's two bars over −log p and the regression bell over its parabola. One rule for both losses. A table of answer spaces with their losses and links (GLMs; Jev's three types map to rows).
3. **Logistic regression as a two-state system**: energy, Fermi–Dirac occupation, log-partition (mean = slope, fluctuation = curvature), maximum likelihood = moment matching = Jaynes's maximum entropy, separable data → T → 0, and Platt = fitting a temperature (a = 1/T) and a chemical potential (b = μ/T).
4. **Who has a global loss?** Twelve-model table: objective, global?, proper?, probabilities out of the box.
5. **Is System One new?** A claim check (BERT heads 2018, zero-shot by entailment Yin et al. 2019).
6. **The honesty layer you own**: a five-step loop (serve and log; label two ways, including a random 2–3% audit with inclusion weights; fit per question and model version; ship only if it beats the old map on held-back labels; watch with a drift alarm plus weekly audit reliability), with one-time setup and serving code.
7. **Rules become weights**: hand-written rules → Cheng Lou's Handwired (if/else compiled into fixed-weight networks; known from secondary sources only) → differentiable programming → Software 2.0 → borrowed foundation models, plus the guardrails agentic engineering skips.
8. **Which map**: Platt worked on one Jev answer (0.997 → 0.956), plus a decision tree (identity / intercept only / Platt / beta / isotonic; segments; choice and score variants).
9. **Micro-judgments fanned out**: one tweet, five judgments (literal, current, hazard, speaker, severity). Readable rules vs. a learned logistic combiner. Calibrated judgments don't multiply into a calibrated decision, so the honesty layer becomes stacking.
10. **Every wall leaks**: the hard wall (if/else, T = 0), the soft wall (σ(z/T), leak ~ e^(−margin/T)), and the plumber (calibrated p = leak rate, audit = leak detector, drift alarm = pressure gauge, refit = repair visit).
11. **Which tool, when**: a decision tree. Truth never learnable → rank only. Rule known → code. Tabular → GBM/LR + Platt. Text with many labels and a stable question → embedding + head. A judgment → System One + calibration. Otherwise an LLM, using logprobs, never stated confidence.
12. **Timeline**: Brier 1950 → System One 2026.

**Proposed 10–15 minute spine**: timeline → the box outputs a belief (pipeline plus the two-answer-spaces picture) → which tool, when → the leaky wall and the plumber → the honesty layer as a recipe → gotchas. Backup / Q&A: logistic regression as a two-state system, Cover, the ruler, conformal.

## Results so far (synthetic data, LSA encoder; illustrative, not real)

- Naive Bayes is badly overconfident (ECE 0.186, fitted T = 9.3); Platt brings it to 0.027, beta to 0.019, with AUC unchanged. When naive Bayes says ≥ 0.95, only 76% are real: the same as the probe at 0.8 (82%).
- At 0.9 or more, the share that's real: probe 92%, naive Bayes 76%, keyword rates "shouted" (pushed to the extremes) 64%.
- **Cover / hard wall**: below about 2 labels per dimension the unpenalised head separates its training set; test ECE 0.23–0.27 vs 0.05–0.13 with L2. A head fitted on six tweets in the 2-D projection says 0.99 or 0.01 on 82% of tweets, and 20% of those calls are wrong.
- **Ruler**: a calibrated model's binned ECE grows like √(bins): slope 0.54, the coastline law with D = 1.5. The same honest model scores ECE 0.011 at 5 bins and 0.057 at 100. Even the oracle scores ECE 0.015 on 2,284 rows.
- **Conformal**: coverage holds for miscalibrated naive Bayes (91%). The best-calibrated keyword model covers real disasters only 81% of the time until Mondrian fixes it (92%).
- **Labels**: temperature wins below about 200 labels; Platt overtakes around 400; isotonic needs about 800.
- **Storm loop**: flagged-only review reports 0 misses vs 17 real per batch; uncertainty sampling reports 7; a weighted random audit reports 16.3. A frozen map is off by 13 points in calibration-in-the-large. Refitting on everything barely helps; a forgetting window plus per-family maps takes error vs truth from 0.056 to 0.015. In one batch, a map's 0.5 meant 59% real in the calm and 86% in the storm.
- Logistic regression is calibrated in the large on its training rows (mean p 0.43682 vs mean y 0.43683).

## Corrections made along the way (don't regress these)

- **"Conformal mapping"** is complex analysis. Conformal prediction gives marginal set coverage, not calibrated probabilities. Venn-Abers is the bridge.
- Selecting which items to label by the model's score does **not** bias P(y | score) inside the labeled region. It leaves the map undefined outside it and biases every aggregate (misses, recall, ECE).
- A classifier's uncertainty is **thermal (Boltzmann), not quantum**. Tunneling is a picture, not the equation; no amplitudes, nothing interferes.
- **Formal and classical** (fine to claim): ergodicity, hard vs soft walls, the Brownian ruler. Conductance fluctuations and scars are quantum and may be used only as an analogy for the measurement method.
- "Exchangeability is the ergodic hypothesis" is loose; it's the stronger cousin (de Finetti + ergodic decomposition).
- In the storm simulation, label shift needs a prior-corrected oracle, 4t / (4t + 1 − t), or the maps that follow the storm look wrong.

## What I rejected

- Too many charts explaining ungrounded abstractions (round one): the temperature curve, models scatter, Cover chart, log-log ruler, running-sum walk ("no idea what this is"), labels curve, drift diagram, Matryoshka.
- Recasting the deck with Cortázar's cronopios / famas / esperanzas as characters with dialogue interludes ("awful"). The title stays; the device doesn't.
- The quantum-cognition / order-effects idea is **off the talk** (research notes only).

## What's next, in priority order

1. **Real data run** (the critical path; everything so far is synthetic):
   - Kaggle `train.csv` → `packages/calibration-lab/data/real/train.csv`.
   - Accept the Gemma licence on Hugging Face, log in, then `uv sync --extra gemma --extra dev`.
   - `uv run python -m lab.run --data data/real/train.csv --encoder gemma --tabpfn`, then `lab.examples` and `lab.figures`, and check the nine predictions in `NOTES.md`.
2. **Head-to-head on real tweets**: TF-IDF + LR, EmbeddingGemma + head, Jev (needs a `TYPESAFE_API_KEY`), and an LLM's stated confidence vs logprobs. Measure AUC, calibration before and after Platt, labels needed, latency and cost per 1,000 calls. This table backs or corrects the which-tool tree.
3. **Label-starvation curve**: each tool trained or calibrated on 25 / 50 / 100 / 200 / 400 labels. The prediction is that Jev wins at low label counts and the embedding head catches up; the crossover is the guidance. Not built yet.
4. **Contamination check**: Disaster Tweets has been public since 2019. Score Jev on 200 originals vs meaning-preserving paraphrases; a drop means memorization and the need for fresh tweets.
5. **Fan-out in the lab**: mock micro-judgments from the synthetic generator's latent variables (register, keyword family, lean). Show the product of calibrated judgments drifting off honest and the logistic combiner fixing it. Then do it with real Jev.
6. **Optional dataset**: HumAID (Alam et al., 2021; about 77k crisis tweets, 19 real disasters, humanitarian categories) for real event-holdout drift and a natural choice question. Check licence and whether it ships text.
7. **Consolidate one gotchas slide**: per question and pinned version; thresholds need calibration; flagged-only reports zero misses; maps fitted in calm go stale; calibrated judgments don't multiply; stated confidence bunches; ECE needs its bins and n.
8. **Rebuild the deck** from the board's spine, examples first, with charts that step in per click. The `/talks/calibration` page machinery (stage scaling, notes, reading mode) is reusable.

## Environment gotchas

- The previous sandbox blocked Hugging Face, Kaggle, TypeSafe and many web hosts (PyPI and npm worked). Gemma, TabPFN weights and Jev were never run. Their code paths were checked against library source only.
- Use `UV_SYSTEM_CERTS=1` (unset `UV_NATIVE_TLS`) with uv there.
- The full pipeline takes about 8 minutes on 4 cores, with Venn-Abers in the labels curve the slow part. Use `--quick` while iterating.
- The whiteboard's content lives in its own store (written via ArtifactData, collection `elements`; its own rules apply). Read the board before changing it; never rebuild it.
- Repo rules (CLAUDE.md): confirm with me before deploying; nothing in the repo may sign a transaction; content goes in `apps/site/src/content`, design docs in `docs/plans`.
