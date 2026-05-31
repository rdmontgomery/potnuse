"""Run a LongMemEval slice against a model and dump raw answers.

Two backends:

  * ``anthropic`` — the real API (reads ANTHROPIC_API_KEY). This is the run
    that produces science.
  * ``mock`` — a deterministic offline oracle whose accuracy *decays with
    evidence distance and haystack size on purpose*, so the whole pipeline and
    the order-parameter estimators run end-to-end with no network and no key.
    Its curves reflect the mock's built-in decay, NOT a real model. Every
    output file it writes is stamped ``"model": "mock"`` so a mock number is
    never mistaken for a real one.

``--model auto`` (default) picks ``anthropic`` iff ANTHROPIC_API_KEY is set,
else ``mock``.
"""

from __future__ import annotations

import argparse
import hashlib
import json
import os
import time
from pathlib import Path
from typing import Any

from harness import adapters

RESULTS_DIR = Path(__file__).resolve().parents[2] / "results"
DEFAULT_MODEL_NAME = "claude-haiku-4-5-20251001"

SYSTEM_PROMPT = (
    "You are answering a question about a long conversation history between a "
    "user and an assistant. Use ONLY the information in the history. Answer in "
    "one short sentence. If the history does not contain the answer, say you "
    "have no record of it rather than guessing."
)


def build_prompt(instance: dict[str, Any]) -> str:
    return (
        f"Conversation history:\n\n{adapters.render_history(instance)}\n\n"
        f"Question: {instance['question']}\n"
        "Answer:"
    )


# --------------------------------------------------------------------------- #
# backends
# --------------------------------------------------------------------------- #
class AnthropicModel:
    name = "anthropic"

    def __init__(self, model_name: str = DEFAULT_MODEL_NAME):
        from anthropic import Anthropic  # lazy

        self.model_name = model_name
        self.client = Anthropic()

    def answer(self, instance: dict[str, Any]) -> str:
        resp = self.client.messages.create(
            model=self.model_name,
            max_tokens=256,
            system=SYSTEM_PROMPT,
            messages=[{"role": "user", "content": build_prompt(instance)}],
        )
        return "".join(b.text for b in resp.content if b.type == "text").strip()


class MockModel:
    """Deterministic oracle with a built-in distance/load decay. Offline."""

    name = "mock"

    def __init__(self, model_name: str = "mock-decay-v1"):
        self.model_name = model_name

    @staticmethod
    def _u(seed: str) -> float:
        h = hashlib.sha256(seed.encode()).hexdigest()
        return int(h[:8], 16) / 0xFFFFFFFF

    def answer(self, instance: dict[str, Any]) -> str:
        d = instance["evidence_distance"]
        n = instance["n_sessions"]
        u = self._u(instance["question_id"])
        if instance["abstention"]:
            # abstain correctly more often than not, deterministically.
            if u < 0.65:
                return "I have no record of you mentioning that."
            return "You said it was a wonderful trip."  # confabulation
        # probability of recall falls with distance and haystack depth.
        p = max(0.05, min(0.98, 0.95 - 0.13 * d - 0.05 * max(0, n - 3)))
        if u < p:
            return f"Based on the history, {instance['answer']}."
        return "I have no record of that in our conversation."


def make_model(kind: str, model_name: str | None):
    if kind == "auto":
        kind = "anthropic" if os.environ.get("ANTHROPIC_API_KEY") else "mock"
    if kind == "anthropic":
        return AnthropicModel(model_name or DEFAULT_MODEL_NAME)
    if kind == "mock":
        return MockModel(model_name or "mock-decay-v1")
    raise ValueError(f"unknown model kind: {kind!r}")


def main() -> None:
    ap = argparse.ArgumentParser(description="Run a LongMemEval slice against a model.")
    ap.add_argument("--slice", type=int, default=None, help="number of instances (default: all)")
    ap.add_argument("--source", default="fixture", choices=["fixture", "hf"])
    ap.add_argument("--model", default="auto", choices=["auto", "anthropic", "mock"])
    ap.add_argument("--model-name", default=None)
    ap.add_argument("--out", default=str(RESULTS_DIR))
    args = ap.parse_args()

    instances = adapters.load_slice(args.slice, source=args.source)
    model = make_model(args.model, args.model_name)
    print(f"[run] {len(instances)} instances | source={args.source} | model={model.name} ({model.model_name})")

    records = []
    for i, inst in enumerate(instances, 1):
        ans = model.answer(inst)
        print(f"  [{i}/{len(instances)}] {inst['question_id']:<8} {inst['question_type']:<26} -> {ans[:70]}")
        rec = dict(inst)
        rec["model_answer"] = ans
        records.append(rec)

    out_dir = Path(args.out)
    out_dir.mkdir(parents=True, exist_ok=True)
    ts = time.strftime("%Y%m%d-%H%M%S")
    out_path = out_dir / f"raw_{ts}.json"
    payload = {
        "kind": "mflock-raw",
        "timestamp": ts,
        "source": args.source,
        "model": model.name,
        "model_name": model.model_name,
        "n_instances": len(records),
        "records": records,
    }
    out_path.write_text(json.dumps(payload, indent=2))
    print(f"[run] wrote {out_path}")


if __name__ == "__main__":
    main()
