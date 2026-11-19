"""results.json -> Astro SVG figures, in the calibration series' house style.

    uv run python -m lab.figures                       # newest results dir
    uv run python -m lab.figures results/real-gemma    # a specific run

Writes apps/site/src/components/haze/*.astro. Colours are theme tokens, never
hex, with the series' fixed identities: amber is the honest forecaster, rose
the dishonest one, blue the reference (null, oracle, or a third model), and
muted ink for everything shown only for context. Hover text rides on <title>
elements, as in the existing figures.
"""

from __future__ import annotations

import json
import math
import sys
from html import escape
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
SITE = ROOT.parent.parent / "apps" / "site" / "src" / "components" / "haze"

AMBER, ROSE, BLUE, MUTED, DIM = "var(--viz-amber)", "var(--viz-rose)", "var(--viz-blue)", "var(--text-muted)", "var(--text-dim)"

STYLE = """
<style>
  .fig { width: 100%; height: auto; display: block; margin: 1.6rem auto 0.6rem; }
  .fig text { font-family: var(--font-jetbrains); fill: var(--text-dim); }
  .fig .tick { font-size: 11px; }
  .fig .label { font-size: 11.5px; fill: var(--text-muted); }
  .fig .mid { text-anchor: middle; }
  .fig .end { text-anchor: end; }
  .fig .grid { stroke: var(--border); stroke-width: 1; }
  .fig .axis { stroke: var(--border); stroke-width: 1.5; }
  .fig .ref { stroke: var(--text-muted); stroke-width: 1.5; stroke-dasharray: 4 4; fill: none; }
  .fig .series { fill: none; stroke-width: 2; stroke-linecap: round; stroke-linejoin: round; }
  .fig .key { font-size: 11.5px; fill: var(--text); }
  .fig .note { font-size: 11px; fill: var(--text-muted); }
  .fig .big { font-size: 13px; fill: var(--text); }
  figcaption {
    font-family: var(--font-jetbrains);
    font-size: 0.72rem;
    line-height: 1.5;
    color: var(--text-muted);
    max-width: 36rem;
    margin: 0 auto 2.2rem;
    text-align: center;
  }
</style>
"""


def f(x, nd=2):
    return f"{x:.{nd}f}".rstrip("0").rstrip(".") if isinstance(x, float) else str(x)


