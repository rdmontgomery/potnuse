"""Post-hoc recalibration maps: raw score in, honest probability out.

Every map here is monotone, so none of them can change a ranking, so none of
them can change AUC or resolution beyond what binning loses. You can buy
honesty locally; you cannot buy information locally.

All maps share one interface:

    m = Platt().fit(raw_p, y, w=None)
    p = m.predict(raw_p)

`w` is a per-label weight, which is how an audit sample drawn at rate r stands
in for the 1/r items it represents.
"""

from __future__ import annotations

import numpy as np
from scipy.optimize import minimize, minimize_scalar
from sklearn.isotonic import IsotonicRegression

from .metrics import logit, sigmoid


def _w(y, w):
    return np.ones(len(y)) if w is None else np.asarray(w, dtype=float)


def _nll(p, y, w):
    p = np.clip(p, 1e-9, 1 - 1e-9)
    return -np.sum(w * (y * np.log(p) + (1 - y) * np.log(1 - p))) / np.sum(w)


class Identity:
    name = "raw"

    def fit(self, s, y, w=None):
        return self

    def predict(self, s):
        return np.asarray(s, dtype=float)


class Temperature:
    """p = sigmoid(logit(s) / T). One number: the Boltzmann temperature.

    T < 1 sharpens, T > 1 softens. An overconfident model fits T > 1 (it was
    running cold and needs warming). For a binary forecast this is Platt with
    the intercept pinned at zero, so it can fix sharpness but not a base-rate
    shift.
    """

    name = "temperature"

    def fit(self, s, y, w=None):
        z, y, w = logit(s), np.asarray(y, float), _w(y, w)
        r = minimize_scalar(lambda lt: _nll(sigmoid(z / np.exp(lt)), y, w), bounds=(-4, 4), method="bounded")
        self.T = float(np.exp(r.x))
        return self

    def predict(self, s):
        return sigmoid(logit(s) / self.T)


class Platt:
    """p = sigmoid(a * logit(s) + b). Slope is 1/T; intercept is a base-rate shift.

    Fitted by maximum likelihood with a whisper of L2 so separable calibration
    sets don't send the slope to infinity (the hard-wall limit).
    """

    name = "platt"

    def __init__(self, l2: float = 1e-4):
        self.l2 = l2

    def fit(self, s, y, w=None):
        z, y, w = logit(s), np.asarray(y, float), _w(y, w)

        def f(ab):
            return _nll(sigmoid(ab[0] * z + ab[1]), y, w) + self.l2 * (ab[0] ** 2 + ab[1] ** 2)

        r = minimize(f, x0=np.array([1.0, 0.0]), method="L-BFGS-B")
        self.a, self.b = map(float, r.x)
        return self

    def predict(self, s):
        return sigmoid(self.a * logit(s) + self.b)


class Isotonic:
    """Pool-adjacent-violators: the best monotone step function. Flexible,
    hungry, and in sample it always reaches zero calibration error, which is
    why it must be scored on rows it didn't see."""

    name = "isotonic"

    def fit(self, s, y, w=None):
        self.m = IsotonicRegression(y_min=0.0, y_max=1.0, out_of_bounds="clip")
        self.m.fit(np.asarray(s, float), np.asarray(y, float), sample_weight=_w(y, w))
        return self

    def predict(self, s):
        return np.clip(self.m.predict(np.asarray(s, float)), 1e-6, 1 - 1e-6)


class HistogramBinning:
    """Equal-mass bins, each mapped to its observed rate. The oldest map
    (Zadrozny & Elkan 2001) and the one whose resolution is set by the ruler."""

    name = "histogram"

    def __init__(self, bins: int = 10):
        self.bins = bins

    def fit(self, s, y, w=None):
        s, y, w = np.asarray(s, float), np.asarray(y, float), _w(y, w)
        qs = np.quantile(s, np.linspace(0, 1, self.bins + 1))
        qs[0], qs[-1] = -np.inf, np.inf
        self.edges = np.unique(qs)
        idx = np.clip(np.searchsorted(self.edges, s, side="right") - 1, 0, len(self.edges) - 2)
        self.rates = np.array([
            (np.sum(w[idx == b] * y[idx == b]) + 1) / (np.sum(w[idx == b]) + 2)  # Laplace
            for b in range(len(self.edges) - 1)
        ])
        return self

    def predict(self, s):
        s = np.asarray(s, float)
        idx = np.clip(np.searchsorted(self.edges, s, side="right") - 1, 0, len(self.rates) - 1)
        return self.rates[idx]


