"""Benchmark loaders.

Loads a small LongMemEval slice into a normalized *instance* schema that the
rest of the harness and the order parameters agree on:

    instance = {
        "question_id": str,
        "question_type": str,          # one of the six types, or "abstention"
        "question": str,
        "answer": str,                 # gold answer ("" for abstention)
        "abstention": bool,
        "haystack_sessions": [
            {
                "session_id": str,
                "session_idx": int,    # 0 = oldest, len-1 = most recent
                "timestamp": str,      # ISO date
                "turns": [ {"role", "content", "has_answer"} ],
            },
            ...
        ],
        # derived, computed here so downstream code never recomputes:
        "n_sessions": int,             # haystack depth  (distractor-load proxy)
        "evidence_distance": int,      # sessions between newest evidence and the
                                       # end of the haystack (recency of evidence)
    }

Source priority: the real dataset via HuggingFace ``datasets`` when reachable,
otherwise the bundled fixture under ``fixtures/``. This environment blocks
HuggingFace, so ``fixture`` is the default and what the ship-criteria run uses.
"""

from __future__ import annotations

import json
from pathlib import Path
from typing import Any

FIXTURE_PATH = Path(__file__).parent / "fixtures" / "longmemeval_slice.json"

# The six LongMemEval question types, in the order we report them.
QUESTION_TYPES = [
    "single-session-user",
    "single-session-assistant",
    "single-session-preference",
    "multi-session",
    "temporal-reasoning",
    "knowledge-update",
]


def _enrich(instance: dict[str, Any]) -> dict[str, Any]:
    """Fill session_idx and the derived n_sessions / evidence_distance fields."""
    sessions = instance["haystack_sessions"]
    n = len(sessions)
    evidence_idxs = []
    for i, sess in enumerate(sessions):
        sess["session_idx"] = i
        if any(t.get("has_answer") for t in sess["turns"]):
            evidence_idxs.append(i)
    instance["n_sessions"] = n
    # distance = how far back the *most recent* piece of evidence sits from the
    # end of the conversation. 0 = evidence is in the last session.
    if evidence_idxs:
        instance["evidence_distance"] = (n - 1) - max(evidence_idxs)
    else:
        # abstention questions have no evidence; treat as maximally distant.
        instance["evidence_distance"] = n - 1
    return instance


def render_history(instance: dict[str, Any]) -> str:
    """Render the haystack as a flat, timestamped transcript for the prompt."""
    lines: list[str] = []
    for sess in instance["haystack_sessions"]:
        lines.append(f"=== Session {sess['session_idx'] + 1} ({sess['timestamp']}) ===")
        for turn in sess["turns"]:
            speaker = "User" if turn["role"] == "user" else "Assistant"
            lines.append(f"{speaker}: {turn['content']}")
        lines.append("")
    return "\n".join(lines).strip()


def turn_texts(instance: dict[str, Any]) -> list[str]:
    """Flat list of every turn's text, oldest first (for embedding/polarization)."""
    return [
        turn["content"]
        for sess in instance["haystack_sessions"]
        for turn in sess["turns"]
    ]


def load_fixture(n: int | None = None) -> list[dict[str, Any]]:
    data = json.loads(FIXTURE_PATH.read_text())
    instances = [_enrich(inst) for inst in data["instances"]]
    return instances[:n] if n else instances


def load_hf(n: int | None = None, name: str = "longmemeval_s") -> list[dict[str, Any]]:
    """Best-effort load of the real LongMemEval from HuggingFace.

    Kept correct and future-proof, but unreachable behind this environment's
    network allowlist. Normalizes the upstream schema into our instance schema.
    """
    from datasets import load_dataset  # imported lazily; heavy

    ds = load_dataset("xiaowu0162/LongMemEval", name, split="test")
    out: list[dict[str, Any]] = []
    for row in ds:
        sessions = []
        for s_idx, sess in enumerate(row["haystack_sessions"]):
            turns = [
                {
                    "role": t.get("role", "user"),
                    "content": t.get("content", ""),
                    "has_answer": bool(t.get("has_answer", False)),
                }
                for t in sess
            ]
            sessions.append(
                {
                    "session_id": str(s_idx),
                    "timestamp": row.get("haystack_dates", [None] * 999)[s_idx] or "",
                    "turns": turns,
                }
            )
        qid = str(row["question_id"])
        out.append(
            _enrich(
                {
                    "question_id": qid,
                    "question_type": row["question_type"],
                    "question": row["question"],
                    "answer": row.get("answer", ""),
                    "abstention": qid.endswith("_abs"),
                    "haystack_sessions": sessions,
                }
            )
        )
        if n and len(out) >= n:
            break
    return out


def load_slice(n: int | None = None, source: str = "fixture", **kw) -> list[dict[str, Any]]:
    """Load a LongMemEval slice. source in {"fixture", "hf"}."""
    if source == "hf":
        return load_hf(n, **kw)
    if source == "fixture":
        return load_fixture(n)
    raise ValueError(f"unknown source: {source!r} (expected 'fixture' or 'hf')")