class Plot:
    def __init__(self, x0, x1, y0, y1, w=660, h=380, left=66, right=110, top=30, bottom=48,
                 xlog=False, ylog=False):
        self.w, self.h = w, h
        self.L, self.R, self.T, self.B = left, w - right, top, h - bottom
        self.x0, self.x1, self.y0, self.y1 = x0, x1, y0, y1
        self.xlog, self.ylog = xlog, ylog
        self.parts: list[str] = []
        self.keys = 0

    def X(self, x):
        if self.xlog:
            x, a, b = math.log10(max(x, 1e-12)), math.log10(self.x0), math.log10(self.x1)
        else:
            a, b = self.x0, self.x1
        return round(self.L + (x - a) / (b - a) * (self.R - self.L), 2)

    def Y(self, y):
        if self.ylog:
            y, a, b = math.log10(max(y, 1e-12)), math.log10(self.y0), math.log10(self.y1)
        else:
            a, b = self.y0, self.y1
        return round(self.B - (y - a) / (b - a) * (self.B - self.T), 2)

    def frame(self, xt, yt, xlabel, ylabel, xfmt=f, yfmt=f):
        p = self.parts
        for v in xt:
            p.append(f'<line x1="{self.X(v)}" y1="{self.T}" x2="{self.X(v)}" y2="{self.B}" class="grid" />')
            p.append(f'<text x="{self.X(v)}" y="{self.B + 20}" class="tick mid">{xfmt(v)}</text>')
        for v in yt:
            p.append(f'<line x1="{self.L}" y1="{self.Y(v)}" x2="{self.R}" y2="{self.Y(v)}" class="grid" />')
            p.append(f'<text x="{self.L - 10}" y="{self.Y(v) + 4}" class="tick end">{yfmt(v)}</text>')
        p.append(f'<line x1="{self.L}" y1="{self.B}" x2="{self.R}" y2="{self.B}" class="axis" />')
        p.append(f'<line x1="{self.L}" y1="{self.T}" x2="{self.L}" y2="{self.B}" class="axis" />')
        p.append(f'<text x="{(self.L + self.R) / 2}" y="{self.h - 8}" class="label mid">{escape(xlabel)}</text>')
        yc = (self.T + self.B) / 2
        p.append(f'<text x="14" y="{yc}" class="label mid" transform="rotate(-90 14 {yc})">{escape(ylabel)}</text>')

    def line(self, pts, color, width=2, dash=None, opacity=0.9):
        pts = [(x, y) for x, y in pts if y is not None and x is not None]
        if not pts:
            return
        d = " ".join(("M" if i == 0 else "L") + f"{self.X(x)} {self.Y(y)}" for i, (x, y) in enumerate(pts))
        da = f' stroke-dasharray="{dash}"' if dash else ""
        self.parts.append(f'<path class="series" d="{d}" stroke="{color}" stroke-width="{width}" opacity="{opacity}"{da} />')

    def ref(self, pts):
        d = " ".join(("M" if i == 0 else "L") + f"{self.X(x)} {self.Y(y)}" for i, (x, y) in enumerate(pts))
        self.parts.append(f'<path class="ref" d="{d}" />')

    def band(self, xs, lo, hi, color, opacity=0.14):
        top = [f"{self.X(x)} {self.Y(y)}" for x, y in zip(xs, hi)]
        bot = [f"{self.X(x)} {self.Y(y)}" for x, y in zip(reversed(xs), reversed(lo))]
        self.parts.append(f'<path d="M{" L".join(top)} L{" L".join(bot)} Z" fill="{color}" opacity="{opacity}" stroke="none" />')

    def rect(self, x0, x1, color, opacity=0.08):
        self.parts.append(f'<rect x="{self.X(x0)}" y="{self.T}" width="{self.X(x1) - self.X(x0)}" height="{self.B - self.T}" fill="{color}" opacity="{opacity}" />')

    def dots(self, pts, color, r=4.5, titles=None):
        for i, (x, y) in enumerate(pts):
            if y is None:
                continue
            t = f"<title>{escape(titles[i])}</title>" if titles else ""
            self.parts.append(f'<circle cx="{self.X(x)}" cy="{self.Y(y)}" r="{r}" fill="{color}" stroke="var(--bg)" stroke-width="2">{t}</circle>')

    def errbars(self, xs, lo, hi, color):
        for x, a, b in zip(xs, lo, hi):
            self.parts.append(f'<line x1="{self.X(x)}" y1="{self.Y(a)}" x2="{self.X(x)}" y2="{self.Y(b)}" stroke="{color}" stroke-width="1.5" opacity="0.55" />')

    def text(self, x, y, s, cls="note", anchor=None, px=False, dx=0, dy=0):
        X = (x if px else self.X(x)) + dx
        Y = (y if px else self.Y(y)) + dy
        a = f' text-anchor="{anchor}"' if anchor else ""
        self.parts.append(f'<text x="{X}" y="{Y}" class="{cls}"{a}>{escape(s)}</text>')

    def key(self, label, color, sub=None, dash=None):
        y = self.T + 8 + self.keys * 42
        da = f' stroke-dasharray="{dash}"' if dash else ""
        self.parts.append(f'<line x1="{self.R + 12}" y1="{y}" x2="{self.R + 26}" y2="{y}" stroke="{color}" stroke-width="2.5" stroke-linecap="round"{da} />')
        self.parts.append(f'<text x="{self.R + 12}" y="{y + 18}" class="key">{escape(label)}</text>')
        if sub:
            self.parts.append(f'<text x="{self.R + 12}" y="{y + 32}" class="note">{escape(sub)}</text>')
        self.keys += 1

    def svg(self, aria):
        body = "\n    ".join(self.parts)
        return (f'<svg class="fig" viewBox="0 0 {self.w} {self.h}" role="img" aria-label="{escape(aria)}">\n    {body}\n  </svg>')


