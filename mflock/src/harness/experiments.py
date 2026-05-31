"""Contamination-free order-parameter experiments that need no model API.

`phi_coherence`: the cleanest test of the polarization claim. Polarization phi
is computed from turn *texts* alone — no grading, no model under test — so we
can test it directly. Build conversations along a coherence gradient and check
whether phi orders them the way the flocking picture predicts:

    phi(focused) > phi(drifting) > phi(scattered)

If a tightly-aligned discourse does not magnetize more than a scattered one,
the polarization order parameter is dead on arrival.

Caveat stamped on the result: the default embedder is a character-trigram hash,
so phi here measures *lexical* cohesion as a proxy for the semantic alignment a
learned embedder would capture. The prediction is about direction, not absolute
value. Swap order_params.default_embed for a real model to sharpen it.
"""

from __future__ import annotations

import json
import time
from pathlib import Path

from mflock import order_params

RESULTS_DIR = Path(__file__).resolve().parents[2] / "results"

# Three conversations, same length, descending coherence.
CONVERSATIONS: dict[str, list[str]] = {
    "focused": [
        "I'm training for my first marathon in the fall, how should I build mileage?",
        "Increase your weekly running mileage by about ten percent each week.",
        "What should my long run look like in marathon training?",
        "Your long run should build toward twenty miles, run at an easy conversational pace.",
        "How important is the taper before the marathon?",
        "Very important, cut your running mileage back sharply in the final two weeks before the race.",
    ],
    "drifting": [
        "I'm training for my first marathon in the fall, how should I build mileage?",
        "Increase your weekly running mileage by about ten percent each week.",
        "Speaking of which, what should I be eating to fuel all this running?",
        "Prioritize carbohydrates around long runs and keep your protein steady through the week.",
        "We're also planning a trip to Lisbon after the race, any neighborhood tips?",
        "Stay near Principe Real, it's central and walkable with good cafes.",
    ],
    "scattered": [
        "I'm training for my first marathon in the fall, how should I build mileage?",
        "Quantum error correction needs many physical qubits to make one logical qubit.",
        "What's the secret to a really sour sourdough loaf?",
        "Depreciation schedules for commercial real estate run twenty-seven and a half years.",
        "How do I shift cleanly into thumb position on the cello?",
        "The eruption column at Pinatubo in 1991 reached the stratosphere within hours.",
    ],
}


def run() -> dict:
    rows = []
    for name, turns in CONVERSATIONS.items():
        phi = order_params.polarization(turns)
        rows.append({"conversation": name, "n_turns": len(turns), "phi": phi})
    rows.sort(key=lambda r: r["phi"], reverse=True)

    order = [r["conversation"] for r in rows]
    prediction_holds = order == ["focused", "drifting", "scattered"]
    return {
        "kind": "mflock-phi-coherence",
        "timestamp": time.strftime("%Y%m%d-%H%M%S"),
        "embedder": "default hashing (character-trigram); lexical-cohesion proxy",
        "prediction": "phi(focused) > phi(drifting) > phi(scattered)",
        "observed_order": order,
        "prediction_holds": prediction_holds,
        "rows": rows,
    }


def main() -> None:
    result = run()
    print("[phi-coherence] prediction:", result["prediction"])
    for r in result["rows"]:
        print(f"  {r['conversation']:<10} phi = {r['phi']:.4f}")
    print(f"[phi-coherence] observed order: {' > '.join(result['observed_order'])}")
    print(f"[phi-coherence] prediction holds: {result['prediction_holds']}")

    RESULTS_DIR.mkdir(parents=True, exist_ok=True)
    out = RESULTS_DIR / "phi_coherence.json"
    out.write_text(json.dumps(result, indent=2))
    print(f"[phi-coherence] wrote {out}")


if __name__ == "__main__":
    main()
