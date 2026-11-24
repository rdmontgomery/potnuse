"""The honesty layer: a logistic regression on Jev's own log-odds.

One map per (question id, question wording, model version). Fit on labels Jev
never saw; ship a new map only if it beats the current one on the newest
held-back labels; serve with two numbers.

    from lab.honesty import fit_map, apply_map, should_ship, threshold

    m = fit_map(noul, y, weight=w)            # noul: Jev's answers[q].noul
    p = apply_map(m, new_noul)                # honest probabilities
    act = p >= threshold(c_fp=1, c_fn=4)      # 0.2

Use `noul` for yes/no questions and the `probabilities` dict for choice
questions. Never the `confidence` field: it summarises how peaked the
distribution is, not the chance the favourite is right.
"""

from __future__ import annotations

import numpy as np
from scipy.optimize import minimize_scalar
from sklearn.linear_model import LogisticRegression

EPS = 1e-4  # Jev says 0.999 often; logit(1) is infinite


def logit(p):
    p = np.clip(np.asarray(p, float), EPS, 1 - EPS)
    return np.log(p / (1 - p))


def sigmoid(z):
    return 1 / (1 + np.exp(-np.asarray(z, float)))


# ---------------------------------------------------------------- yes / no


def fit_map(noul, y, weight=None, segment=None, kind="platt"):
    """Fit p = sigmoid(a * logit(noul) + b [+ b_segment]).

    kind="platt"      two numbers: a (1/temperature) and b (shift). Default.
    kind="intercept"  one number, a fixed at 1: only the base rate moved.
                      Use it with a few dozen labels.
    weight            1 / (chance the item was picked for labelling), so a
                      random audit stands for everything it was drawn from.
    segment           optional labels (e.g. "water", "dry"): one slope, an
                      intercept per segment. Still one logistic regression.
    """
    z = logit(noul)
    y = np.asarray(y, int)
    X = z[:, None]
    segs = None
    if segment is not None:
        segs = sorted(set(segment))
        X = np.column_stack([z] + [(np.asarray(segment) == s).astype(float) for s in segs[1:]])
    if kind == "intercept":
        # fit only b: maximise the likelihood of sigmoid(z + b)
        w = np.ones(len(y)) if weight is None else np.asarray(weight, float)

        def nll(b):
            p = np.clip(sigmoid(z + b), 1e-9, 1 - 1e-9)
            return -np.sum(w * (y * np.log(p) + (1 - y) * np.log(1 - p)))

        b = minimize_scalar(nll, bounds=(-10, 10), method="bounded").x
        return {"kind": "intercept", "a": 1.0, "b": float(b), "segments": None, "n": int(len(y))}
    # C large = essentially unpenalised; a little L2 keeps a separable
    # calibration set from sending the slope to infinity (the hard wall)
    lr = LogisticRegression(C=1e4, max_iter=1000).fit(X, y, sample_weight=weight)
    m = {"kind": "platt", "a": float(lr.coef_[0, 0]), "b": float(lr.intercept_[0]), "n": int(len(y)), "segments": None}
    if segs:
        m["segments"] = {segs[0]: 0.0, **{s: float(c) for s, c in zip(segs[1:], lr.coef_[0, 1:])}}
    return m


def apply_map(m, noul, segment=None):
    z = m["a"] * logit(noul) + m["b"]
    if m.get("segments") and segment is not None:
        z = z + np.array([m["segments"].get(s, 0.0) for s in segment])
    return sigmoid(z)


# ---------------------------------------------------------------- choice


def fit_temperature(probs, y_index, weight=None):
    """Choice questions: one temperature on the log-probabilities.

    probs: (n, k) array of Jev's `probabilities` in a fixed option order.
    y_index: the index of the option that turned out right.
    Returns T; T > 1 means Jev was too sure and the map softens it.
    """
    L = np.log(np.clip(np.asarray(probs, float), EPS, 1.0))
    y_index = np.asarray(y_index, int)
    w = np.ones(len(y_index)) if weight is None else np.asarray(weight, float)

    def nll(log_t):
        s = L / np.exp(log_t)
        s = s - s.max(1, keepdims=True)
        logp = s - np.log(np.exp(s).sum(1, keepdims=True))
        return -np.sum(w * logp[np.arange(len(y_index)), y_index])

    return float(np.exp(minimize_scalar(nll, bounds=(-3, 3), method="bounded").x))


def apply_temperature(T, probs):
    s = np.log(np.clip(np.asarray(probs, float), EPS, 1.0)) / T
    s = s - s.max(1, keepdims=True)
    e = np.exp(s)
    return e / e.sum(1, keepdims=True)


# ---------------------------------------------------------------- gate & act


def log_loss(p, y, weight=None):
    p = np.clip(np.asarray(p, float), 1e-9, 1 - 1e-9)
    y = np.asarray(y, int)
    return float(np.average(-(y * np.log(p) + (1 - y) * np.log(1 - p)), weights=weight))


def should_ship(new, current, noul_holdout, y_holdout, weight=None, segment=None):
    """Ship the new map only if it beats the current one on the newest
    held-back labels (log loss: a proper score, so it can't be gamed by
    shading the numbers)."""
    new_ll = log_loss(apply_map(new, noul_holdout, segment), y_holdout, weight)
    cur_ll = log_loss(apply_map(current, noul_holdout, segment), y_holdout, weight)
    return new_ll < cur_ll, {"new": new_ll, "current": cur_ll}


IDENTITY = {"kind": "identity", "a": 1.0, "b": 0.0, "segments": None, "n": 0}


def threshold(c_fp: float, c_fn: float) -> float:
    """Act when p >= c_fp / (c_fp + c_fn). Only meaningful once p is honest."""
    return c_fp / (c_fp + c_fn)