def component(name, svg, caption):
    src = (
        "---\n// Generated by packages/calibration-lab/lab/figures.py from results.json. Do not edit by hand.\n"
        "interface Props { caption?: boolean }\nconst { caption = true } = Astro.props;\n---\n\n"
        f"<figure>\n  {svg}\n  {{caption && <figcaption>{escape(caption)}</figcaption>}}\n</figure>\n{STYLE}"
    )
    SITE.mkdir(parents=True, exist_ok=True)
    (SITE / f"{name}.astro").write_text(src)
    return name


# ---------------------------------------------------------------- figures


def fig_two_axes(R):
    """Every model on the plane Murphy's decomposition defines."""
    lad = R["ladder"]
    names = {"keyword_eb": "keyword rates", "tfidf_nb": "naive Bayes", "tfidf_lr": "TF-IDF + LR",
             "tfidf_gbm": "TF-IDF + GBM", "probe_lr": "probe", "probe_wall": "probe, no L2",
             "probe_mlp": "MLP head", "probe_tabpfn": "TabPFN head", "jev_mock": "Jev (mock)", "jev": "Jev",
             "oracle": "oracle"}
    rmax = max(s["reliability"] for s in lad.values())
    xmax = max(s["resolution"] for s in lad.values())
    p = Plot(0, round(xmax * 1.15, 3), 0, rmax * 1.15, right=40)
    xt = [round(i * xmax * 1.15 / 4, 3) for i in range(5)]
    yt = [round(i * rmax * 1.15 / 4, 4) for i in range(5)]
    p.frame(xt, yt, "resolution: how much it knows", "reliability: how dishonest", xfmt=lambda v: f"{v:.3f}", yfmt=lambda v: f"{v:.3f}")
    for k, s in lad.items():
        c = ROSE if s["reliability"] > 0.01 else (BLUE if k == "oracle" else AMBER)
        p.dots([(s["resolution"], s["reliability"])], c, titles=[f"{names.get(k, k)}: reliability {s['reliability']:.4f}, resolution {s['resolution']:.4f}, AUC {s['auc']:.3f}"])
        p.text(s["resolution"], s["reliability"], names.get(k, k), dx=8, dy=-6 if k not in ("tfidf_gbm", "probe_mlp") else 14)
    nb = lad.get("tfidf_nb")
    cap = ("Murphy's split of the Brier score puts every model on two independent axes. "
           f"Keyword rates are honest and nearly useless; naive Bayes knows a lot and lies about it "
           f"(reliability {nb['reliability']:.3f}). Down and to the right is better.")
    return component("TwoAxes", p.svg("Each model plotted by resolution against reliability."), cap)


def fig_reliability(R):
    rel = R["reliability"]
    p = Plot(0, 1, 0, 1)
    t = [0, 0.25, 0.5, 0.75, 1]
    p.frame(t, t, "probability the model claimed", "how often it happened")
    p.ref([(0, 0), (1, 1)])
    for key, sub, c, label in (("tfidf_nb", "raw", ROSE, "naive Bayes"), ("tfidf_nb", "platt", AMBER, "after Platt"),
                               ("probe_lr", "raw", BLUE, "probe")):
        bs = [b for b in rel[key][sub] if b["n"] >= 5]
        pts = [(b["claimed"], b["happened"]) for b in bs]
        p.line(pts, c, opacity=0.8)
        p.errbars([b["claimed"] for b in bs], [b["ci_lo"] for b in bs], [b["ci_hi"] for b in bs], c)
        p.dots(pts, c, titles=[f"{label}: claimed {b['claimed']:.2f}, happened {b['happened']:.2f} (n={int(b['n'])})" for b in bs])
        p.key(label, c, {"naive Bayes": "raw", "after Platt": "two numbers", "probe": "frozen encoder + head"}[label])
    cap = ("Ten bins of test tweets, with 95% intervals. Naive Bayes double-counts correlated words and pins its "
           "forecasts to the corners; two fitted numbers bring it back to the diagonal without changing a single ranking. "
           "The linear probe needed no repair.")
    return component("Reliability", p.svg("Reliability diagram: naive Bayes raw, naive Bayes after Platt scaling, and the linear probe."), cap)


