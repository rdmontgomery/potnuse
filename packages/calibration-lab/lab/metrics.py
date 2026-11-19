"""Scoring a probability forecast.

Three families, kept apart on purpose:

* Proper scoring rules (Brier, log loss). Their unique minimizer is the true
  conditional probability, so they reward honesty and knowledge at once.
* Murphy's split of the Brier score into reliability (honesty), resolution
  (information) and uncertainty (the base rate's coin-flip cost). Reliability
  and resolution move independently, which is most of the argument.
* Calibration error estimators. Binned ECE is the common one and the worst one:
  its value depends on the ruler. `richardson` measures that dependence;
  `cumulative` and `smooth_ece` are the two estimators that don't need bins.
"""

from __future__ import annotations

import math
from dataclasses import dataclass

import numpy as np
from sklearn.metrics import roc_auc_score

EPS = 1e-12


def _arr(p, y):
    p = np.clip(np.asarray(p, dtype=float), 0.0, 1.0)
    y = np.asarray(y, dtype=float)
    if p.shape != y.shape:
        raise ValueError(f"shape mismatch {p.shape} vs {y.shape}")
    return p, y


def brier(p, y, w=None) -> float:
    p, y = _arr(p, y)
    return float(np.average((p - y) ** 2, weights=w))


def log_loss(p, y, w=None) -> float:
    p, y = _arr(p, y)
    p = np.clip(p, 1e-7, 1 - 1e-7)
    return float(np.average(-(y * np.log(p) + (1 - y) * np.log(1 - p)), weights=w))


def auc(p, y) -> float:
    p, y = _arr(p, y)
    if y.min() == y.max():
        return float("nan")
    return float(roc_auc_score(y, p))


def logit(p):
    p = np.clip(np.asarray(p, dtype=float), 1e-7, 1 - 1e-7)
    return np.log(p) - np.log1p(-p)


def sigmoid(z):
    return 1.0 / (1.0 + np.exp(-np.asarray(z, dtype=float)))


# --------------------------------------------------------------------------
# bins
# --------------------------------------------------------------------------


def bin_index(p, bins: int, strategy: str = "width"):
    """Bin id per forecast. 'width' = equal-width on [0,1]; 'mass' = equal count."""
    p = np.asarray(p, dtype=float)
    if strategy == "width":
        return np.minimum((p * bins).astype(int), bins - 1)
    if strategy == "mass":
        order = np.argsort(p, kind="stable")
        idx = np.empty(len(p), dtype=int)
        for b, chunk in enumerate(np.array_split(order, bins)):
            idx[chunk] = b
        return idx
    raise ValueError(strategy)


@dataclass
class Bin:
    lo: float
    hi: float
    n: float
    claimed: float
    happened: float
    ci_lo: float
    ci_hi: float


def wilson(k: float, n: float, z: float = 1.96) -> tuple[float, float]:
    if n <= 0:
        return (0.0, 1.0)
    ph = k / n
    den = 1 + z * z / n
    centre = (ph + z * z / (2 * n)) / den
    half = z * math.sqrt(ph * (1 - ph) / n + z * z / (4 * n * n)) / den
    return (max(0.0, centre - half), min(1.0, centre + half))


def reliability_bins(p, y, bins: int = 10, strategy: str = "width", w=None) -> list[Bin]:
    p, y = _arr(p, y)
    w = np.ones_like(p) if w is None else np.asarray(w, dtype=float)
    idx = bin_index(p, bins, strategy)
    out = []
    for b in range(bins):
        m = idx == b
        if not m.any():
            continue
        n = w[m].sum()
        k = (w[m] * y[m]).sum()
        lo, hi = wilson(k, n) if strategy else (0, 1)
        out.append(Bin(
            lo=float(p[m].min()), hi=float(p[m].max()), n=float(n),
            claimed=float(np.average(p[m], weights=w[m])),
            happened=float(k / n), ci_lo=lo, ci_hi=hi,
        ))
    return out


