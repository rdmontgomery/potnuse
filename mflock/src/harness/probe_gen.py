"""Generate a hard LongMemEval-style probe designed to bend xi and chi.

The easy fixture saturates a real model (RESULTS.md, Experiment 2): xi=inf,
chi~0 because nothing perturbs it. This probe introduces a principled, scaling
difficulty: *recency interference*.

Every instance asks for one current value ("my current gym locker code"). The
true answer is planted once; then later sessions plant OTHER-referent numbers
of the same format (work locker, bike lock, wifi). The model must return the
gym code, resisting more-recent but wrong-referent lures. The further back the
true answer sits from the end (larger evidence_distance), the more competing
recent numbers there are -- so difficulty rises with distance by construction.
That is the mechanism meant to produce a measurable retention decay, and,
across the load axis, a non-zero susceptibility.

Deterministic (seeded) so the probe is reproducible. Writes the normalized
instance schema straight to fixtures/longmemeval_probe.json.
"""

from __future__ import annotations

import json
import random
from pathlib import Path

OUT = Path(__file__).parent / "fixtures" / "longmemeval_probe.json"

REFERENTS = ["gym locker", "work locker", "bike lock", "home wifi", "garage keypad", "office alarm"]

FILLER = [
    ("What's a good stretch for tight hamstrings?", "Try a standing forward fold and lying hamstring stretches."),
    ("Recommend a podcast for a long drive.", "Try a narrative history podcast like Revolutions."),
    ("How do I keep basil alive indoors?", "Bright light, water when the top soil dries, pinch the flowers."),
    ("Quick dinner idea for tonight?", "Sheet-pan chicken with whatever vegetables you have."),
    ("How often should I rotate my tires?", "Roughly every 8,000 to 12,000 kilometers."),
    ("What's a fair tip at a cafe?", "Rounding up or about ten percent is common."),
    ("Best way to defog a windshield fast?", "AC on, heat up, vent to the glass, crack a window."),
    ("How do I get espresso less bitter?", "Coarsen the grind a touch and shorten the shot."),
    ("Suggest a stretch break routine.", "Stand, roll your shoulders, and look at something far away."),
    ("What's a low-effort houseplant?", "A snake plant or a pothos is nearly unkillable."),
]


def _code(rng: random.Random) -> str:
    return f"{rng.randint(1000, 9999)}"


def _session(idx: int, date: str, turns):
    return {"session_id": f"s{idx}", "timestamp": date, "turns": turns}


def _date(i: int) -> str:
    # monotonic-ish dates, one per session
    m = 1 + (i // 28)
    d = 1 + (i % 28)
    return f"2026-{m:02d}-{d:02d}"


def build_instance(qid: str, depth: int, answer_idx: int, abstain: bool, rng: random.Random) -> dict:
    """One instance: gym code planted at answer_idx, lures planted after it."""
    target_ref = "gym locker"
    gold = _code(rng)
    # an older gym value (the lure for 'latest'), planted before the true answer
    old_gym = _code(rng)

    sessions = []
    for i in range(depth):
        if not abstain and i == max(1, answer_idx - 2):
            # the stale gym value, earlier
            turns = [
                {"role": "user", "content": f"Save my old gym locker code, it was {old_gym}.", "has_answer": False},
                {"role": "assistant", "content": f"Saved your old gym locker code {old_gym}.", "has_answer": False},
            ]
        elif not abstain and i == answer_idx:
            # the TRUE current answer
            turns = [
                {"role": "user", "content": f"I changed it -- my current {target_ref} code is now {gold}. Use this one.", "has_answer": True},
                {"role": "assistant", "content": f"Updated, your current {target_ref} code is {gold}.", "has_answer": False},
            ]
        elif i > (answer_idx if not abstain else -1) and rng.random() < 0.7:
            # recency lure: a DIFFERENT referent's number, stated more recently
            ref = rng.choice([r for r in REFERENTS if r != target_ref])
            lure = _code(rng)
            turns = [
                {"role": "user", "content": f"By the way my {ref} code is {lure}.", "has_answer": False},
                {"role": "assistant", "content": f"Noted, {ref} code {lure}.", "has_answer": False},
            ]
        else:
            q, a = rng.choice(FILLER)
            turns = [
                {"role": "user", "content": q, "has_answer": False},
                {"role": "assistant", "content": a, "has_answer": False},
            ]
        sessions.append(_session(i, _date(i), turns))

    if abstain:
        return {
            "question_id": qid,
            "question_type": "abstention",
            "question": "What is my current swimming pool locker code?",
            "answer": "",
            "abstention": True,
            "haystack_sessions": sessions,
        }
    return {
        "question_id": qid,
        "question_type": "knowledge-update",
        "question": f"What is my current {target_ref} code?",
        "answer": gold,
        "abstention": False,
        "haystack_sessions": sessions,
    }


def generate(seed: int = 7) -> dict:
    rng = random.Random(seed)
    instances = []
    # retention axis: vary how far back the true answer sits (more recency lures after it)
    # depth fixed-ish, answer_idx swept so evidence_distance spans 0..~8
    for k, dist in enumerate([0, 1, 2, 3, 4, 5, 6, 8]):
        depth = dist + 3  # ensure room before the answer
        answer_idx = depth - 1 - dist
        instances.append(build_instance(f"ku-d{dist}", depth, max(2, answer_idx), False, rng))
    # load axis: fix distance ~2, vary haystack depth (distractor load)
    for depth in [5, 7, 9, 11, 13, 15]:
        answer_idx = depth - 1 - 2
        instances.append(build_instance(f"ku-L{depth}", depth, answer_idx, False, rng))
    # abstention traps: pool code never given, only other referents present
    for j, depth in enumerate([6, 9, 12]):
        instances.append(build_instance(f"abs-{j}", depth, 0, True, rng))
    return {
        "name": "longmemeval_probe",
        "variant": "recency-interference",
        "note": "Hard probe: 'current gym code' under recency interference from other-referent number lures planted in later sessions. Difficulty scales with evidence_distance by construction. Plus pool-code abstention traps. Deterministic (seed=7).",
        "instances": instances,
    }


def main() -> None:
    data = generate()
    OUT.write_text(json.dumps(data, indent=2))
    print(f"[probe-gen] wrote {len(data['instances'])} instances to {OUT}")


if __name__ == "__main__":
    main()