def fig_ruler(R):
    r = R["richardson"]
    allb = r["null"]["bins"]
    ymin = min(min(v for v in r[k]["ece"] if v > 0) for k in ("null", "tfidf_nb", "probe_lr_platt"))
    ymax = max(max(r[k]["ece"]) for k in ("null", "tfidf_nb", "probe_lr_platt"))
    p = Plot(1, max(allb), 10 ** math.floor(math.log10(ymin)), 10 ** math.ceil(math.log10(ymax)), xlog=True, ylog=True, right=130)
    xt = [v for v in (1, 3, 10, 30, 100, 300, 1000) if v <= max(allb)]
    yt = [10 ** e for e in range(math.floor(math.log10(ymin)), math.ceil(math.log10(ymax)) + 1)]
    p.frame(xt, yt, "number of bins (a finer ruler →)", "binned ECE", yfmt=lambda v: f"{v:g}")
    nf = r["null"]
    p.ref(list(zip(nf["bins"], nf["noise_floor"])))
    for k, c, label, sub in (("null", BLUE, "calibrated", "by construction"),
                             ("probe_lr_platt", AMBER, "probe", "after Platt"),
                             ("tfidf_nb", ROSE, "naive Bayes", "raw")):
        p.line(list(zip(r[k]["bins"], r[k]["ece"])), c)
        p.key(label, c, f"{sub}, slope {r[k]['slope']:.2f}")
    p.text(nf["bins"][-1], nf["noise_floor"][-1], "√(B/n) noise", anchor="end", dy=16)
    cap = (f"ECE against bin count on {r['null']['n']} test tweets, log-log. A calibrated model's error is pure noise and "
           f"grows like the square root of the bin count, slope {r['null']['slope']:.2f}: the coastline law for a Brownian "
           "trace, dimension 1.5. Naive Bayes sits on a plateau, its real error, until the ruler gets fine enough for noise to win.")
    return component("Ruler", p.svg("Binned ECE against number of bins, log-log, for a calibrated model, the probe and naive Bayes."), cap)


def fig_walk(R):
    cu = R["cumulative"]
    lim = max(max(abs(v) for v in cu[k]["walk"]) for k in ("tfidf_nb", "probe_lr_platt", "null"))
    lim = max(lim, 3 * cu["null"]["sd"])
    p = Plot(0, 1, -lim * 1.1, lim * 1.1, right=130)
    p.frame([0, 0.25, 0.5, 0.75, 1], [round(-lim, 3), 0, round(lim, 3)], "forecast, sorted", "running Σ(y − p) / n",
            yfmt=lambda v: f"{v:+.3f}" if v else "0")
    sd = cu["null"]["sd"]
    # 95% envelope for sup|B| on [0,1] is about 2.24 sd; the pointwise one grows like sqrt(t)
    xs = [i / 50 for i in range(51)]
    p.band(xs, [-2.24 * sd] * 51, [2.24 * sd] * 51, BLUE, 0.10)
    for k, c, label, sub in (("null", BLUE, "calibrated", "by construction"), ("probe_lr_platt", AMBER, "probe", "after Platt"),
                             ("tfidf_nb", ROSE, "naive Bayes", "raw")):
        p.line(list(zip(cu[k]["x"], cu[k]["walk"])), c, width=1.6)
        p.key(label, c, f"{sub}, p = {cu[k]['p_value']:.2g}")
    cap = ("The binning-free test. Sort by forecast and keep a running sum of outcome minus forecast. A calibrated "
           "model's walk is a random walk and stays in the shaded band, the 95% range of a Brownian excursion. "
           "Measure how far the walk strays, not how long it is.")
    return component("Walk", p.svg("Cumulative calibration walk with Brownian envelope for three forecasters."), cap)