def ece(p, y, bins: int = 10, strategy: str = "width", w=None) -> float:
    bs = reliability_bins(p, y, bins, strategy, w)
    tot = sum(b.n for b in bs)
    return float(sum(b.n * abs(b.happened - b.claimed) for b in bs) / tot)


@dataclass
class Murphy:
    brier: float
    reliability: float
    resolution: float
    uncertainty: float
    within_bin: float  # the residual that makes the identity exact with bins


def murphy(p, y, bins: int = 10, strategy: str = "width", w=None) -> Murphy:
    """Brier = REL - RES + UNC + within-bin terms.

    With binned forecasts the classical three-term identity holds only up to
    the variance of forecasts inside each bin; that residual is reported rather
    than hidden so the arithmetic always closes.
    """
    p, y = _arr(p, y)
    w = np.ones_like(p) if w is None else np.asarray(w, dtype=float)
    wn = w / w.sum()
    ybar = float((wn * y).sum())
    idx = bin_index(p, bins, strategy)
    rel = res = 0.0
    for b in np.unique(idx):
        m = idx == b
        nk = wn[m].sum()
        pk = (wn[m] * p[m]).sum() / nk
        ok = (wn[m] * y[m]).sum() / nk
        rel += nk * (pk - ok) ** 2
        res += nk * (ok - ybar) ** 2
    bs = float((wn * (p - y) ** 2).sum())
    unc = ybar * (1 - ybar)
    return Murphy(bs, float(rel), float(res), float(unc), float(bs - (rel - res + unc)))


# --------------------------------------------------------------------------
# the ruler problem
# --------------------------------------------------------------------------


def richardson(p, y, bin_counts=None, strategy: str = "mass") -> dict:
    """Binned ECE as a function of the number of bins (the ruler).

    Under perfect calibration the residual walk is Brownian (dimension 1.5),
    so binned ECE grows like sqrt(B / n): the coastline-length law
    L(eps) ~ eps^(1-D) with eps = 1/B. A real miscalibration shows up as a
    plateau at small B before the noise takes over. The crossover bin count is
    the finest calibration map your labels can support.
    """
    p, y = _arr(p, y)
    n = len(p)
    if bin_counts is None:
        bin_counts = np.unique(np.round(np.logspace(0, np.log10(max(2, n / 4)), 28)).astype(int))
    eces = np.array([ece(p, y, int(b), strategy) for b in bin_counts])
    # the noise floor under calibration, for the same bins: E|mean of m
    # centred Bernoullis| ~ sqrt(2/pi) * sd / sqrt(m), summed over bins
    var = float(np.mean(p * (1 - p)))
    floor = np.sqrt(2 / np.pi) * np.sqrt(var) * np.sqrt(np.asarray(bin_counts) / n)
    big = np.asarray(bin_counts) >= max(8, n / 200)
    slope = float(np.polyfit(np.log(np.asarray(bin_counts)[big]), np.log(eces[big]), 1)[0]) if big.sum() >= 3 else float("nan")
    # crossover: first B where the measured ECE is within 25% of pure noise
    cross = next((int(b) for b, e, f in zip(bin_counts, eces, floor) if e < 1.25 * f and b > 1), None)
    return dict(bins=[int(b) for b in bin_counts], ece=eces.tolist(), noise_floor=floor.tolist(),
                slope=slope, crossover_bins=cross, n=n)


def _sup_abs_brownian_cdf(x: float, terms: int = 60) -> float:
    """P(sup_{t<=1} |B_t| < x) for standard Brownian motion."""
    if x <= 0:
        return 0.0
    s = 0.0
    for k in range(terms):
        s += (-1) ** k / (2 * k + 1) * math.exp(-((2 * k + 1) ** 2) * math.pi ** 2 / (8 * x * x))
    return max(0.0, min(1.0, 4 / math.pi * s))


