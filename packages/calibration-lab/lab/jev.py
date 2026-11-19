"""Jev, one noul per tweet.

Two sources behind one function:

  real   POST https://api.typesafe.ai/v1/systemone with TYPESAFE_API_KEY,
         wire shape as transcribed in packages/jev-mock/src/protocol.ts.
         Untested from this sandbox (no network to typesafe.ai). Responses
         are cached to cache/jev-<hash>.json so a run is paid for once.
  mock   synthetic data only. A noisy view of the oracle, pushed toward "yes":
         z = logit(p_true) + N(0, 0.7); p = sigmoid(z + 0.5). The bias mirrors
         the one independent evaluation's finding that Jev's binary
         probabilities over-predict yes. It is a placeholder with the right
         shape, not a claim about Jev; every figure labels it as a mock.
"""

from __future__ import annotations

import hashlib
import json
import os
import time
from pathlib import Path

import numpy as np

from .metrics import logit, sigmoid

CACHE = Path(__file__).resolve().parent.parent / "cache"
ENDPOINT = "https://api.typesafe.ai/v1/systemone"
MODEL = os.environ.get("JEV_MODEL", "jev-latest")

QUESTION = {
    "real_disaster": {
        "type": "noul",
        "instructions": "Is this tweet reporting a real disaster, emergency or accident that is happening or just happened?",
        "criteria": {
            "true": "A real event: fire, flood, crash, attack, outbreak, storm damage, casualties.",
            "false": "Figurative use, jokes, song or film titles, products, drills, history, or general talk.",
        },
    }
}


def available() -> bool:
    return bool(os.environ.get("TYPESAFE_API_KEY"))


def _call(text: str, client) -> float:
    r = client.post(ENDPOINT, json={"state": text, "model": MODEL, "questions": QUESTION}, timeout=30)
    r.raise_for_status()
    return float(r.json()["answers"]["real_disaster"]["noul"])


def score_real(texts: list[str], concurrency_pause: float = 0.0) -> np.ndarray:
    import httpx

    CACHE.mkdir(exist_ok=True)
    key = hashlib.sha1(json.dumps([MODEL, QUESTION, texts]).encode()).hexdigest()[:16]
    f = CACHE / f"jev-{key}.json"
    done = json.loads(f.read_text()) if f.exists() else {}
    headers = {"Authorization": f"Bearer {os.environ['TYPESAFE_API_KEY']}"}
    with httpx.Client(headers=headers) as client:
        for i, t in enumerate(texts):
            if str(i) in done:
                continue
            for attempt in range(4):
                try:
                    done[str(i)] = _call(t, client)
                    break
                except Exception:
                    time.sleep(2 ** attempt)
            if i % 50 == 0:
                f.write_text(json.dumps(done))
            time.sleep(concurrency_pause)
    f.write_text(json.dumps(done))
    return np.array([done[str(i)] for i in range(len(texts))])


def score_mock(p_true: np.ndarray, seed: int = 7) -> np.ndarray:
    rng = np.random.default_rng(seed)
    z = logit(p_true) + rng.normal(0, 0.7, len(p_true))
    return sigmoid(z + 0.5)
