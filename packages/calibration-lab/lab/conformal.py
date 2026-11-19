"""Conformal prediction for a binary label, and its streaming repair.

The distinction the talk turns on: conformal prediction guarantees coverage of
a *set*, marginally, for any model, calibrated or not. Calibration is a claim
about the probability at every level. A garbage model gets valid conformal
coverage by returning {0, 1} a lot; it never gets calibration.

split_sets   - the LAC / "least ambiguous" sets: include y if 1 - p(y) <= q.
mondrian     - the same, with a separate threshold per class, so each class
               gets its own coverage (marginal coverage can hide a class that
               is always missed).
aci          - Gibbs & Candes (2021) adaptive conformal inference: under drift,
               exchangeability fails and so does the guarantee; ACI nudges the
               working alpha after every miss/hit so long-run coverage holds
               anyway.
"""

from __future__ import annotations

import math

import numpy as np


def _q(scores, alpha):
    n = len(scores)
    k = min(n, math.ceil((n + 1) * (1 - alpha)))
    return float(np.sort(scores)[k - 1]) if n else 1.0


def nonconformity(p1, y):
    """1 - (probability the model gave the true label)."""
    p1, y = np.asarray(p1, float), np.asarray(y)
    return np.where(y == 1, 1 - p1, p1)


def split_sets(p1_cal, y_cal, p1_test, alpha=0.1):
    q = _q(nonconformity(p1_cal, y_cal), alpha)
    p1_test = np.asarray(p1_test, float)
    has1 = (1 - p1_test) <= q
    has0 = p1_test <= q
    return has0, has1, q


def mondrian(p1_cal, y_cal, p1_test, alpha=0.1):
    p1_cal, y_cal = np.asarray(p1_cal, float), np.asarray(y_cal)
    q0 = _q(p1_cal[y_cal == 0], alpha)          # score for y=0 is p1
    q1 = _q(1 - p1_cal[y_cal == 1], alpha)      # score for y=1 is 1 - p1
    p1_test = np.asarray(p1_test, float)
    return p1_test <= q0, (1 - p1_test) <= q1, (q0, q1)


def report(has0, has1, y):
    y = np.asarray(y)
    covered = np.where(y == 1, has1, has0)
    size = has0.astype(int) + has1.astype(int)
    return dict(
        coverage=float(covered.mean()),
        coverage_pos=float(covered[y == 1].mean()) if (y == 1).any() else float("nan"),
        coverage_neg=float(covered[y == 0].mean()) if (y == 0).any() else float("nan"),
        singleton=float((size == 1).mean()),
        both=float((size == 2).mean()),
        empty=float((size == 0).mean()),
    )


def aci(p1_stream, y_stream, p1_cal, y_cal, alpha=0.1, gamma=0.01, window=None):
    """Online conformal over a stream, one item at a time.

    The calibration scores start as the static calibration set and, if
    `window` is set, roll forward with every label seen (a sliding window of
    the most recent `window` scores). alpha_t moves by gamma * (alpha - err_t):
    a miss pushes alpha_t down (bigger sets), a hit lets it drift up.
    Returns per-step coverage indicators for ACI and for the frozen split
    conformal threshold, so the two can be plotted side by side.
    """
    scores = list(nonconformity(p1_cal, y_cal))
    q_static = _q(np.array(scores), alpha)
    a_t = alpha
    cov_aci, cov_static, alphas, sizes = [], [], [], []
    for p, y in zip(np.asarray(p1_stream, float), np.asarray(y_stream)):
        s_arr = np.array(scores if window is None else scores[-window:])
        a_eff = min(max(a_t, 1e-3), 0.999)
        q = _q(s_arr, a_eff) if a_t > 0 else 1.0
        has1, has0 = (1 - p) <= q, p <= q
        hit = has1 if y == 1 else has0
        cov_aci.append(bool(hit))
        sizes.append(int(has0) + int(has1))
        cov_static.append(bool(((1 - p) <= q_static) if y == 1 else (p <= q_static)))
        a_t = a_t + gamma * (alpha - (0.0 if hit else 1.0))
        alphas.append(a_t)
        if window is not None:
            scores.append(float(1 - p if y == 1 else p))
    return dict(aci=np.array(cov_aci), static=np.array(cov_static),
                alpha_t=np.array(alphas), size=np.array(sizes))
