"""Score raw answers into per-category accuracy -> results/run_<ts>.json.

Judges:
  * ``lexical`` (default, offline) — normalized token-overlap match, plus an
    abstention detector. A deliberately *loose* proxy for the official GPT-4o
    judge; labeled as such in every output so its numbers are never confused
    with leaderboard numbers.
  * ``llm`` — an Anthropic-model judge (needs ANTHROPIC_API_KEY).

Order-parameter values and the HTML report are layered on in later steps.
"""

from __future__ import annotations

import argparse
import json
import re
import time
from pathlib import Path
from typing import Any

from harness import adapters

RESULTS_DIR = Path(__file__).resolve().parents[2] / "results"

_STOP = {
    "a", "an", "the", "of", "to", "and", "with", "for", "in", "on", "is", "was",
    "i", "my", "me", "you", "your", "it", "that", "this", "based", "history",
}
_ABSTAIN_RE = re.compile(
    r"\b(no record|don'?t (?:have|recall|know)|not sure|no information|"
    r"never mentioned|cannot find|can'?t find|didn'?t (?:mention|say)|"
    r"nothing about|no mention)\b",
    re.IGNORECASE,
)


def _norm(s: str) -> str:
    return re.sub(r"[^a-z0-9]+", " ", s.lower()).strip()


def _content_tokens(s: str) -> list[str]:
    return [t for t in _norm(s).split() if len(t) >= 2 and t not in _STOP]


def lexical_correct(gold: str, answer: str, abstention: bool) -> bool:
    if abstention:
        return bool(_ABSTAIN_RE.search(answer))
    g = _norm(gold)
    a = _norm(answer)
    if g and g in a:
        return True
    gold_toks = _content_tokens(gold)
    if not gold_toks:
        return False
    ans_toks = set(_content_tokens(answer))
    recall = sum(1 for t in gold_toks if t in ans_toks) / len(gold_toks)
    return recall >= 0.6


def llm_correct(gold: str, answer: str, question: str, abstention: bool, client) -> bool:
    instruction = (
        "You are grading a memory benchmark answer. Reply with exactly 'YES' or "
        "'NO'.\n"
        + (
            "The correct behavior is to ABSTAIN (the question asks about something "
            "that never happened). Did the response abstain / decline to answer?"
            if abstention
            else "Is the response correct given the gold answer? Accept paraphrases."
        )
        + f"\n\nQuestion: {question}\nGold answer: {gold}\nResponse: {answer}"
    )
    resp = client.messages.create(
        model="claude-haiku-4-5-20251001",
        max_tokens=4,
        messages=[{"role": "user", "content": instruction}],
    )
    text = "".join(b.text for b in resp.content if b.type == "text").upper()
    return "YES" in text


def judge_records(records: list[dict[str, Any]], judge: str) -> list[dict[str, Any]]:
    client = None
    if judge == "llm":
        from anthropic import Anthropic

        client = Anthropic()
    judged = []
    for r in records:
        if judge == "llm":
            correct = llm_correct(r["answer"], r["model_answer"], r["question"], r["abstention"], client)
        else:
            correct = lexical_correct(r["answer"], r["model_answer"], r["abstention"])
        jr = dict(r)
        jr["correct"] = bool(correct)
        judged.append(jr)
    return judged


def per_category_accuracy(judged: list[dict[str, Any]]) -> dict[str, dict[str, float]]:
    cats = adapters.QUESTION_TYPES + ["abstention"]
    out: dict[str, dict[str, float]] = {}
    for cat in cats:
        rows = [r for r in judged if r["question_type"] == cat]
        if not rows:
            continue
        n_correct = sum(r["correct"] for r in rows)
        out[cat] = {"n": len(rows), "correct": n_correct, "accuracy": n_correct / len(rows)}
    return out


def latest_raw(results_dir: Path) -> Path:
    raws = sorted(results_dir.glob("raw_*.json"))
    if not raws:
        raise SystemExit(f"no raw_*.json in {results_dir} — run `mflock-run` first.")
    return raws[-1]


def main() -> None:
    ap = argparse.ArgumentParser(description="Score a raw run into per-category accuracy.")
    ap.add_argument("--raw", default=None, help="path to raw_*.json (default: latest)")
    ap.add_argument("--judge", default="lexical", choices=["lexical", "llm"])
    ap.add_argument("--out", default=str(RESULTS_DIR))
    args = ap.parse_args()

    out_dir = Path(args.out)
    raw_path = Path(args.raw) if args.raw else latest_raw(out_dir)
    raw = json.loads(raw_path.read_text())
    judged = judge_records(raw["records"], args.judge)
    per_cat = per_category_accuracy(judged)

    n = len(judged)
    overall = sum(r["correct"] for r in judged) / n if n else 0.0

    ts = time.strftime("%Y%m%d-%H%M%S")
    result = {
        "kind": "mflock-result",
        "timestamp": ts,
        "raw_file": raw_path.name,
        "model": raw.get("model"),
        "model_name": raw.get("model_name"),
        "source": raw.get("source"),
        "judge": args.judge,
        "n_instances": n,
        "overall_accuracy": overall,
        "per_category": per_cat,
    }
    out_dir.mkdir(parents=True, exist_ok=True)
    out_path = out_dir / f"run_{ts}.json"
    out_path.write_text(json.dumps(result, indent=2))

    print(f"[score] judge={args.judge} model={raw.get('model')} n={n} overall={overall:.3f}")
    for cat, d in per_cat.items():
        print(f"  {cat:<26} {d['accuracy']:.3f}  ({d['correct']}/{d['n']})")
    print(f"[score] wrote {out_path}")


if __name__ == "__main__":
    main()
