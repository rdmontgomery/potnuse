# BENCHMARKS

What the benchmarks actually measure. The rule for this file: if a number is
named, you must be able to say what *one* of it means — one instance, one
score, one axis. Where the primary sources were unreachable from this
environment (arXiv PDFs 403, HuggingFace blocked) the claim is sourced to the
repo READMEs and is flagged.

Two benchmarks to start: **LongMemEval** (interactive long-term memory) and
**RULER** (synthetic long-context stress test). They were chosen because they
project onto *different* axes — LongMemEval varies how far back the evidence
sits in a real conversation; RULER varies how much distracting material sits
around a synthetic needle. Different shadows of (the wager goes) the same
object.

---

## LongMemEval

> Wu et al., "LongMemEval: Benchmarking Chat Assistants on Long-Term
> Interactive Memory," ICLR 2025. Repo: `xiaowu0162/LongMemEval`.

### What it is

A chat assistant is given a long, timestamped interaction history (the
*haystack* of past user/assistant sessions) and asked a question whose answer
is buried somewhere in that history. It tests memory in a *conversational*
setting, not a document-retrieval one: the evidence is something the user or
assistant said in an earlier session.

### Unit of evaluation

**One instance** = `{ haystack of timestamped chat sessions, one question, one
gold answer, evidence annotations }`.

- Each question decomposes into **1–6 evidence snippets**, each optionally
  timestamped; the turns carrying evidence are flagged `has_answer: true`.
  This is what lets you compute retrieval recall *and* end-to-end accuracy.
- **LongMemEval_S** ("small"): ~**40–50 sessions**, ~**115k tokens** of history
  per question. **LongMemEval_M** ("medium"): ~**500 sessions** per question.
  Same questions, deeper haystack — i.e. the haystack depth is itself a knob.
- An `oracle` variant strips the haystack down to evidence-only sessions, to
  separate the memory problem from the reasoning problem.

### Categories (subtasks) and counts

500 questions total in LongMemEval_S, across six question types:

| Question type | Count | What it probes |
|---|---:|---|
| `single-session-user` | 70 | Recall a fact the **user** stated in one past session. |
| `single-session-assistant` | 56 | Recall something the **assistant** said/produced in one session. |
| `single-session-preference` | 30 | Recall a user **preference** mentioned in passing. |
| `multi-session` | 133 | Synthesize/aggregate evidence spread across **several** sessions. |
| `temporal-reasoning` | 133 | Reason about **when** things happened, using timestamps. |
| `knowledge-update` | 78 | Track a fact that **changed** over time; answer with the latest. |

(70 + 56 + 30 + 133 + 133 + 78 = 500.)

Plus an **abstention** set: ~**30** questions (suffixed `_abs`) that ask about
events which never occurred. The correct behavior is to *decline*, not to
confabulate. Counted separately from the six types above.

### Scoring — what one number means

The official metric is **end-to-end QA accuracy**, not retrieval recall (the
README of downstream reimplementations is explicit that these are different
numbers, and many leaderboards quietly report the easier one).

Pipeline per question: (optionally retrieve from the haystack) → **generate an
answer** with the model under test → an **LLM judge (GPT-4o)** compares the
generated answer to the gold answer and emits a binary `autoeval_label`
(correct / incorrect). For abstention questions, "correct" = the model
declined to answer.

**One per-category number = the fraction of that category's questions the judge
marked correct.** Overall accuracy is the mean over questions. So a
`temporal-reasoning` accuracy of 0.62 means: of the 133 temporal-reasoning
questions, the judge accepted the model's answer on 62% of them.

> Note for our harness: a GPT-4o judge needs an OpenAI key we don't have here.
> `harness/score.py` ships a **lexical judge** (normalized overlap + abstention
> detection) as the offline default, and supports an Anthropic LLM-judge when a
> key is present. The lexical judge is a known-loose proxy; it is labeled as
> such in every result file so a 0.62 from it is never mistaken for an official
> 0.62.

### Knobs we can sweep

- **Evidence distance** — how many sessions back the evidence sits. The natural
  axis for a *retention / correlation-length* reading (see HYPOTHESIS.md).
- **Haystack depth** — S (≈40) vs M (≈500) sessions, same questions.
- **Question type** — the six categories are qualitatively different memory
  operations, not difficulty rungs of one operation.

---

## RULER

> Hsieh et al., "RULER: What's the Real Context Size of Your Long-Context
> Language Models?," 2024. Repo: `NVIDIA/RULER`.

### What it is