def fig_cover(R):
    rows = [c for c in R["cover"] if c["d"] == max(c["d"] for c in R["cover"])]
    d = rows[0]["d"]
    xs = [c["ratio"] for c in rows]
    ymax = max(max(c["ece_wall"] for c in rows), max(c["ece_ridge"] for c in rows)) * 1.15
    p = Plot(min(xs) * 0.8, max(xs) * 1.25, 0, ymax, xlog=True, right=130)
    xt = [v for v in (0.1, 0.25, 0.5, 1, 2, 4, 8, 16) if min(xs) * 0.8 <= v <= max(xs) * 1.25]
    p.frame(xt, [round(i * ymax / 4, 2) for i in range(5)], f"labels per dimension (n / d, d = {d})", "test ECE", xfmt=lambda v: f"{v:g}")
    sep = [c for c in rows if c["separable"] >= 0.5]
    if sep:
        p.rect(min(xs) * 0.8, max(c["ratio"] for c in sep) * 1.15, ROSE, 0.07)
        p.text(min(xs) * 0.85, ymax * 0.95, "training labels separable", dx=4)
    p.line([(c["ratio"], c["ece_wall"]) for c in rows], ROSE)
    p.dots([(c["ratio"], c["ece_wall"]) for c in rows], ROSE, r=3.5,
           titles=[f"n={c['n']}, no L2: ECE {c['ece_wall']:.3f}, |w| {c['w_norm']:.0f}, train acc {c['train_acc']:.3f}" for c in rows])
    p.line([(c["ratio"], c["ece_ridge"]) for c in rows], AMBER)
    p.dots([(c["ratio"], c["ece_ridge"]) for c in rows], AMBER, r=3.5,
           titles=[f"n={c['n']}, L2 by CV: ECE {c['ece_ridge']:.3f}" for c in rows])
    p.ref([(2, 0), (2, ymax)])
    p.text(2, ymax * 0.82, "n = 2d", dx=5)
    p.key("hard wall", ROSE, "no penalty")
    p.key("soft wall", AMBER, "L2, chosen by CV")
    cap = (f"A head on a {d}-dimensional embedding, trained on n labels. Below about two labels per dimension a separating "
           "hyperplane almost always exists (Cover, 1965), and an unpenalised fit finds it, drives the weights to infinity "
           "and slams every probability into 0 or 1. The hyperplane is always there. The probability is the penalty's doing.")
    return component("Cover", p.svg("Test ECE of an unregularised and a regularised probe as labels per dimension grow."), cap)


def fig_labels(R):
    lc = R["labels_curve"]["rows"]
    ns = [r["n"] for r in lc]
    ymax = R["labels_curve"]["raw_ece"] * 1.1
    p = Plot(min(ns) * 0.8, max(ns) * 1.25, 0, ymax, xlog=True, right=130)
    p.frame([v for v in (25, 50, 100, 200, 400, 800, 1600) if v <= max(ns) * 1.25], [round(i * ymax / 4, 3) for i in range(5)],
            "labels used to fit the map", "test ECE after repair", xfmt=lambda v: f"{v:g}")
    p.ref([(min(ns) * 0.8, R["labels_curve"]["raw_ece"]), (max(ns) * 1.25, R["labels_curve"]["raw_ece"])])
    p.text(max(ns) * 1.2, R["labels_curve"]["raw_ece"], "unrepaired", anchor="end", dy=-6)
    for k, c, sub in (("temperature", BLUE, "1 number"), ("platt", AMBER, "2 numbers"), ("isotonic", ROSE, "a step function"),
                      ("venn-abers", MUTED, "isotonic, twice")):
        p.line([(r["n"], r[k]["ece"]) for r in lc], c, dash="5 4" if k == "venn-abers" else None)
        p.key(k, c, sub, dash="5 4" if k == "venn-abers" else None)
    cap = ("The probe, bent on purpose (cooled to T = 0.5, shifted +0.4 in log-odds), repaired with a growing pile of labels. "
           "Fewer parameters win early; the flexible maps need hundreds of labels before they stop fitting noise. "
           "Temperature stalls because it can't undo the shift.")
    return component("Labels", p.svg("Test ECE after recalibration against number of labels, for four maps."), cap)


