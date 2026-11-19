"""The labeling loop, simulated: who gets labeled decides what you learn.

A model trained on dry tweets goes into production. Traffic arrives in
batches; partway through, water tweets (floods, hurricanes) start arriving,
which the model has never seen a keyword of. Each batch:

  1. score every item, push the raw score through the current calibration map
  2. act on items whose calibrated probability clears the threshold
  3. a labeling policy picks `budget` items for people to label
  4. those labels land `delay` batches later
  5. the map is refitted (Platt, weighted) on whatever labels have landed

Policies:

  flagged      label what you acted on. The natural queue: dispatchers confirm
               or reverse the alerts they were sent. Learns precision forever,
               recall never.
  uncertainty  label what's nearest the threshold. Active learning's favourite;
               good for the boundary, blind in the tails.
  random       a uniform sample of everything. Unbiased, and spends most of the
               budget on items nobody was unsure about.
  stratified   80% flagged, 20% audit from the unflagged, each label weighted by
               the inverse of its inclusion probability so the weighted sample
               stands for the whole batch. Same budget as the others.

Every curve is scored against all labels in each batch (and, on synthetic
data, against the oracle), which the people in the loop never see.
"""

from __future__ import annotations

from dataclasses import dataclass

import numpy as np

from . import metrics as M
from .conformal import aci
from .recal import Identity, Platt


KEYS = ("brier", "citl", "ece", "true_mse", "est_ece", "count_err", "slope", "intercept",
        "true_missed", "est_missed", "low_citl")


def psi(ref, cur, bins=10) -> float:
    """Population stability index of raw scores: the label-free drift alarm."""
    qs = np.quantile(ref, np.linspace(0, 1, bins + 1))
    qs[0], qs[-1] = -np.inf, np.inf
    a = np.histogram(ref, qs)[0] / len(ref) + 1e-4
    b = np.histogram(cur, qs)[0] / len(cur) + 1e-4
    return float(np.sum((b - a) * np.log(b / a)))


def build_stream(dry_idx, wet_idx, n_batches=24, batch=150, onset=0.35, peak=0.6, seed=0, wet_weight=None):
    """Batches drawn from two pools, the wet share ramping from 0 to `peak`
    after `onset` of the way through and then holding there.

    Rows are drawn without replacement within a batch and with replacement
    across batches, so a long storm doesn't run out of tweets: the pools are
    the world's distribution, not a finite queue. `wet_weight` (one per wet
    row) tilts the wet draw; 1 + 3y makes a storm's tweets mostly real reports,
    which is a label shift on top of the new vocabulary.
    """
    rng = np.random.default_rng(seed)
    dry_idx, wet_idx = np.asarray(dry_idx), np.asarray(wet_idx)
    pw = None if wet_weight is None else np.asarray(wet_weight, float) / np.sum(wet_weight)
    out = []
    ramp = max(1.0, 0.25 * n_batches)
    for t in range(n_batches):
        frac = 0.0 if t < onset * n_batches else min(peak, peak * (t - onset * n_batches + 1) / ramp)
        k_wet = int(round(frac * batch))
        b = np.concatenate([
            rng.choice(dry_idx, size=batch - k_wet, replace=False),
            rng.choice(wet_idx, size=k_wet, replace=False, p=pw) if k_wet else np.array([], dtype=int),
        ]).astype(int)
        out.append(b)
    return out


@dataclass
class PolicyResult:
    name: str
    brier: np.ndarray        # per batch, all labels
    citl: np.ndarray         # calibration in the large: mean p - mean y
    ece: np.ndarray
    true_mse: np.ndarray     # vs oracle (nan without truth)
    est_ece: np.ndarray      # what the team can see from its own labels
    count_err: np.ndarray    # sum p - sum y, per batch
    slope: np.ndarray        # fitted Platt slope (1/T)
    intercept: np.ndarray
    true_missed: np.ndarray  # real disasters below the threshold, per batch
    est_missed: np.ndarray   # what the team's own labels say that number is
    low_citl: np.ndarray     # mean p - mean y among the unflagged: calibration where nobody looks


def choose(policy: str, p_cal, budget, threshold, rng):
    n = len(p_cal)
    idx = np.arange(n)
    flagged = idx[p_cal >= threshold]
    rest = idx[p_cal < threshold]
    w = np.ones(n)
    if policy == "flagged":
        pick = rng.choice(flagged, size=min(budget, len(flagged)), replace=False) if len(flagged) else idx[:0]
        return pick, w[pick]
    if policy == "uncertainty":
        pick = np.argsort(np.abs(p_cal - threshold))[:budget]
        return pick, w[pick]
    if policy == "random":
        pick = rng.choice(n, size=budget, replace=False)
        return pick, np.full(budget, n / budget)
    if policy == "stratified":
        k_a = max(1, int(round(0.2 * budget)))
        k_f = budget - k_a
        k_f = min(k_f, len(flagged))
        k_a = min(budget - k_f, len(rest))
        pf = rng.choice(flagged, size=k_f, replace=False) if k_f else idx[:0]
        pa = rng.choice(rest, size=k_a, replace=False) if k_a else idx[:0]
        wf = np.full(len(pf), len(flagged) / max(k_f, 1))
        wa = np.full(len(pa), len(rest) / max(k_a, 1))
        return np.concatenate([pf, pa]), np.concatenate([wf, wa])
    raise ValueError(policy)


def _fit(s, y, w, fallback):
    if len(y) >= 2 and len(np.unique(y)) == 2:
        return Platt().fit(s, y, w)
    return fallback