class Beta:
    """Kull, Silva Filho & Flach (2017): logistic on [ln s, -ln(1-s)].

    Contains Platt as the a = b special case and can bend the two tails
    independently, which a single temperature can't. Naive Bayes and boosted
    trees miscalibrate asymmetrically; this is the map for them.
    """

    name = "beta"

    def fit(self, s, y, w=None):
        s = np.clip(np.asarray(s, float), 1e-7, 1 - 1e-7)
        y, w = np.asarray(y, float), _w(y, w)
        X = np.stack([np.log(s), -np.log1p(-s)], 1)

        def f(th):
            return _nll(sigmoid(X @ th[:2] + th[2]), y, w) + 1e-4 * np.sum(th ** 2)

        r = minimize(f, x0=np.array([1.0, 1.0, 0.0]), method="L-BFGS-B",
                     bounds=[(0, None), (0, None), (None, None)])
        self.th = r.x
        return self

    def predict(self, s):
        s = np.clip(np.asarray(s, float), 1e-7, 1 - 1e-7)
        X = np.stack([np.log(s), -np.log1p(-s)], 1)
        return sigmoid(X @ self.th[:2] + self.th[2])


class VennAbers:
    """Inductive Venn-Abers predictor (Vovk & Petej 2014).

    For a test score s, fit isotonic regression twice on the calibration set
    with (s, 0) and then (s, 1) appended. The two fitted values at s, p0 <= p1,
    form a multiprobability: under exchangeability one of them is perfectly
    calibrated, and the width p1 - p0 is the price of not knowing which, which
    shrinks like 1/n. It is the conformal family's answer to calibration
    rather than to coverage.

    predict() returns the log-loss-optimal merge p1 / (1 - p0 + p1);
    interval() returns (p0, p1).
    """

    name = "venn-abers"

    def fit(self, s, y, w=None):
        if w is not None and not np.allclose(w, w[0]):
            # weights break the exchangeability argument; fall back honestly
            self._weighted = Isotonic().fit(s, y, w)
        else:
            self._weighted = None
        self.s = np.asarray(s, float)
        self.y = np.asarray(y, float)
        return self

    def interval(self, s, grid: int = 256):
        """Exact at up to `grid` test scores; beyond that, exact on `grid`
        quantiles of the test scores and linearly interpolated between them
        (p0 and p1 are monotone in s, so the interpolation error is bounded by
        the step between neighbouring grid points)."""
        s = np.asarray(s, float)
        uniq = np.unique(s)
        pts = uniq if len(uniq) <= grid else np.unique(np.quantile(uniq, np.linspace(0, 1, grid)))
        p0 = np.empty(len(pts))
        p1 = np.empty(len(pts))
        xs = np.append(self.s, 0.0)
        for i, u in enumerate(pts):
            xs[-1] = u
            for lab, out in ((0.0, p0), (1.0, p1)):
                ys = np.append(self.y, lab)
                ir = IsotonicRegression(y_min=0.0, y_max=1.0, out_of_bounds="clip").fit(xs, ys)
                out[i] = ir.predict([u])[0]
        return np.interp(s, pts, p0), np.interp(s, pts, p1)

    def predict(self, s):
        if self._weighted is not None:
            return self._weighted.predict(s)
        p0, p1 = self.interval(s)
        return np.clip(p1 / (1 - p0 + p1), 1e-6, 1 - 1e-6)


MAPS = {
    "raw": Identity,
    "temperature": Temperature,
    "platt": Platt,
    "beta": Beta,
    "isotonic": Isotonic,
    "histogram": HistogramBinning,
    "venn-abers": VennAbers,
}