def fig_drift(R):
    dr = R["drift"]
    p = Plot(0, 1, 0, 1)
    t = [0, 0.25, 0.5, 0.75, 1]
    p.frame(t, t, "probability the model claimed", "how often it happened")
    p.ref([(0, 0), (1, 1)])
    for key, c, label, sub in (("dry_bins", AMBER, "dry tweets", f"ECE {dr['dry']['ece10']:.3f}"),
                               ("wet_bins", ROSE, "water tweets", f"ECE {dr['wet']['ece10']:.3f}")):
        bs = [b for b in dr[key] if b["n"] >= 5]
        pts = [(b["claimed"], b["happened"]) for b in bs]
        p.line(pts, c, opacity=0.8)
        p.errbars([b["claimed"] for b in bs], [b["ci_lo"] for b in bs], [b["ci_hi"] for b in bs], c)
        p.dots(pts, c, titles=[f"{label}: claimed {b['claimed']:.2f}, happened {b['happened']:.2f} (n={int(b['n'])})" for b in bs])
        p.key(label, c, sub)
    cap = ("Trained and calibrated on tweets with no water keywords, scored on the floods and hurricanes it never saw. "
           "Same model, same map, a different world: the curve lifts off the diagonal where the new vocabulary lands.")
    return component("Drift", p.svg("Reliability on dry versus water tweets for a model trained only on dry tweets."), cap)


def fig_loop(R):
    lp = R["loop"]
    nb = len(lp["wet_share"])
    xs = list(range(1, nb + 1))
    true = lp["stratified"]["true_missed"]["mean"]
    ymax = max(max(true), max(v for v in lp["random"]["est_missed"]["mean"] if v is not None)) * 1.2
    p = Plot(1, nb, 0, ymax, right=140)
    p.frame([1] + [v for v in range(5, nb + 1, 5)], [round(i * ymax / 4) for i in range(5)], "batch (150 tweets each)",
            "real disasters below the threshold")
    on = next((i + 1 for i, w in enumerate(lp["wet_share"]) if w > 0), None)
    if on:
        p.rect(on - 0.5, nb, BLUE, 0.07)
        p.text(on, ymax * 0.95, "the storm arrives", dx=4)
    p.line(list(zip(xs, true)), MUTED, width=2.5)
    p.key("actual misses", MUTED, "nobody sees this")
    for k, c, label, sub in (("stratified", AMBER, "stratified + audit", "weighted estimate"),
                             ("flagged", ROSE, "label the flagged", "what it reports")):
        e = lp[k]["est_missed"]
        p.band(xs, [v if v is not None else 0 for v in e["lo"]], [v if v is not None else 0 for v in e["hi"]], c, 0.12)
        p.line(list(zip(xs, [v if v is not None else 0 for v in e["mean"]])), c)
        p.key(label, c, sub)
    late = slice(int(0.7 * nb), nb)
    import statistics as st
    tm = st.mean(true[late])
    cap = (f"The same {R['loop']['budget']} labels per batch, spent two ways. Labelling only the tweets you dispatched on "
           "reports zero misses forever, because a miss is by definition a tweet you didn't flag. Diverting a fifth of the "
           f"budget to a random audit, weighted back up, tracks the real count (about {tm:.0f} a batch once the storm hits).")
    return component("Loop", p.svg("Missed disasters per batch: actual, estimated by a flagged-only queue, and by a stratified audit."), cap)