def run_policy(policy, raw_batches, y_batches, t_batches, launch_raw, launch_y,
               budget=30, delay=2, threshold=0.5, window=None, seed=0,
               seg_batches=None, launch_seg=None, min_seg=40) -> PolicyResult:
    """One run of the loop. `window` keeps only the last `window` batches of
    labels (None = keep everything, launch set included). With `seg_batches`
    a separate map is fitted per segment once that segment has `min_seg`
    labels in the window, falling back to the pooled map until then."""
    rng = np.random.default_rng(seed)
    pending = []  # (arrive_at, raw, y, w, seg)
    seg_on = seg_batches is not None
    if not seg_on:
        seg_batches = [np.zeros(len(r), dtype=int) for r in raw_batches]
        launch_seg = np.zeros(len(launch_y), dtype=int)
    pooled = Platt().fit(launch_raw, launch_y)
    maps = {}
    nb = len(raw_batches)
    out = {k: np.full(nb, np.nan) for k in KEYS}
    hist = []
    launch = (launch_raw, launch_y, np.ones(len(launch_y)), launch_seg)
    for t in range(nb):
        for item in [x for x in pending if x[0] <= t]:
            hist.append(item[1:])
            pending.remove(item)
        if hist:
            use = [launch] + hist if window is None else hist[-window:]
            s, yy, ww, sg = (np.concatenate([h[i] for h in use]) for i in range(4))
            pooled = _fit(s, yy, ww, pooled)
            if seg_on:
                maps = {}
                for g in np.unique(sg):
                    m = sg == g
                    if m.sum() >= min_seg:
                        maps[g] = _fit(s[m], yy[m], ww[m], pooled)
        raw, y, tr, seg = raw_batches[t], y_batches[t], t_batches[t], seg_batches[t]
        p = pooled.predict(raw)
        for g, mp in maps.items():
            m = seg == g
            if m.any():
                p[m] = mp.predict(raw[m])
        out["brier"][t] = M.brier(p, y)
        out["citl"][t] = p.mean() - y.mean()
        out["ece"][t] = M.ece(p, y, 10)
        out["count_err"][t] = p.sum() - y.sum()
        out["slope"][t], out["intercept"][t] = pooled.a, pooled.b
        if tr is not None:
            out["true_mse"][t] = float(np.mean((p - tr) ** 2))
        low = p < threshold
        out["true_missed"][t] = float(y[low].sum())
        out["low_citl"][t] = float(p[low].mean() - y[low].mean()) if low.any() else np.nan
        pick, w = choose(policy, p, budget, threshold, rng)
        if len(pick):
            out["est_ece"][t] = abs(np.average(p[pick], weights=w) - np.average(y[pick], weights=w))
            lowpick = low[pick]
            # the team's estimate of misses: weighted positives among labeled
            # unflagged items (unweighted for uncertainty sampling, which has
            # no inclusion probabilities to weight by)
            out["est_missed"][t] = float(np.sum(w[lowpick] * y[pick][lowpick]))
            pending.append((t + delay, raw[pick], y[pick], w, seg[pick]))
    return PolicyResult(policy, **out)


POLICIES = [
    # name, labeling policy, window, segmented
    ("flagged", "flagged", None, False),
    ("uncertainty", "uncertainty", None, False),
    ("random", "random", None, False),
    ("stratified", "stratified", None, False),
    ("stratified-window6", "stratified", 6, False),
    ("stratified-window6-segmented", "stratified", 6, True),
]


def simulate(raw_stream, y_stream, t_stream, launch_raw, launch_y, budget=30, delay=2,
             threshold=0.5, seeds=20, seg_stream=None, launch_seg=None) -> dict:
    res = {}
    for name, pol, win, segd in POLICIES:
        if segd and seg_stream is None:
            continue
        runs = [run_policy(pol, raw_stream, y_stream, t_stream, launch_raw, launch_y,
                           budget=budget, delay=delay, threshold=threshold, window=win, seed=s,
                           seg_batches=seg_stream if segd else None, launch_seg=launch_seg if segd else None)
                for s in range(seeds)]
        agg = {}
        for k in KEYS:
            a = np.stack([getattr(r, k) for r in runs])
            agg[k] = dict(mean=np.nanmean(a, 0).tolist(), lo=np.nanpercentile(a, 10, 0).tolist(),
                          hi=np.nanpercentile(a, 90, 0).tolist())
        res[name] = agg
    # the no-loop baseline: launch map frozen forever
    frozen = Platt().fit(launch_raw, launch_y)
    res["frozen"] = {
        "brier": dict(mean=[M.brier(frozen.predict(r), y) for r, y in zip(raw_stream, y_stream)]),
        "citl": dict(mean=[float(frozen.predict(r).mean() - y.mean()) for r, y in zip(raw_stream, y_stream)]),
        "count_err": dict(mean=[float(frozen.predict(r).sum() - y.sum()) for r, y in zip(raw_stream, y_stream)]),
        "true_mse": dict(mean=[float(np.mean((frozen.predict(r) - t) ** 2)) if t is not None else float("nan")
                               for r, t in zip(raw_stream, t_stream)]),
    }
    # drift alarm and conformal coverage along the same stream
    res["psi"] = [psi(launch_raw, r) for r in raw_stream]
    flat_raw = np.concatenate(raw_stream)
    flat_y = np.concatenate(y_stream)
    a = aci(frozen.predict(flat_raw), flat_y, frozen.predict(launch_raw), launch_y, alpha=0.1, gamma=0.02, window=None)
    sizes = np.cumsum([0] + [len(r) for r in raw_stream])
    res["aci"] = dict(
        aci=[float(a["aci"][sizes[i]:sizes[i + 1]].mean()) for i in range(len(raw_stream))],
        static=[float(a["static"][sizes[i]:sizes[i + 1]].mean()) for i in range(len(raw_stream))],
        size=[float(a["size"][sizes[i]:sizes[i + 1]].mean()) for i in range(len(raw_stream))],
    )
    return res
