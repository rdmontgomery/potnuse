"""Candidate order parameters for discourse-memory.

Three candidates, each a pure function over a conversation trace (or, for the
two that need outcomes, over a trace the demon has already acted on — i.e. with
per-fact recall labels attached). They are deliberately crude first cuts; the
point of the harness is to find out which one, if any, the memory benchmarks
are secretly measuring.

  1. polarization  phi = | mean of L2-normalized turn-embeddings |
     The flocking magnetization. phi -> 1 when the turns all point the same way
     in embedding space (a tightly aligned discourse), phi -> 0 when they are
     isotropic (a scattered one).

  2. retention(d)  = fraction of injected facts still retrievable at distance d
     The birth-death decay. Fit r(d) ~ exp(-d / xi) and read off xi, the
     correlation length of memory: how many sessions back the field stays
     coherent.

  3. susceptibility = d(accuracy) / d(distractor load)
     The linear response. How sharply the system answers a change in the
     driving field (distractors). Large |susceptibility| = near a transition.

Embeddings default to a dependency-free, deterministic hashing embedder so the
order parameters are reproducible and runnable offline. Swap in a real
embedding model via the ``embed_fn`` argument when you want the science.
"""

from __future__ import annotations

import hashlib
import math
from typing import Any, Callable, Sequence

import numpy as np


# --------------------------------------------------------------------------- #
# embeddings
# --------------------------------------------------------------------------- #
def default_embed(texts: Sequence[str], dim: int = 256) -> np.ndarray:
    """Deterministic hashing embedding over character trigrams.

    No network, no model weights. Each trigram is hashed to a bucket with a
    signed contribution; rows are L2-normalized. Crude, but stable and good
    enough to make polarization a real (if low-resolution) number offline.
    Returns an (n, dim) array of unit vectors.
    """
    vecs = np.zeros((len(texts), dim), dtype=np.float64)
    for i, text in enumerate(texts):
        t = f"  {text.lower()}  "
        for j in range(len(t) - 2):
            gram = t[j : j + 3]
            h = int(hashlib.md5(gram.encode()).hexdigest(), 16)
            bucket = h % dim
            sign = 1.0 if (h >> 8) & 1 else -1.0
            vecs[i, bucket] += sign
        norm = np.linalg.norm(vecs[i])
        if norm > 0:
            vecs[i] /= norm
    return vecs


# --------------------------------------------------------------------------- #
# 1. polarization  (flocking magnetization)
# --------------------------------------------------------------------------- #
def polarization(texts: Sequence[str], embed_fn: Callable[..., np.ndarray] = default_embed) -> float:
    """phi = | mean of L2-normalized turn embeddings |, in [0, 1]."""
    texts = [t for t in texts if t and t.strip()]
    if not texts:
        return 0.0
    embeds = embed_fn(texts)
    mean_vec = embeds.mean(axis=0)
    return float(np.linalg.norm(mean_vec))


# --------------------------------------------------------------------------- #
# 2. retention(d)  (birth-death decay)
# --------------------------------------------------------------------------- #
def retention_curve(distances: Sequence[int], recalled: Sequence[bool]) -> dict[int, dict[str, float]]:
    """Fraction of facts recalled, bucketed by integer distance d."""
    curve: dict[int, dict[str, float]] = {}
    by_d: dict[int, list[bool]] = {}
    for d, r in zip(distances, recalled):
        by_d.setdefault(int(d), []).append(bool(r))
    for d in sorted(by_d):
        hits = sum(by_d[d])
        n = len(by_d[d])
        curve[d] = {"n": n, "recalled": hits, "retention": hits / n}
    return curve


def retention_decay_length(distances: Sequence[int], recalled: Sequence[bool]) -> float | None:
    """Fit r(d) ~ exp(-d / xi); return the correlation length xi (in sessions).

    Returns None if there isn't enough signal to fit (e.g. all-recalled, or
    fewer than two distinct distances with positive retention).
    """
    curve = retention_curve(distances, recalled)
    pts = [(d, v["retention"]) for d, v in curve.items() if v["retention"] > 0]
    if len(pts) < 2:
        return None
    ds = np.array([p[0] for p in pts], dtype=float)
    rs = np.array([p[1] for p in pts], dtype=float)
    if np.allclose(rs, rs[0]):  # flat: infinite correlation length, no decay measured
        return math.inf
    logs = np.log(rs)
    slope, _ = np.polyfit(ds, logs, 1)
    if slope >= 0:  # retention not decaying with distance within this slice
        return math.inf
    return float(-1.0 / slope)


