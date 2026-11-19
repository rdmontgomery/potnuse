"""Every number in the talk, from one command.

    uv run python -m lab.run                         # synthetic, LSA encoder (no downloads)
    uv run python -m lab.run --data data/real/train.csv --encoder gemma
    uv run python -m lab.run --data data/real/train.csv --encoder gemma --jev --tabpfn

Writes results/<dataset>-<encoder>/results.json and summary.md. The figure
generator reads results.json; nothing downstream recomputes anything.
"""

from __future__ import annotations

import argparse
import json
import time
from pathlib import Path

import numpy as np

from . import conformal as C
from . import data as D
from . import embed as E
from . import hitl as H
from . import jev as J
from . import metrics as M
from . import models as Mo
from . import recal as R

ROOT = Path(__file__).resolve().parent.parent


def log(msg):
    print(f"[{time.strftime('%H:%M:%S')}] {msg}", flush=True)


def bins_json(p, y, bins=10, strategy="width"):
    return [b.__dict__ for b in M.reliability_bins(p, y, bins, strategy)]


def main(argv=None):
    ap = argparse.ArgumentParser()
    ap.add_argument("--data", type=Path, default=None)
    ap.add_argument("--encoder", choices=["lsa", "gemma"], default="lsa")
    ap.add_argument("--prompt", default="classification", choices=list(E.PROMPTS))
    ap.add_argument("--jev", action="store_true", help="score the test split with the real Jev API")
    ap.add_argument("--tabpfn", action="store_true", help="add TabPFN as a nonlinear head")
    ap.add_argument("--seeds", type=int, default=20, help="repeats for the labeling-loop simulation")
    ap.add_argument("--quick", action="store_true", help="fewer repeats, for iterating")
    a = ap.parse_args(argv)

    ds = D.load(a.data)
    y, truth = ds.y, ds.truth
    texts = ds.texts
    tx = np.array(texts, dtype=object)
    has_truth = truth is not None
    tag = f"{ds.name}-{a.encoder}"
    out_dir = ROOT / "results" / tag
    out_dir.mkdir(parents=True, exist_ok=True)
    seeds = 4 if a.quick else a.seeds
    R_ = dict(meta=dict(dataset=ds.name, encoder=a.encoder, prompt=E.PROMPTS[a.prompt], n=len(y),
                        base_rate=float(y.mean()), has_truth=has_truth,
                        water_rows=int(ds.water.sum()), generated=time.strftime("%Y-%m-%d %H:%M")))
    log(f"{ds.name}: {len(y)} rows, base rate {y.mean():.3f}, truth={'yes' if has_truth else 'no'}, water rows {ds.water.sum()}")

    def T(idx):
        return truth[idx] if has_truth else None

    # ----------------------------------------------------------- encoder
    prompt = E.PROMPTS[a.prompt] if a.encoder == "gemma" else ""
    Z = E.embed(texts, a.encoder, prompt=prompt, digest=ds.digest)
    full_dim = Z.shape[1]
    log(f"encoder {a.encoder}: {Z.shape}")

    sp = D.random_split(len(y), y)
    tr, ca, te = sp.train, sp.cal, sp.test
    kw = ds.df["keyword"].to_numpy()

    # ----------------------------------------------------------- the ladder
    preds = {}
    infos = {}
    (pc, pt), infos["keyword_eb"] = Mo.keyword_eb(kw[tr], y[tr], [kw[ca], kw[te]])
    preds["keyword_eb"] = (pc, pt)
    for f in (Mo.tfidf_nb, Mo.tfidf_lr, Mo.tfidf_gbm):
        (pc, pt), infos[f.__name__] = f(list(tx[tr]), y[tr], [list(tx[ca]), list(tx[te])])
        preds[f.__name__] = (pc, pt)
        log(f"  {f.__name__}")
    for f in (Mo.probe_lr, Mo.probe_wall, Mo.probe_mlp):
        (pc, pt), infos[f.__name__] = f(Z[tr], y[tr], [Z[ca], Z[te]])
        preds[f.__name__] = (pc, pt)
        log(f"  {f.__name__}")
    if a.tabpfn and Mo.tabpfn_available():
        (pc, pt), infos["probe_tabpfn"] = Mo.probe_tabpfn(Z[tr], y[tr], [Z[ca], Z[te]])
        preds["probe_tabpfn"] = (pc, pt)
        log("  probe_tabpfn")
    if a.jev and J.available():
        pj = J.score_real([texts[i] for i in np.concatenate([ca, te])])
        preds["jev"] = (pj[: len(ca)], pj[len(ca):])
        log("  jev (real)")
    elif has_truth:
        pj = J.score_mock(truth)
        preds["jev_mock"] = (pj[ca], pj[te])
    if has_truth:
        preds["oracle"] = (truth[ca], truth[te])

    # calibration in the large: logistic regression's score equation for the
    # intercept forces mean(p) = mean(y) on its own training rows
    m_lr = __import__("sklearn.linear_model", fromlist=["LogisticRegression"]).LogisticRegression(
        C=infos["probe_lr"]["C"], max_iter=10000).fit(Z[tr], y[tr])
    R_["citl_train"] = dict(mean_p=float(m_lr.predict_proba(Z[tr])[:, 1].mean()), mean_y=float(y[tr].mean()))

    ladder, recal_tab, rel = {}, {}, {}
    for name, (pc, pt) in preds.items():
        ladder[name] = M.summary(pt, y[te], T(te))
        ladder[name]["info"] = infos.get(name, {})
        ladder[name]["T_fit"] = R.Temperature().fit(pc, y[ca]).T
        rel[name] = dict(raw=bins_json(pt, y[te]))
        recal_tab[name] = {}
        for mname, Map in R.MAPS.items():
            if mname == "venn-abers" and name not in ("probe_lr", "tfidf_nb", "tfidf_lr", "jev", "jev_mock"):
                continue
            m = Map().fit(pc, y[ca])
            q = m.predict(pt)
            recal_tab[name][mname] = M.summary(q, y[te], T(te))
            if mname == "platt":
                rel[name]["platt"] = bins_json(q, y[te])
    R_["ladder"], R_["recal"], R_["reliability"] = ladder, recal_tab, rel
    log("ladder + recalibration done")

    # ----------------------------------------------------------- the ruler
    rng = np.random.default_rng(1)
    rich = {}
    p_lr = R.Platt().fit(preds["probe_lr"][0], y[ca]).predict(preds["probe_lr"][1])
    # parametric null: outcomes redrawn from the model's own probabilities, so
    # the model is calibrated by construction against them. Works on any data.
    y_null = (rng.random(len(p_lr)) < p_lr).astype(int)
    rich["null"] = M.richardson(p_lr, y_null)
    rich["probe_lr_platt"] = M.richardson(p_lr, y[te])
    rich["tfidf_nb"] = M.richardson(preds["tfidf_nb"][1], y[te])
    if has_truth:
        rich["oracle"] = M.richardson(truth, y)  # all rows: the biggest honest n we have
    R_["richardson"] = rich
    cum = {}
    for name, p in (("probe_lr_platt", p_lr), ("tfidf_nb", preds["tfidf_nb"][1]), ("probe_wall", preds["probe_wall"][1])):
        c = M.cumulative(p, y[te])
        step = max(1, len(c["x"]) // 400)
        cum[name] = dict(ks=c["ks"], z=c["z"], p_value=c["p_value"], sd=c["sd"],
                         x=c["x"][::step], walk=c["walk"][::step])
    # the same walk under the null, to put the Brownian envelope on the figure
    c = M.cumulative(p_lr, y_null)
    step = max(1, len(c["x"]) // 400)
    cum["null"] = dict(ks=c["ks"], z=c["z"], p_value=c["p_value"], sd=c["sd"], x=c["x"][::step], walk=c["walk"][::step])
    R_["cumulative"] = cum
    log("ruler done")

    # ----------------------------------------------------------- hard wall
    R_["hard_wall"] = Mo.hard_wall_sweep(Z[tr], y[tr], Z[ca], y[ca], Z[te], y[te])
    # Cover's theorem: n labels in d dimensions. Below n ~ 2d a separating
    # hyperplane exists whatever the labels are, and unregularised fitting
    # finds it and runs to the wall.
    cover = []
    from sklearn.linear_model import LogisticRegression
    for d in (32, 128, full_dim):
        Zd = Z[:, :d] / np.linalg.norm(Z[:, :d], axis=1, keepdims=True)
        for n in (25, 50, 100, 200, 400, 800, 1600, len(tr)):
            if n > len(tr):
                continue
            row = dict(d=int(d), n=int(n), ratio=float(n / d))
            acc, sep, ece_w, ece_r, wn, ll_w = [], [], [], [], [], []
            for s in range(3 if n < len(tr) else 1):
                sub = np.random.default_rng(s).choice(tr, size=n, replace=False)
                if len(np.unique(y[sub])) < 2:
                    continue
                mw = LogisticRegression(C=1e6, max_iter=20000).fit(Zd[sub], y[sub])
                pw = mw.predict_proba(Zd[te])[:, 1]
                acc.append(mw.score(Zd[sub], y[sub]))
                sep.append(float(mw.score(Zd[sub], y[sub]) == 1.0))
                wn.append(float(np.linalg.norm(mw.coef_)))
                ece_w.append(M.ece(pw, y[te]))
                ll_w.append(M.log_loss(pw, y[te]))
                Cb = Mo._best_C(Zd[sub], y[sub]) if n >= 50 else 1.0
                mr = LogisticRegression(C=Cb, max_iter=20000).fit(Zd[sub], y[sub])
                ece_r.append(M.ece(mr.predict_proba(Zd[te])[:, 1], y[te]))
            row.update(train_acc=float(np.mean(acc)), separable=float(np.mean(sep)), w_norm=float(np.mean(wn)),
                       ece_wall=float(np.mean(ece_w)), ece_ridge=float(np.mean(ece_r)), logloss_wall=float(np.mean(ll_w)))
            cover.append(row)
    R_["cover"] = cover
    log("hard wall + Cover done")

    # ----------------------------------------------------------- Matryoshka
    dims = [d for d in (16, 32, 64, 128, 256, 512, 768) if d <= full_dim]
    mat = []
    for d in dims:
        Zd = E.embed(texts, a.encoder, prompt=prompt, dim=d, digest=ds.digest)
        (pc, pt), info = Mo.probe_lr(Zd[tr], y[tr], [Zd[ca], Zd[te]])
        q = R.Platt().fit(pc, y[ca]).predict(pt)
        s_raw, s_cal = M.summary(pt, y[te], T(te)), M.summary(q, y[te], T(te))
        mat.append(dict(dim=d, auc=s_raw["auc"], brier_raw=s_raw["brier"], ece_raw=s_raw["ece10"],
                        brier_platt=s_cal["brier"], ece_platt=s_cal["ece10"], resolution=s_raw["resolution"],
                        fisher=E.fisher_ratio(M.logit(pt), y[te]), C=info["C"]))
    R_["matryoshka"] = mat
    log("matryoshka done")

    # ----------------------------------------------------------- task prefix
    if a.encoder == "gemma":
        from sklearn.metrics import silhouette_score
        pre = []
        for pname, ptxt in E.PROMPTS.items():
            Zp = E.embed(texts, "gemma", prompt=ptxt, digest=ds.digest)
            (pc, pt), info = Mo.probe_lr(Zp[tr], y[tr], [Zp[ca], Zp[te]])
            q = R.Platt().fit(pc, y[ca]).predict(pt)
            pre.append(dict(prompt=pname, text=ptxt, auc=M.auc(pt, y[te]), brier=M.brier(q, y[te]),
                            ece_raw=M.ece(pt, y[te]), ece_platt=M.ece(q, y[te]),
                            fisher=E.fisher_ratio(M.logit(pt), y[te]),
                            silhouette=float(silhouette_score(Zp[te], y[te], metric="cosine")),
                            C=info["C"]))
            log(f"  prefix {pname}")
        R_["prefix"] = pre

    # ----------------------------------------------------------- labels needed
    curve = []
    pc_all, pt_all = preds["probe_lr"]
    # bend the probe on purpose so there's something to repair: the honest
    # probe is nearly calibrated already, which makes for a boring curve
    bent_c = M.sigmoid(M.logit(pc_all) / 0.5 + 0.4)
    bent_t = M.sigmoid(M.logit(pt_all) / 0.5 + 0.4)
    for n in (25, 50, 100, 200, 400, 800, len(ca)):
        row = dict(n=int(min(n, len(ca))))
        for mname in ("temperature", "platt", "isotonic", "venn-abers"):
            vals = []
            for s in range(8 if n < len(ca) else 1):
                sub = np.random.default_rng(100 + s).choice(len(ca), size=min(n, len(ca)), replace=False)
                if len(np.unique(y[ca][sub])) < 2:
                    continue
                q = R.MAPS[mname]().fit(bent_c[sub], y[ca][sub]).predict(bent_t)
                vals.append((M.ece(q, y[te]), M.brier(q, y[te]),
                             M.summary(q, y[te], T(te)).get("true_ece", float("nan")) if has_truth else float("nan")))
            v = np.array(vals)
            row[mname] = dict(ece=float(v[:, 0].mean()), brier=float(v[:, 1].mean()), true_ece=float(np.nanmean(v[:, 2])) if has_truth else None)
        curve.append(row)
    R_["labels_curve"] = dict(bent=dict(T=0.5, shift=0.4), raw_ece=M.ece(bent_t, y[te]), rows=curve)
    R_["labels_needed"] = {str(d): M.labels_needed(d) for d in (0.10, 0.05, 0.02, 0.01)}
    log("labels curve done")

    # ----------------------------------------------------------- conformal + Venn-Abers
    conf = {}
    for name in ("probe_lr", "tfidf_nb", "keyword_eb"):
        pc, pt = preds[name]
        h0, h1, q = C.split_sets(pc, y[ca], pt, alpha=0.1)
        m0, m1, qm = C.mondrian(pc, y[ca], pt, alpha=0.1)
        conf[name] = dict(split=C.report(h0, h1, y[te]), mondrian=C.report(m0, m1, y[te]),
                          ece=M.ece(pt, y[te]), auc=M.auc(pt, y[te]))
    va = R.VennAbers().fit(preds["probe_lr"][0], y[ca])
    p0, p1 = va.interval(preds["probe_lr"][1])
    conf["venn_abers"] = dict(mean_width=float(np.mean(p1 - p0)), max_width=float(np.max(p1 - p0)),
                              width_by_n=[])
    for n in (50, 100, 200, 400, 800, len(ca)):
        sub = np.random.default_rng(3).choice(len(ca), size=min(n, len(ca)), replace=False)
        v = R.VennAbers().fit(preds["probe_lr"][0][sub], y[ca][sub])
        a0, a1 = v.interval(preds["probe_lr"][1][:400])
        conf["venn_abers"]["width_by_n"].append(dict(n=int(min(n, len(ca))), width=float(np.mean(a1 - a0))))
    R_["conformal"] = conf
    log("conformal done")

    # ----------------------------------------------------------- drift + loop
    dtr, dry_rest, wet = D.drift_split(ds)
    (pdry_tr,), _ = Mo.probe_lr(Z[dtr], y[dtr], [Z[dtr]])
    (praw_all,), dinfo = Mo.probe_lr(Z[dtr], y[dtr], [Z])
    rng = np.random.default_rng(0)
    dry_rest = rng.permutation(dry_rest)
    launch = dry_rest[:300]
    stream_dry = dry_rest[300:]
    platt0 = R.Platt().fit(praw_all[launch], y[launch])
    held_dry = stream_dry
    drift = dict(
        dry=M.summary(platt0.predict(praw_all[held_dry]), y[held_dry], T(held_dry)),
        wet=M.summary(platt0.predict(praw_all[wet]), y[wet], T(wet)),
        dry_bins=bins_json(platt0.predict(praw_all[held_dry]), y[held_dry]),
        wet_bins=bins_json(platt0.predict(praw_all[wet]), y[wet]),
        psi_wet=H.psi(praw_all[launch], praw_all[wet]),
        n_dry=int(len(held_dry)), n_wet=int(len(wet)),
    )
    R_["drift"] = drift
    batches = H.build_stream(stream_dry, wet, n_batches=30, batch=150, wet_weight=1 + 3 * y[wet])
    raw_b = [praw_all[b] for b in batches]
    y_b = [y[b] for b in batches]
    # The storm draws water tweets with weight 1 + 3y, a label shift. Inside
    # the stream the true P(y | text) for a water tweet is therefore no longer
    # p_true but its prior-corrected version, 4t / (4t + 1 - t) (Saerens et al.
    # 2002): the same tweet is likelier to be real when it arrives mid-storm.
    # The oracle has to move with the world, or it scores the maps that
    # followed the storm as wrong.
    if has_truth:
        tilted = np.where(ds.water, 4 * truth / (4 * truth + (1 - truth)), truth)
    t_b = [tilted[b] if has_truth else None for b in batches]
    wseg = ds.water.astype(int)
    sim = H.simulate(raw_b, y_b, t_b, praw_all[launch], y[launch], budget=30, delay=2, seeds=seeds,
                     seg_stream=[wseg[b] for b in batches], launch_seg=wseg[launch])
    sim["wet_share"] = [float(ds.water[b].mean()) for b in batches]
    sim["batch"] = 150
    sim["budget"] = 30
    R_["loop"] = sim
    log("loop done")

    # ----------------------------------------------------------- examples
    # tweets for the opening slide: what a calibrated probe says about a few
    # real rows, picked by rule so the real data picks its own
    pl = p_lr
    ex_rules = [
        ("sure, and right", np.flatnonzero((y[te] == 1) & (pl > 0.9))),
        ("sure it's nothing", np.flatnonzero((y[te] == 0) & (pl < 0.05))),
        ("a coin flip", np.flatnonzero(np.abs(pl - 0.5) < 0.04)),
        ("confident miss", np.flatnonzero((y[te] == 1) & (pl < 0.15))),
        ("confident false alarm", np.flatnonzero((y[te] == 0) & (pl > 0.85))),
    ]
    examples = []
    rng_ex = np.random.default_rng(5)
    for label, cand in ex_rules:
        if len(cand):
            i = int(rng_ex.choice(cand))
            row = int(te[i])
            examples.append(dict(kind=label, text=str(ds.df["text"].iloc[row]), keyword=str(ds.df["keyword"].iloc[row]),
                                 p=float(pl[i]), y=int(y[row]), p_true=float(truth[row]) if has_truth else None))
    R_["examples"] = examples

    # ----------------------------------------------------------- write
    def clean(o):
        if isinstance(o, dict):
            return {k: clean(v) for k, v in o.items()}
        if isinstance(o, (list, tuple)):
            return [clean(v) for v in o]
        if isinstance(o, (np.floating, float)):
            return None if not np.isfinite(o) else round(float(o), 6)
        if isinstance(o, np.integer):
            return int(o)
        return o

    (out_dir / "results.json").write_text(json.dumps(clean(R_), indent=1))
    (out_dir / "summary.md").write_text(summary_md(R_))
    log(f"wrote {out_dir}/results.json")
    print(summary_md(R_))


def summary_md(R_) -> str:
    m = R_["meta"]
    L = [f"# {m['dataset']} / {m['encoder']}  ({m['n']} rows, base rate {m['base_rate']:.3f}, generated {m['generated']})", ""]
    L.append("## ladder (test split, raw scores)\n")
    L.append("| model | AUC | Brier | log loss | ECE10 | smECE | KS p | reliability | resolution | T fit |" + (" true ECE |" if m["has_truth"] else ""))
    L.append("|---|---|---|---|---|---|---|---|---|---|" + ("---|" if m["has_truth"] else ""))
    for k, s in R_["ladder"].items():
        row = f"| {k} | {s['auc']:.3f} | {s['brier']:.4f} | {s['log_loss']:.3f} | {s['ece10']:.3f} | {s['smece']:.3f} | {s['ks_p']:.2g} | {s['reliability']:.4f} | {s['resolution']:.4f} | {s['T_fit']:.2f} |"
        if m["has_truth"]:
            row += f" {s.get('true_ece', float('nan')):.3f} |"
        L.append(row)
    L.append("\n## recalibrated ECE10 on test (maps fitted on the calibration split)\n")
    maps = list(R.MAPS)
    L.append("| model | " + " | ".join(maps) + " |")
    L.append("|---|" + "---|" * len(maps))
    for k, d in R_["recal"].items():
        L.append(f"| {k} | " + " | ".join(f"{d[mm]['ece10']:.3f}" if mm in d else "" for mm in maps) + " |")
    r = R_["richardson"]
    L.append(f"\n## the ruler\n\nslope of log ECE vs log bins: null {r['null']['slope']:.2f}, probe+Platt {r['probe_lr_platt']['slope']:.2f}, naive Bayes {r['tfidf_nb']['slope']:.2f}" +
             (f", oracle {r['oracle']['slope']:.2f}" if "oracle" in r else ""))
    L.append(f"crossover bins (finest map these labels support): probe+Platt {r['probe_lr_platt']['crossover_bins']}, naive Bayes {r['tfidf_nb']['crossover_bins']}")
    L.append("\n## Cover / hard wall (unregularised head)\n")
    L.append("| d | n | n/d | train acc | separable | |w| | ECE wall | ECE ridge |")
    L.append("|---|---|---|---|---|---|---|---|")
    for c in R_["cover"]:
        L.append(f"| {c['d']} | {c['n']} | {c['ratio']:.2f} | {c['train_acc']:.3f} | {c['separable']:.2f} | {c['w_norm']:.1f} | {c['ece_wall']:.3f} | {c['ece_ridge']:.3f} |")
    L.append("\n## Matryoshka\n")
    L.append("| dim | AUC | ECE raw | ECE Platt | Brier Platt | Fisher |")
    L.append("|---|---|---|---|---|---|")
    for x in R_["matryoshka"]:
        L.append(f"| {x['dim']} | {x['auc']:.3f} | {x['ece_raw']:.3f} | {x['ece_platt']:.3f} | {x['brier_platt']:.4f} | {x['fisher']:.3f} |")
    if "prefix" in R_:
        L.append("\n## task prefix (EmbeddingGemma)\n")
        L.append("| prompt | AUC | Brier (Platt) | ECE raw | Fisher | silhouette |")
        L.append("|---|---|---|---|---|---|")
        for x in R_["prefix"]:
            L.append(f"| {x['prompt']} | {x['auc']:.3f} | {x['brier']:.4f} | {x['ece_raw']:.3f} | {x['fisher']:.3f} | {x['silhouette']:.3f} |")
    L.append("\n## labels needed (probe bent to T=0.5, +0.4 logit; test ECE after repair)\n")
    lc = R_["labels_curve"]
    L.append(f"unrepaired ECE {lc['raw_ece']:.3f}\n")
    L.append("| labels | temperature | platt | isotonic | venn-abers |")
    L.append("|---|---|---|---|---|")
    for row in lc["rows"]:
        L.append(f"| {row['n']} | " + " | ".join(f"{row[k]['ece']:.3f}" for k in ("temperature", "platt", "isotonic", "venn-abers")) + " |")
    L.append("\n## conformal (alpha = 0.1)\n")
    L.append("| model | ECE | coverage | cov y=1 | cov y=0 | singletons | both | Mondrian cov y=1 | Mondrian cov y=0 |")
    L.append("|---|---|---|---|---|---|---|---|---|")
    for k in ("probe_lr", "tfidf_nb", "keyword_eb"):
        c = R_["conformal"][k]
        s, mo = c["split"], c["mondrian"]
        L.append(f"| {k} | {c['ece']:.3f} | {s['coverage']:.3f} | {s['coverage_pos']:.3f} | {s['coverage_neg']:.3f} | {s['singleton']:.3f} | {s['both']:.3f} | {mo['coverage_pos']:.3f} | {mo['coverage_neg']:.3f} |")
    va = R_["conformal"]["venn_abers"]
    L.append(f"\nVenn-Abers mean interval width {va['mean_width']:.4f}; by n: " + ", ".join(f"{w['n']}: {w['width']:.3f}" for w in va["width_by_n"]))
    d = R_["drift"]
    L.append(f"\n## drift (trained dry, launch map on 300 dry labels)\n\ndry ECE {d['dry']['ece10']:.3f} (n={d['n_dry']}), wet ECE {d['wet']['ece10']:.3f} (n={d['n_wet']}), "
             f"wet mean p {d['wet']['mean_p']:.3f} vs base rate {d['wet']['base_rate']:.3f}, PSI {d['psi_wet']:.3f}")
    lp = R_["loop"]
    nb = len(lp["wet_share"])
    late = slice(int(0.7 * nb), nb)
    L.append("\n## the loop (last 30% of batches, mean over seeds)\n")
    L.append("| policy | Brier | calib-in-the-large | |count error| per batch |" + (" MSE vs oracle |" if m["has_truth"] else ""))
    L.append("|---|---|---|---|" + ("---|" if m["has_truth"] else ""))
    for k in ("frozen", "flagged", "uncertainty", "random", "stratified", "stratified-window6", "stratified-window6-segmented"):
        if k not in lp:
            continue
        v = lp[k]
        row = f"| {k} | {np.mean(v['brier']['mean'][late]):.4f} | {np.mean(v['citl']['mean'][late]):+.3f} | {np.mean(np.abs(v['count_err']['mean'][late])):.1f} |"
        if m["has_truth"]:
            row += f" {np.nanmean(v['true_mse']['mean'][late]):.4f} |"
        L.append(row)
    L.append("\n| policy | true misses / batch | team's estimate | calib-in-the-large below threshold |")
    L.append("|---|---|---|---|")
    for k in ("flagged", "uncertainty", "random", "stratified"):
        v = lp[k]
        L.append(f"| {k} | {np.mean(v['true_missed']['mean'][late]):.1f} | {np.nanmean(v['est_missed']['mean'][late]):.1f} | {np.nanmean(v['low_citl']['mean'][late]):+.3f} |")
    L.append(f"\nACI coverage late {np.mean(lp['aci']['aci'][late]):.3f} vs static split conformal {np.mean(lp['aci']['static'][late]):.3f} (target 0.90)")
    return "\n".join(L) + "\n"


if __name__ == "__main__":
    main()