def cumulative(p, y) -> dict:
    """Tygert's cumulative-difference test, the binning-free calibration check.

    Sort by forecast and walk W_k = sum_{i<=k} (y_i - p_i) / n. Under the null
    of calibration it is a martingale whose variance grows by p_i(1-p_i)/n^2
    per step, i.e. a time-changed Brownian motion: measure its excursion, not
    its length. KS is max |W|; the p-value comes from sup |B| on [0, 1].
    """
    p, y = _arr(p, y)
    order = np.argsort(p, kind="stable")
    ps, ys = p[order], y[order]
    n = len(p)
    walk = np.cumsum(ys - ps) / n
    sd = math.sqrt(float(np.sum(ps * (1 - ps)))) / n
    ks = float(np.max(np.abs(walk)))
    kuiper = float(walk.max() - min(0.0, walk.min())) if n else 0.0
    z = ks / sd if sd > 0 else float("inf")
    pval = 1.0 - _sup_abs_brownian_cdf(z)
    return dict(ks=ks, kuiper=kuiper, z=z, p_value=pval, sd=sd,
                x=ps.tolist(), walk=walk.tolist())


def smooth_ece(p, y, grid: int = 512, tol: float = 1e-4) -> dict:
    """Blasiok & Nakkiran's smooth ECE with the fixed-point bandwidth.

    Smooth the residuals y - p with a reflected Gaussian kernel of width s,
    integrate their absolute value against the forecast density, and pick the
    s at which smECE(s) = s. No bins, consistent, and the bandwidth chooses
    itself.
    """
    p, y = _arr(p, y)
    r = y - p
    t = (np.arange(grid) + 0.5) / grid

    def at(s: float) -> float:
        # reflected kernel: images at -p and 2-p keep mass inside [0,1]
        acc = np.zeros(grid)
        for c in (p, -p, 2 - p):
            acc += (np.exp(-0.5 * ((t[:, None] - c[None, :]) / s) ** 2) * r[None, :]).sum(1)
        acc /= len(p) * s * math.sqrt(2 * math.pi)
        return float(np.abs(acc).mean())  # integral over [0,1] on a uniform grid

    lo, hi = 1e-4, 1.0
    if at(lo) <= lo:
        return dict(smece=at(lo), sigma=lo)
    for _ in range(40):
        mid = math.sqrt(lo * hi)
        if at(mid) > mid:
            lo = mid
        else:
            hi = mid
        if hi - lo < tol:
            break
    s = math.sqrt(lo * hi)
    return dict(smece=at(s), sigma=s)


def labels_needed(delta: float, p: float = 0.5, z: float = 1.96) -> int:
    """Labels per bin to resolve a calibration gap of `delta` at forecast p.

    Standard error of a bin's observed rate is sqrt(p(1-p)/m); asking for a z
    sigma separation gives m = z^2 p (1-p) / delta^2. The 1/delta^2 is the
    whole budget conversation.
    """
    return int(math.ceil(z * z * p * (1 - p) / (delta * delta)))


def summary(p, y, truth=None, bins: int = 10) -> dict:
    """Everything worth printing about one forecast vector."""
    p, y = _arr(p, y)
    m = murphy(p, y, bins)
    out = dict(
        n=len(p), brier=brier(p, y), log_loss=log_loss(p, y), auc=auc(p, y),
        ece10=ece(p, y, bins), ece_mass10=ece(p, y, bins, "mass"),
        reliability=m.reliability, resolution=m.resolution, uncertainty=m.uncertainty,
        smece=smooth_ece(p, y)["smece"], ks=cumulative(p, y)["ks"],
        ks_p=cumulative(p, y)["p_value"],
        mean_p=float(p.mean()), base_rate=float(y.mean()),
    )
    if truth is not None:
        t = np.asarray(truth, dtype=float)
        # oracle: distance from the true conditional probability. Only the
        # synthetic data has this; it is the quantity every estimator above is
        # trying to approximate from labels.
        out["true_mse"] = float(np.mean((p - t) ** 2))
        # true calibration error: E| E[t | p] - p |, with E[t|p] by fine mass bins
        idx = bin_index(p, 50, "mass")
        tce = 0.0
        for b in np.unique(idx):
            mm = idx == b
            tce += mm.mean() * abs(t[mm].mean() - p[mm].mean())
        out["true_ece"] = float(tce)
    return out