def fig_forget(R):
    """How wrong the map is over time, for four ways of running the loop."""
    lp = R["loop"]
    nb = len(lp["wet_share"])
    xs = list(range(1, nb + 1))
    has_truth = R["meta"]["has_truth"]
    key = "true_mse" if has_truth else "brier"
    series = [("frozen", ROSE, "frozen", "launch map, never refit"),
              ("stratified", MUTED, "refit on everything", "remembers the calm"),
              ("stratified-window6", BLUE, "refit, forget", "last 6 batches"),
              ("stratified-window6-segmented", AMBER, "forget + segment", "one map per family")]
    series = [s for s in series if s[0] in lp]

    def smooth(v, k=3):
        v = [x if x is not None else float("nan") for x in v]
        out = []
        for i in range(len(v)):
            w = [x for x in v[max(0, i - k + 1): i + 1] if x == x]
            out.append(sum(w) / len(w) if w else None)
        return out

    vals = [smooth(lp[k][key]["mean"]) for k, *_ in series]
    ymax = max(max(v for v in s if v is not None) for s in vals) * 1.15
    ymin = 0 if has_truth else min(min(v for v in s if v is not None) for s in vals) * 0.95
    p = Plot(1, nb, ymin, ymax, right=150)
    p.frame([1] + list(range(5, nb + 1, 5)), [round(ymin + i * (ymax - ymin) / 4, 3) for i in range(5)], "batch (150 tweets each)",
            "error vs the truth (MSE)" if has_truth else "Brier score (3-batch mean)", yfmt=lambda v: f"{v:.3f}")
    on = next((i + 1 for i, w in enumerate(lp["wet_share"]) if w > 0), None)
    if on:
        p.rect(on - 0.5, nb, BLUE, 0.07)
        p.text(on, ymax * 0.96, "the storm arrives", dx=4)
    for (k, c, label, sub), v in zip(series, vals):
        p.line(list(zip(xs, v)), c, width=2.5 if k.endswith("segmented") else 2)
        p.key(label, c, sub)
    late = slice(int(0.7 * nb), nb)
    import statistics as st
    fr = st.mean([x for x in lp["frozen"][key]["mean"][late] if x is not None])
    sg = st.mean([x for x in lp[series[-1][0]][key]["mean"][late] if x is not None])
    cap = (f"Same labels, same budget, four memories. A map that never refits drifts away when the storm comes; one that refits "
           "on everything it has ever seen is outvoted by the calm; one that forgets follows the storm but stretches one curve over "
           f"two populations. Forgetting plus one map per keyword family ends {fr / sg:.1f}× closer to the truth than the frozen map.")
    return component("Forget", p.svg("Calibration error over batches for four ways of running the recalibration loop."), cap)


def fig_matryoshka(R):
    m = R["matryoshka"]
    ds = [x["dim"] for x in m]
    lo = min(min(x["brier_platt"] for x in m), R["ladder"].get("oracle", {}).get("brier", 1)) * 0.95
    hi = max(x["brier_platt"] for x in m) * 1.05
    p = Plot(min(ds) / 1.3, max(ds) * 1.3, lo, hi, xlog=True, right=130)
    p.frame(ds, [round(lo + i * (hi - lo) / 4, 3) for i in range(5)], "embedding dimensions kept", "Brier after Platt (lower is better)",
            yfmt=lambda v: f"{v:.3f}")
    p.line([(x["dim"], x["brier_platt"]) for x in m], AMBER)
    p.dots([(x["dim"], x["brier_platt"]) for x in m], AMBER,
           titles=[f"{x['dim']} dims: Brier {x['brier_platt']:.4f}, AUC {x['auc']:.3f}, ECE {x['ece_platt']:.3f}" for x in m])
    p.key("probe", AMBER, "logistic head")
    if "oracle" in R["ladder"]:
        b = R["ladder"]["oracle"]["brier"]
        p.ref([(min(ds) / 1.3, b), (max(ds) * 1.3, b)])
        p.key("oracle", MUTED, f"Brier {b:.3f}", dash="4 4")
    cap = ("Truncating the embedding and re-normalising, the way a Matryoshka model is meant to be shortened. "
           "Every dimension dropped costs information, which no calibration map can buy back.")
    return component("Matryoshka", p.svg("Brier score of the probe against number of embedding dimensions."), cap)


def fig_prefix(R):
    pre = R.get("prefix")
    if not pre:
        p = Plot(0, 1, 0, 1, right=40)
        p.text(330, 190, "run with --encoder gemma to fill this in", cls="big", anchor="middle", px=True)
        return component("Prefix", p.svg("Placeholder: task prefix comparison needs the EmbeddingGemma run."),
                         "Task prefix comparison: needs the EmbeddingGemma run.")
    xmax = max(x["fisher"] for x in pre) * 1.15
    w, row = 660, 44
    h = 40 + row * len(pre) + 40
    p = Plot(0, xmax, 0, len(pre), h=h, left=150, right=60)
    p.frame([round(i * xmax / 4, 2) for i in range(5)], [], "class separation along the probe (Fisher ratio)", "")
    for i, x in enumerate(pre):
        y = p.T + 10 + i * row
        p.parts.append(f'<rect x="{p.L}" y="{y}" width="{p.X(x["fisher"]) - p.L}" height="18" rx="4" fill="{AMBER if x["prompt"] != "none" else MUTED}"><title>{escape(x["text"] or "(no prefix)")}: AUC {x["auc"]:.3f}, Brier {x["brier"]:.4f}</title></rect>')
        p.text(p.L - 8, y + 13, x["prompt"], cls="key", anchor="end", px=True)
        p.text(p.X(x["fisher"]) + 6, y + 13, f"AUC {x['auc']:.3f}", px=True)
    best = max(pre, key=lambda x: x["fisher"])
    cap = (f"EmbeddingGemma with each task prefix. The '{best['prompt']}' prefix pulls the classes furthest apart along the probe "
           "direction. Separation is resolution; it is the thing a prefix can buy and a calibration map can't.")
    return component("Prefix", p.svg("Fisher ratio of the probe score for each EmbeddingGemma task prefix."), cap)


