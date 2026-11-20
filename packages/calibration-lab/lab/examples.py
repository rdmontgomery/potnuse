"""Tweet-level examples: the concrete cases each beat of the talk opens with.

Rick's critique of the first figure set: too many charts explaining
abstractions nobody has been grounded in yet. Every beat now starts from
actual tweets and the numbers models put on them. This module re-fits the
cheap part of the ladder (about half a minute) and writes
results/<data>-<encoder>/examples.json, which the review page and deck read.

    uv run python -m lab.examples                          # synthetic, LSA
    uv run python -m lab.examples --data data/real/train.csv --encoder gemma
"""

from __future__ import annotations

import argparse
import json
from pathlib import Path

import numpy as np
from sklearn.linear_model import LogisticRegression

from . import conformal as CF
from . import data as D
from . import embed as E
from . import metrics as M
from . import models as Mo
from . import recal as R

ROOT = Path(__file__).resolve().parent.parent


def clean_text(t: str) -> str:
    return D.URL.sub("", str(t)).replace("&amp;", "&").strip()


def pick(rng, idx, k):
    idx = np.asarray(idx)
    return idx if len(idx) <= k else rng.choice(idx, size=k, replace=False)


def main(argv=None):
    ap = argparse.ArgumentParser()
    ap.add_argument("--data", type=Path, default=None)
    ap.add_argument("--encoder", choices=["lsa", "gemma"], default="lsa")
    ap.add_argument("--prompt", default="classification", choices=list(E.PROMPTS))
    a = ap.parse_args(argv)

    ds = D.load(a.data)
    y, truth = ds.y, ds.truth
    raw_text = ds.df["text"].astype(str).to_numpy()
    texts = ds.texts
    tx = np.array(texts, dtype=object)
    kw = ds.df["keyword"].to_numpy()
    prompt = E.PROMPTS[a.prompt] if a.encoder == "gemma" else ""
    Z = E.embed(texts, a.encoder, prompt=prompt, digest=ds.digest)
    sp = D.random_split(len(y), y)
    tr, ca, te = sp.train, sp.cal, sp.test
    rng = np.random.default_rng(11)

    # ------------------------------------------------------------ forecasters
    base = float(y[tr].mean())
    (kc, kt), _ = Mo.keyword_eb(kw[tr], y[tr], [kw[ca], kw[te]])
    (nbc, nbt), _ = Mo.tfidf_nb(list(tx[tr]), y[tr], [list(tx[ca]), list(tx[te])])
    (pc, pt), info = Mo.probe_lr(Z[tr], y[tr], [Z[ca], Z[te]])
    probe = R.Platt().fit(pc, y[ca]).predict(pt)
    nb_platt = R.Platt().fit(nbc, y[ca]).predict(nbt)
    kw_loud = M.sigmoid(M.logit(kt) / 0.25)  # keyword rates, shouted: T = 0.25
    F = {
        "base": dict(name="the base rate", p=np.full(len(te), base),
                     gloss=f"says {base:.2f} to every tweet"),
        "keyword": dict(name="keyword rates", p=kt, gloss="looks only at the keyword column"),
        "keyword_loud": dict(name="keyword rates, shouted", p=kw_loud, gloss="the same rates pushed toward 0 and 1"),
        "nb": dict(name="naive Bayes", p=nbt, gloss="counts words as independent evidence"),
        "nb_platt": dict(name="naive Bayes after Platt", p=nb_platt, gloss="two fitted numbers on its log-odds"),
        "probe": dict(name="the probe", p=probe, gloss="frozen encoder, logistic head, Platt"),
    }

    def stats(p):
        hi, lo = p >= 0.9, p <= 0.1
        m = M.murphy(p, y[te])
        return dict(
            hi_n=int(hi.sum()), hi_rate=float(y[te][hi].mean()) if hi.any() else None,
            lo_n=int(lo.sum()), lo_rate=float(y[te][lo].mean()) if lo.any() else None,
            reliability=m.reliability, resolution=m.resolution, auc=M.auc(p, y[te]),
            ece_mass10=M.ece(p, y[te], 10, "mass"), brier=M.brier(p, y[te]),
        )

    forecasters = {k: dict(name=v["name"], gloss=v["gloss"], **stats(v["p"])) for k, v in F.items()}

    def row(i):
        j = int(te[i])
        return dict(i=int(i), text=clean_text(raw_text[j]), kw=str(kw[j]) if isinstance(kw[j], str) else "", y=int(y[j]),
                    p_true=float(truth[j]) if truth is not None else None,
                    **{k: float(v["p"][i]) for k, v in F.items()})

    # four tweets for the quadrant table: a clear report, clear noise, and two
    # ambiguous ones, chosen by the probe's score so the real data picks its own
    pr = probe
    quad = []
    for lo_, hi_, want in ((0.9, 1.0, 1), (0.0, 0.06, 0), (0.55, 0.75, 1), (0.25, 0.45, 0)):
        cand = np.flatnonzero((pr >= lo_) & (pr <= hi_) & (y[te] == want))
        if len(cand):
            quad.append(row(int(rng.choice(cand))))

    # what "0.8" means: every test tweet the probe scored 0.75 to 0.85, and
    # every tweet naive Bayes called at least 0.95
    b8 = np.flatnonzero((pr >= 0.75) & (pr <= 0.85))
    nb95 = np.flatnonzero(nbt >= 0.95)

    def representative(idx, k=10):
        """k tweets whose share of real ones matches the bucket's, so a slide
        of ten tells the same story as the whole bucket."""
        if len(idx) <= k:
            return idx
        yi = y[te][idx]
        k1 = int(round(k * yi.mean()))
        pos, neg = idx[yi == 1], idx[yi == 0]
        k1 = min(k1, len(pos)); k0 = min(k - k1, len(neg))
        out = np.concatenate([rng.choice(pos, k1, replace=False), rng.choice(neg, k0, replace=False)])
        return out[np.argsort(-pr[out] if idx is b8 else -nbt[out])]
    buckets = dict(
        probe_08=dict(n=int(len(b8)), rate=float(y[te][b8].mean()) if len(b8) else None,
                      mean_p=float(pr[b8].mean()) if len(b8) else None,
                      sample=[row(int(i)) for i in representative(b8)]),
        nb_095=dict(n=int(len(nb95)), rate=float(y[te][nb95].mean()) if len(nb95) else None,
                    mean_p=float(nbt[nb95].mean()) if len(nb95) else None,
                    sample=[row(int(i)) for i in representative(nb95)]),
    )

    # reliability bins, equal-mass so every dot has the same weight behind it
    def bins(p, b=10):
        return [x.__dict__ for x in M.reliability_bins(p, y[te], b, "mass")]

    reliability = {k: bins(F[k]["p"]) for k in ("nb", "nb_platt", "probe")}

    # the ruler: a model that is honest by construction (outcomes redrawn from
    # its own probabilities), binned three ways
    y_null = (np.random.default_rng(3).random(len(pr)) < pr).astype(int)
    ruler = {}
    for b in (5, 20, 100):
        bs = M.reliability_bins(pr, y_null, b, "mass")
        ruler[str(b)] = dict(ece=M.ece(pr, y_null, b, "mass"), bins=[x.__dict__ for x in bs],
                             per_bin=int(len(pr) // b))
    ruler_real = {str(b): M.ece(pr, y[te], b, "mass") for b in (5, 20, 100)}

    # -------------------------------------------------------------- the plane
    # The head's view of the embedding: x is the signed distance to the
    # hyperplane (so the logit is |w| x), y is the main direction of what is
    # left over. Two real axes of the real space, not a t-SNE picture.
    m = LogisticRegression(C=info["C"], max_iter=10000).fit(Z[tr], y[tr])
    w, b0 = m.coef_[0], float(m.intercept_[0])
    wn = float(np.linalg.norm(w))
    u = w / wn
    dist = (Z @ w + b0) / wn
    resid = Z - np.outer(Z @ u, u)
    rc = resid[tr] - resid[tr].mean(0)
    v = np.linalg.svd(rc, full_matrices=False)[2][0]
    yy = (resid - resid[tr].mean(0)) @ v
    show = pick(rng, te, 220)
    plane_pts = [dict(x=float(dist[j]), y=float(yy[j]), label=int(y[j]), text=clean_text(raw_text[j]),
                      p=float(M.sigmoid(wn * dist[j]))) for j in show]
    # a handful of points to annotate on the plane: the extremes and the middle
    ann = []
    for target in (np.argmax(dist[show]), np.argmin(dist[show]), np.argmin(np.abs(dist[show]))):
        ann.append(int(show[target]))

    # the hard wall: six labelled tweets in the 2-d plane. A line separating
    # six points in a plane exists about half the time for random labels;
    # find a draw where it does, fit with no penalty, and watch the slope run.
    P2 = np.stack([dist, yy], 1)
    soft = LogisticRegression(C=1.0, max_iter=10000).fit(P2[tr], y[tr])
    wall = None
    for seed in range(200):
        six = np.random.default_rng(seed).choice(tr, size=6, replace=False)
        if len(np.unique(y[six])) < 2:
            continue
        hard = LogisticRegression(C=1e6, max_iter=100000).fit(P2[six], y[six])
        if hard.score(P2[six], y[six]) == 1.0 and abs(y[six].mean() - 0.5) < 0.2:
            wall = (six, hard)
            break
    hard_info = None
    if wall:
        six, hard = wall
        ph = hard.predict_proba(P2[te])[:, 1]
        ps = soft.predict_proba(P2[te])[:, 1]
        sure = (ph > 0.99) | (ph < 0.01)
        right = (ph > 0.5) == (y[te] == 1)
        hard_info = dict(
            six=[dict(x=float(P2[j, 0]), y=float(P2[j, 1]), label=int(y[j]), text=clean_text(raw_text[j])) for j in six],
            hard=dict(coef=hard.coef_[0].tolist(), intercept=float(hard.intercept_[0]), w_norm=float(np.linalg.norm(hard.coef_))),
            soft=dict(coef=soft.coef_[0].tolist(), intercept=float(soft.intercept_[0]), w_norm=float(np.linalg.norm(soft.coef_))),
            share_sure=float(sure.mean()), wrong_when_sure=float((~right[sure]).mean()) if sure.any() else None,
            ece_hard=M.ece(ph, y[te]), ece_soft=M.ece(ps, y[te]), acc_hard=float(right.mean()),
            acc_soft=float(((ps > 0.5) == (y[te] == 1)).mean()),
        )

    # -------------------------------------------------------------- conformal
    q = CF.split_sets(pc, y[ca], pt, alpha=0.1)[2]
    conf_rows = []
    for r_ in quad:
        p_raw = float(pt[r_["i"]])
        s_ = [lab for lab, ok in (("real", 1 - p_raw <= q), ("not", p_raw <= q)) if ok]
        conf_rows.append(dict(text=r_["text"], y=r_["y"], p=p_raw, set=s_))
    cov = CF.report(*CF.split_sets(pc, y[ca], pt, alpha=0.1)[:2], y[te])

    # -------------------------------------------------------------- the storm
    dtr, dry_rest, wet = D.drift_split(ds)
    (praw_all,), _ = Mo.probe_lr(Z[dtr], y[dtr], [Z])
    dry_rest = np.random.default_rng(0).permutation(dry_rest)
    launch = dry_rest[:300]
    pm = R.Platt().fit(praw_all[launch], y[launch]).predict(praw_all)
    wet_missed = wet[(y[wet] == 1) & (pm[wet] < 0.3)]
    storm = dict(
        missed=[dict(text=clean_text(raw_text[j]), p=float(pm[j]), y=1) for j in pick(rng, wet_missed, 5)],
        wet_real_rate=float(y[wet].mean()), wet_mean_p=float(pm[wet].mean()),
        dry_real_rate=float(y[dry_rest[300:]].mean()), dry_mean_p=float(pm[dry_rest[300:]].mean()),
        n_wet=int(len(wet)),
    )
    # what a calibrated 0.5 meant before and during the storm: tweets the
    # launch map scored 0.4-0.6, and how often they were real. In the storm the
    # water tweets arrive weighted 1 + 3y (the label shift the loop simulates).
    mid = lambda idx: idx[(pm[idx] >= 0.4) & (pm[idx] <= 0.6)]
    dmid, wmid = mid(dry_rest[300:]), mid(wet)
    ww = 1 + 3 * y[wmid]
    storm["half"] = dict(dry_n=int(len(dmid)), dry_rate=float(y[dmid].mean()) if len(dmid) else None,
                         wet_n=int(len(wmid)), wet_rate_storm=float((ww * y[wmid]).sum() / ww.sum()) if len(wmid) else None)

    # one storm batch: 90 dry, 60 wet drawn toward real reports, as in the loop
    r2 = np.random.default_rng(4)
    pw = (1 + 3 * y[wet]) / (1 + 3 * y[wet]).sum()
    batch = np.concatenate([r2.choice(dry_rest[300:], 90, replace=False), r2.choice(wet, 60, replace=False, p=pw)])
    pb = pm[batch]
    flagged = batch[pb >= 0.5]
    unflag = batch[pb < 0.5]
    audit = r2.choice(unflag, size=min(6, len(unflag)), replace=False)
    loop = dict(
        n=int(len(batch)), flagged=int(len(flagged)), flagged_real=int(y[flagged].sum()),
        unflagged=int(len(unflag)), missed=int(y[unflag].sum()),
        missed_examples=[dict(text=clean_text(raw_text[j]), p=float(pm[j])) for j in pick(r2, unflag[y[unflag] == 1], 4)],
        audit=[dict(text=clean_text(raw_text[j]), p=float(pm[j]), y=int(y[j])) for j in audit],
        audit_weight=float(len(unflag) / max(1, len(audit))),
    )

    out = dict(
        meta=dict(dataset=ds.name, encoder=a.encoder, n_test=int(len(te)), base_rate=base, has_truth=truth is not None),
        forecasters=forecasters, quad=quad, buckets=buckets, reliability=reliability,
        ruler=ruler, ruler_real=ruler_real,
        plane=dict(points=plane_pts, w_norm=wn, annotate=[dict(x=float(dist[j]), y=float(yy[j]), label=int(y[j]),
                                                               text=clean_text(raw_text[j]), p=float(M.sigmoid(wn * dist[j])))
                                                          for j in ann],
                   dim=int(Z.shape[1]), hard_wall=hard_info),
        conformal=dict(q=q, rows=conf_rows, coverage=cov),
        storm=storm, loop=loop,
        labels_needed={str(d): M.labels_needed(d) for d in (0.10, 0.05, 0.02)},
    )
    d = ROOT / "results" / f"{ds.name}-{a.encoder}"
    d.mkdir(parents=True, exist_ok=True)
    (d / "examples.json").write_text(json.dumps(out, indent=1, default=float))
    print(f"wrote {d / 'examples.json'}")


if __name__ == "__main__":
    main()