# --------------------------------------------------------------------------- #
# 3. susceptibility  (linear response)
# --------------------------------------------------------------------------- #
def retention_halfwidth(distances: Sequence[int], recalled: Sequence[bool], threshold: float = 0.5) -> float:
    """Distance at which retention first falls below ``threshold``.

    The cliff-detecting companion to ``retention_decay_length``: an exponential
    fit misses a sharp cutoff (a fixed memory window reads as flat-then-zero,
    not a smooth decay), so this returns the *width* of reliable memory — for a
    hard window of K sessions it recovers ~K. Returns inf if retention never
    drops below threshold within the observed range.
    """
    curve = retention_curve(distances, recalled)
    for d in sorted(curve):
        if curve[d]["retention"] < threshold:
            return float(d)
    return math.inf


def susceptibility(loads: Sequence[float], accuracies: Sequence[float]) -> float | None:
    """d(accuracy) / d(load): least-squares slope of accuracy vs distractor load.

    Negative = accuracy falls as load rises (the expected sign). Returns None
    if there is no variation in load to differentiate against.
    """
    x = np.asarray(loads, dtype=float)
    y = np.asarray(accuracies, dtype=float)
    if len(x) < 2 or np.allclose(x, x[0]):
        return None
    slope, _ = np.polyfit(x, y, 1)
    return float(slope)


# --------------------------------------------------------------------------- #
# bundle: compute all three over a judged slice
# --------------------------------------------------------------------------- #
def _turn_texts(instance: dict[str, Any]) -> list[str]:
    return [
        turn["content"]
        for sess in instance.get("haystack_sessions", [])
        for turn in sess.get("turns", [])
    ]


def order_parameters(judged: list[dict[str, Any]]) -> dict[str, Any]:
    """Compute the three candidate order parameters over a scored slice.

    Each ``judged`` instance is expected to carry: haystack_sessions,
    evidence_distance, n_sessions, abstention, and a boolean ``correct``.
    """
    # 1. polarization: per-instance phi, then averaged across the slice.
    phis = [polarization(_turn_texts(inst)) for inst in judged if _turn_texts(inst)]
    phi_mean = float(np.mean(phis)) if phis else 0.0

    # 2. retention: distance vs recall, over answerable (non-abstention) facts.
    answerable = [r for r in judged if not r.get("abstention")]
    distances = [r["evidence_distance"] for r in answerable]
    recalled = [bool(r.get("correct")) for r in answerable]
    curve = retention_curve(distances, recalled)
    xi = retention_decay_length(distances, recalled)
    d_half = retention_halfwidth(distances, recalled)

    # 3. susceptibility: accuracy vs haystack depth (distractor-load proxy).
    loads = [r["n_sessions"] for r in answerable]
    accs = [1.0 if r.get("correct") else 0.0 for r in answerable]
    chi = susceptibility(loads, accs)

    return {
        "polarization": {
            "phi_mean": phi_mean,
            "phi_per_instance": [
                {"question_id": inst["question_id"], "phi": polarization(_turn_texts(inst))}
                for inst in judged
                if _turn_texts(inst)
            ],
            "note": "flocking magnetization over hashing-embedded turns; swap embed_fn for a real model.",
        },
        "retention": {
            "curve": {str(k): v for k, v in curve.items()},
            "correlation_length_xi": (None if xi is None else (xi if math.isfinite(xi) else "inf")),
            "halfwidth_d_half": (d_half if math.isfinite(d_half) else "inf"),
            "note": "fraction recalled vs evidence distance (sessions); xi from r(d)~exp(-d/xi); d_half = distance where retention crosses 0.5 (recovers a hard memory window).",
        },
        "susceptibility": {
            "chi": chi,
            "axis": "n_sessions (haystack depth as distractor-load proxy)",
            "note": "d(accuracy)/d(load); negative = accuracy falls with load.",
        },
    }