A **synthetic, fully configurable** long-context benchmark. It generalizes
needle-in-a-haystack: instead of one fixed needle, it varies the *type* and
*quantity* of needles and distractors, and sweeps the **context length** as the
primary axis. Because it is synthetic, every instance is generated to a target
length on demand — there is no fixed test set to leak.

### Unit of evaluation

**One instance** = `{ a synthetic context built to a target token length,
containing planted needle(s) among distractors, and a query }`. Many instances
(commonly ~500) are generated per `(task, length)` cell.

The difficulty knobs are explicit generator arguments:
`num_needle_k` (number of keys), `num_needle_v` (values per key),
`num_needle_q` (queries); key/value/query types from `{words, numbers, uuids}`;
haystack type from `{repeat, essay, needle}` (`needle` = hard distractors that
look like the target). **The number of distractors is a first-class argument** —
this is what makes RULER a distractor sweep.

### Categories (13 tasks across 4 categories)

| Category | Tasks | What it probes |
|---|---|---|
| **Retrieval** (8) | `niah_single_1/2/3`, `niah_multikey_1/2/3`, `niah_multivalue`, `niah_multiquery` | Find planted value(s). Variants scale # needles, # keys, # values, # queries, and distractor hardness. |
| **Multi-hop Tracing** (1) | `variable_tracking` (VT) | Follow a chain of variable assignments (`X1=a; X2=X1; …`) and report all aliases of a value. |
| **Aggregation** (2) | `common_words_extraction` (CWE), `freq_words_extraction` (FWE) | Return the most-common / most-frequent words across the whole context — no single needle, the answer is a *statistic* of the context. |
| **Question Answering** (2) | `qa_squad`, `qa_hotpot` | Real QA (SQuAD, HotpotQA) with the gold paragraph buried among distractor paragraphs. |

8 + 1 + 2 + 2 = 13.

### Scoring — what one number means

**Recall-based string matching.** The score for an instance is the fraction of
expected target strings found in the model's output:

- NIAH / multikey / multivalue / multiquery: are the planted value(s) present?
- VT: are *all* the variables in the chain reported?
- CWE / FWE: are the correct top words returned?
- QA: does the answer string match the gold span?

**One per-task number = mean recall over the instances at a given context
length.** So `niah_multikey_2 @ 32k = 0.88` means: averaged over the instances
generated at 32k tokens, 88% of the planted values were recovered.

### The context-length axis and "effective context length"

Standard sweep: **4k, 8k, 16k, 32k, 64k, 128k** (extensible upward). A model's
**effective context length** is the longest length at which it stays above a
threshold; RULER fixes the threshold at the **Llama-2-7B @ 4k baseline =
85.6%**. The headline RULER score is a (weighted) average of task accuracy
across lengths.

### Knobs we can sweep

- **Context length** — the primary axis (4k…128k).
- **Distractor load** — `num_needle_*` and haystack type. The natural axis for a
  *susceptibility / linear-response* reading: how fast does accuracy fall as
  you add distractors? (see HYPOTHESIS.md).
- **Needle/key/value/query type** — words vs numbers vs uuids changes the
  surface difficulty without changing the structure.

---

## Why these two, together

LongMemEval gives us a **distance** axis in a *real* conversation (how far back
the evidence sits); RULER gives us a **distractor-load** axis in a *synthetic*
context (how much noise surrounds the needle). An order parameter, if it
exists, should govern both: retention should decay with distance, and accuracy
should respond linearly (then collapse) with distractor load. Two benchmarks,
two axes, one object — that is the thing HYPOTHESIS.md tries to pin down and the
harness tries to measure.

## Sources

- LongMemEval repo — https://github.com/xiaowu0162/LongMemEval
- LongMemEval project page — https://xiaowu0162.github.io/long-mem-eval/
- LongMemEval (OpenReview, ICLR 2025) — https://openreview.net/forum?id=pZiyCaVuti
- Per-type counts cross-checked against — https://github.com/rohitg00/agentmemory/blob/main/benchmark/LONGMEMEVAL.md
- RULER repo — https://github.com/NVIDIA/RULER
- RULER tasks cross-checked against — https://github.com/EleutherAI/lm-evaluation-harness/blob/main/lm_eval/tasks/ruler/README.md

> Both arXiv PDFs (2410.10813, 2404.06654) returned HTTP 403 from this
> environment; the numbers above are sourced to the GitHub repos and the
> cross-check links, not the camera-ready PDFs. Re-verify against the PDFs when
> network allows.