def numbers(R):
    """The handful of numbers the slides quote, so the deck re-reads them
    from whatever run made the figures."""
    import statistics as st
    lad, lp = R["ladder"], R["loop"]
    nb = len(lp["wet_share"])
    late = slice(int(0.7 * nb), nb)

    def lm(k, m):
        v = [x for x in lp[k][m]["mean"][late] if x is not None]
        return st.mean(v) if v else None

    cover = [c for c in R["cover"] if c["d"] == max(c["d"] for c in R["cover"])]
    sep = [c for c in cover if c["separable"] >= 0.5]
    out = dict(
        meta=R["meta"],
        examples=R.get("examples", []),
        ladder={k: {m: v.get(m) for m in ("auc", "brier", "log_loss", "ece10", "reliability", "resolution", "T_fit", "true_ece", "smece")}
                for k, v in lad.items()},
        nb_platt_ece=R["recal"]["tfidf_nb"]["platt"]["ece10"],
        citl_train=R["citl_train"],
        richardson={k: dict(slope=v["slope"], crossover=v["crossover_bins"]) for k, v in R["richardson"].items()},
        cumulative={k: dict(p=v["p_value"], z=v["z"]) for k, v in R["cumulative"].items()},
        cover=dict(d=cover[0]["d"], max_separable_n=max((c["n"] for c in sep), default=None),
                   ece_wall_small=cover[0]["ece_wall"], ece_ridge_small=cover[0]["ece_ridge"]),
        labels_needed=R["labels_needed"],
        labels_curve=R["labels_curve"],
        conformal=R["conformal"],
        drift=dict(dry_ece=R["drift"]["dry"]["ece10"], wet_ece=R["drift"]["wet"]["ece10"],
                   wet_mean_p=R["drift"]["wet"]["mean_p"], wet_rate=R["drift"]["wet"]["base_rate"], psi=R["drift"]["psi_wet"]),
        loop={k: dict(citl=lm(k, "citl"), brier=lm(k, "brier"), true_mse=lm(k, "true_mse"),
                      missed=lm(k, "true_missed") if "true_missed" in lp[k] else None,
                      est_missed=lm(k, "est_missed") if "est_missed" in lp[k] else None,
                      count_err=st.mean(abs(x) for x in lp[k]["count_err"]["mean"][late]))
              for k in lp if isinstance(lp[k], dict) and "brier" in lp[k]},
        aci=dict(aci=st.mean(lp["aci"]["aci"][late]), static=st.mean(lp["aci"]["static"][late])),
        matryoshka=R["matryoshka"],
        prefix=R.get("prefix"),
    )
    return out


def main(argv=None):
    argv = argv if argv is not None else sys.argv[1:]
    if argv:
        d = Path(argv[0]).resolve()
    else:
        d = max((ROOT / "results").iterdir(), key=lambda p: (p / "results.json").stat().st_mtime)
    R = json.loads((d / "results.json").read_text())
    made = [fn(R) for fn in (fig_two_axes, fig_reliability, fig_ruler, fig_walk, fig_cover, fig_labels,
                              fig_drift, fig_loop, fig_forget, fig_matryoshka, fig_prefix)]
    (SITE / "numbers.json").write_text(json.dumps(numbers(R), indent=1))
    meta = R["meta"]
    (SITE / "meta.json").write_text(json.dumps(dict(meta, source=str(d.relative_to(ROOT))), indent=1))
    print(f"wrote {len(made)} figures from {d.name} to {SITE.relative_to(ROOT.parent.parent)}")


if __name__ == "__main__":
    main()
