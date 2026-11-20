"""Build the figure-review artifact, second round.

Rick's critique of round one: too many charts, not enough examples; almost
every chart explained an abstraction nobody had been grounded in yet. So each
beat now opens with real tweets and the numbers models put on them, and gets at
most one chart, built up one layer per click the way it would be on a slide.

Critiques save to the artifact's db, collection `critiques-v2`. Round one's
notes (collection `critiques`) are baked in under the beat that answers them.

    python3 scripts/review_page.py out.html [results/synthetic-lsa]
"""

from __future__ import annotations

import html
import json
import math
import sys
from pathlib import Path

LAB = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(LAB))
from lab.figures import AMBER, BLUE, MUTED, ROSE, Plot, nice, tickfmt  # noqa: E402

E_ = html.escape
INK = "var(--ink)"


def load(results_dir: Path):
    R = json.loads((results_dir / "results.json").read_text())
    X = json.loads((results_dir / "examples.json").read_text())
    return R, X


# ------------------------------------------------------------------ stepping


class Stepped:
    """A Plot whose parts are grouped into layers revealed one per click.
    mode 'add' keeps earlier layers; 'swap' shows only the current one."""

    def __init__(self, plot: Plot, mode="add"):
        self.p, self.mode, self.marks, self.labels = plot, mode, [], []

    def step(self, label):
        self.marks.append(len(self.p.parts))
        self.labels.append(label)

    def svg(self, aria):
        parts, marks = self.p.parts, self.marks + [len(self.p.parts)]
        base = parts[: marks[0]] if marks else parts
        layers = [f'<g class="layer" data-step="{i}">' + "".join(parts[marks[i]: marks[i + 1]]) + "</g>"
                  for i in range(len(self.labels))]
        self.p.parts = base + layers
        return self.p.svg(aria)


def stepper(fig_id, st: Stepped, aria):
    btns = "".join(f'<button type="button" data-go="{i}">{E_(l)}</button>' for i, l in enumerate(st.labels))
    return (f'<div class="stepped" data-mode="{st.mode}" data-at="0" id="fig-{fig_id}">{st.svg(aria)}'
            f'<div class="steps" role="group" aria-label="reveal">{btns}</div></div>')


# ------------------------------------------------------------------ pieces


def pct(x):
    return "—" if x is None else f"{round(100 * x)}%"


def tweet_rows(rows, score_key, show_truth=True, score_label="score"):
    out = []
    for r in rows:
        mark = '<span class="yes">real</span>' if r["y"] else '<span class="no">not</span>'
        truth = (f'<td class="num dim">{r["p_true"]:.2f}</td>' if show_truth and r.get("p_true") is not None else "")
        out.append(f'<tr><td class="num">{r[score_key]:.2f}</td><td class="tw">{E_(r["text"])}</td>{truth}<td>{mark}</td></tr>')
    th_truth = '<th class="num">truth</th>' if show_truth and rows and rows[0].get("p_true") is not None else ""
    return (f'<div class="tablewrap"><table class="tweets"><thead><tr><th class="num">{score_label}</th><th>tweet</th>{th_truth}<th>label</th></tr></thead>'
            f'<tbody>{"".join(out)}</tbody></table></div>')


# ------------------------------------------------------------------ figures


def fig_platt(X):
    rel = X["reliability"]
    p = Plot(0, 1, 0, 1, right=150)
    t = [0, 0.25, 0.5, 0.75, 1]
    p.frame(t, t, "what the model said", "how often it was real")
    st = Stepped(p)
    st.step("honest means on the line")
    p.ref([(0, 0), (1, 1)])
    for key, c, label, sub, step_label in (("nb", ROSE, "naive Bayes", "as it comes", "naive Bayes"),
                                           ("nb_platt", BLUE, "after Platt", "two fitted numbers", "after Platt")):
        st.step(step_label)
        bs = rel[key]
        pts = [(b["claimed"], b["happened"]) for b in bs]
        p.line(pts, c, width=2.5)
        p.errbars([b["claimed"] for b in bs], [b["ci_lo"] for b in bs], [b["ci_hi"] for b in bs], c)
        p.dots(pts, c, r=5, titles=[f"{label}: said {b['claimed']:.2f}, real {b['happened']:.2f} ({int(b['n'])} tweets)" for b in bs])
        p.key(label, c, sub)
        if key == "nb":
            top = bs[-1]
            p.text(top["claimed"], top["happened"], f"said {top['claimed']:.2f}, real {top['happened']:.2f}", anchor="end", dx=-4, dy=34)
    return stepper("platt", st, "Reliability diagram built in steps: the diagonal, naive Bayes, naive Bayes after Platt scaling.")


def fig_plane(X):
    pl = X["plane"]
    pts = pl["points"]
    xs, ys = [q["x"] for q in pts], [q["y"] for q in pts]
    xr = max(abs(min(xs)), abs(max(xs))) * 1.08
    y0, y1 = min(ys) - 0.05 * (max(ys) - min(ys)), max(ys) + 0.05 * (max(ys) - min(ys))
    p = Plot(-xr, xr, y0, y1, h=420, right=150, left=30, bottom=40)
    p.parts.append(f'<line x1="{p.L}" y1="{p.B}" x2="{p.R}" y2="{p.B}" class="axis" />')
    p.text((p.L + p.R) / 2, p.h - 10, "← looks like noise · the head's direction · looks like a report →", cls="label", anchor="middle", px=True)
    real = [(q["x"], q["y"]) for q in pts if q["label"]]
    notr = [(q["x"], q["y"]) for q in pts if not q["label"]]
    p.dots(notr, BLUE, r=3.4, titles=[f"not: {q['text']}" for q in pts if not q["label"]])
    p.dots(real, ROSE, r=3.4, titles=[f"real: {q['text']}" for q in pts if q["label"]])
    p.key("real disaster", ROSE)
    p.key("not", BLUE)
    for k, a in enumerate(pl["annotate"], 1):
        p.parts.append(f'<circle cx="{p.X(a["x"])}" cy="{p.Y(a["y"])}" r="9" fill="none" stroke="var(--ink)" stroke-width="1.5" />')
        p.text(a["x"], a["y"], str(k), cls="key", anchor="middle", dy=-14)
    st = Stepped(p)
    st.step("the line")
    wn = pl["w_norm"]
    for prob, lab in ((0.1, "0.1"), (0.5, "0.5"), (0.9, "0.9")):
        x = math.log(prob / (1 - prob)) / wn
        if prob == 0.5:
            p.line([(x, y0), (x, y1)], INK, width=2)
        else:
            p.line([(x, y0), (x, y1)], MUTED, width=1.5, dash="4 4")
        p.text(x, y1, lab, anchor="middle", dy=-6)
    hw = pl.get("hard_wall")
    if hw:
        st.step("six labels, no penalty")
        (a1, a2), b = hw["hard"]["coef"], hw["hard"]["intercept"]

        def iso(level):
            z = math.log(level / (1 - level))
            out = []
            for i in range(201):
                x = -xr + 2 * xr * i / 200
                yv = (z - b - a1 * x) / a2 if abs(a2) > 1e-9 else None
                if yv is not None and y0 <= yv <= y1:
                    out.append((x, yv))
            return out

        p.parts.append(f'<rect x="{p.L}" y="{p.T}" width="{p.R - p.L}" height="{p.B - p.T}" fill="var(--bg)" opacity="0.72" />')
        p.line(iso(0.5), AMBER, width=2.5)
        p.line(iso(0.99), AMBER, width=1.2, dash="3 3")
        p.line(iso(0.01), AMBER, width=1.2, dash="3 3")
        for q in hw["six"]:
            c = ROSE if q["label"] else BLUE
            p.parts.append(f'<circle cx="{p.X(q["x"])}" cy="{p.Y(q["y"])}" r="7" fill="{c}" stroke="var(--ink)" stroke-width="2"><title>{E_(q["text"])}</title></circle>')
        p.key("6-tweet wall", AMBER, "0.01 to 0.99")
    return stepper("plane", st, "Tweets as points in the embedding, seen along the head's direction; the separating line and its probability contours; then a wall fitted on six tweets.")


def coastline(levels=10, seed=7, rough=0.55):
    import random
    rnd = random.Random(seed)
    pts = [0.5, 0.5]
    amp = 0.22
    for _ in range(levels):
        new = []
        for a, b in zip(pts[:-1], pts[1:]):
            new += [a, (a + b) / 2 + rnd.uniform(-amp, amp)]
        new.append(pts[-1])
        pts = new
        amp *= rough
    n = len(pts) - 1
    return [(i / n, 0.5 + (v - 0.5)) for i, v in enumerate(pts)]


def divider(curve, r, aspect):
    """Walk dividers of opening r along the curve (in a frame where y is
    stretched by `aspect` so distances are true on screen)."""
    def d(a, b):
        return math.hypot(a[0] - b[0], (a[1] - b[1]) * aspect)
    out = [curve[0]]
    cur = curve[0]
    i = 1
    while i < len(curve):
        if d(cur, curve[i]) >= r:
            a, b = curve[i - 1], curve[i]
            lo, hi = 0.0, 1.0
            for _ in range(30):
                m = (lo + hi) / 2
                q = (a[0] + m * (b[0] - a[0]), a[1] + m * (b[1] - a[1]))
                if d(cur, q) < r:
                    lo = m
                else:
                    hi = m
            cur = (a[0] + lo * (b[0] - a[0]), a[1] + lo * (b[1] - a[1]))
            out.append(cur)
        else:
            i += 1
    out.append(curve[-1])
    return out


def fig_coast():
    curve = coastline()
    ys = [q[1] for q in curve]
    pad = 0.05
    p = Plot(0, 1, min(ys) - pad, max(ys) + pad, h=330, left=20, right=170, top=20, bottom=20)
    aspect = (p.B - p.T) / (p.R - p.L) / ((max(ys) + pad - (min(ys) - pad)) / 1.0)
    land = " ".join(f"L{p.X(x)} {p.Y(y)}" for x, y in curve)
    p.parts.append(f'<path d="M{p.X(0)} {p.B} {land} L{p.X(1)} {p.B} Z" fill="var(--line)" opacity="0.7" />')
    p.text(0.5, min(ys) - pad * 0.4, "land", anchor="middle")
    p.text(0.5, max(ys) + pad * 0.2, "sea", anchor="middle", dy=10)
    st = Stepped(p, mode="swap")
    base_len = None
    for r, lab in ((0.2, "long ruler"), (0.07, "shorter"), (0.02, "shorter still")):
        st.step(lab)
        walk = divider(curve, r, aspect)
        length = r * (len(walk) - 2) + math.hypot(walk[-1][0] - walk[-2][0], (walk[-1][1] - walk[-2][1]) * aspect)
        base_len = base_len or length
        p.line(walk, AMBER, width=2.5)
        p.dots(walk, AMBER, r=3.2)
        p.text(p.R + 14, p.T + 30, f"{len(walk) - 1} steps", cls="key", px=True)
        p.text(p.R + 14, p.T + 50, f"length {length / base_len:.1f}×", cls="note", px=True)
    return stepper("coast", st, "A stretch of fractal coastline measured with three ruler lengths; the measured length grows as the ruler shrinks.")


def fig_bins(X):
    p = Plot(0, 1, 0, 1, right=150)
    t = [0, 0.25, 0.5, 0.75, 1]
    p.frame(t, t, "what the model said", "how often it was real")
    p.ref([(0, 0), (1, 1)])
    st = Stepped(p, mode="swap")
    for k in ("5", "20", "100"):
        r = X["ruler"][k]
        st.step(f"{k} bins")
        for b in r["bins"]:
            p.parts.append(f'<line x1="{p.X(b["claimed"])}" y1="{p.Y(b["claimed"])}" x2="{p.X(b["claimed"])}" y2="{p.Y(b["happened"])}" stroke="var(--viz-rose)" stroke-width="2" opacity="0.8" />')
        p.dots([(b["claimed"], b["happened"]) for b in r["bins"]], AMBER, r=5 if int(k) <= 20 else 3.2,
               titles=[f"said {b['claimed']:.2f}, real {b['happened']:.2f} ({int(b['n'])} tweets)" for b in r["bins"]])
        p.text(p.R + 14, p.T + 22, f"{k} bins", cls="key", px=True)
        p.text(p.R + 14, p.T + 40, f"~{r['per_bin']} tweets each", cls="note", px=True)
        p.text(p.R + 14, p.T + 66, f"ECE {r['ece']:.3f}", cls="big", px=True)
        p.text(p.R + 14, p.T + 84, "average red gap", cls="note", px=True)
    return stepper("bins", st, "The same honest model's reliability diagram at 5, 20 and 100 bins; the gaps, and so the ECE, grow as the bins shrink.")


def _roll(v, k=3):
    v = [x if x is not None else float("nan") for x in v]
    return [(lambda w: sum(w) / len(w) if w else None)([x for x in v[max(0, i - k + 1): i + 1] if x == x]) for i in range(len(v))]


def fig_loop(R):
    lp = R["loop"]
    nb = len(lp["wet_share"])
    xs = list(range(1, nb + 1))
    true = _roll(lp["stratified"]["true_missed"]["mean"])
    yt = nice(0, max(v for v in true if v is not None) * 1.25)
    p = Plot(1, nb, 0, yt[-1], right=160)
    p.frame([1] + list(range(5, nb + 1, 5)), yt, "batch of 150 tweets", "real disasters nobody flagged", yfmt=tickfmt(yt))
    on = next((i + 1 for i, w in enumerate(lp["wet_share"]) if w > 0), None)
    if on:
        p.rect(on - 0.5, nb, BLUE, 0.07)
        p.text(on, yt[-1] * 0.95, "the storm arrives", dx=6)
    st = Stepped(p)
    st.step("what's really missed")
    p.line(list(zip(xs, true)), INK, width=3, opacity=0.6)
    p.key("actually missed", INK, "nobody sees this")
    st.step("what the reviewers report")
    p.line(list(zip(xs, [0] * nb)), ROSE, width=3)
    p.key("review the flagged", ROSE, "reports zero")
    st.step("add a random audit")
    p.line(list(zip(xs, _roll(lp["stratified"]["est_missed"]["mean"]))), AMBER, width=2.5)
    p.key("+ 20% random audit", AMBER, "weighted estimate")
    return stepper("loop", st, "Missed disasters per batch: actual, the zero a flagged-only queue reports, and a weighted random audit's estimate.")


def fig_forget(R):
    lp = R["loop"]
    nb = len(lp["wet_share"])
    xs = list(range(1, nb + 1))
    key = "true_mse" if R["meta"]["has_truth"] else "brier"
    series = [("frozen", ROSE, "frozen", "never refit"), ("stratified", MUTED, "refit, keep all", "remembers calm"),
              ("stratified-window6", BLUE, "refit, forget", "last 6 batches"),
              ("stratified-window6-segmented", AMBER, "forget + segment", "map per family")]
    series = [s for s in series if s[0] in lp]
    vals = [_roll(lp[k][key]["mean"]) for k, *_ in series]
    yt = nice(0, max(max(v for v in s if v is not None) for s in vals) * 1.1)
    p = Plot(1, nb, 0, yt[-1], right=160)
    p.frame([1] + list(range(5, nb + 1, 5)), yt, "batch of 150 tweets",
            "how wrong the map is (MSE vs truth)" if key == "true_mse" else "Brier score", yfmt=tickfmt(yt))
    on = next((i + 1 for i, w in enumerate(lp["wet_share"]) if w > 0), None)
    if on:
        p.rect(on - 0.5, nb, BLUE, 0.07)
        p.text(on, yt[-1] * 0.95, "the storm arrives", dx=6)
    st = Stepped(p)
    for (k, c, label, sub), v in zip(series, vals):
        st.step(label)
        dash = "5 4" if c == MUTED else None
        p.line(list(zip(xs, v)), c, width=2.5, dash=dash)
        p.key(label, c, sub, dash=dash)
    return stepper("forget", st, "Calibration error over the stream for four ways of running the loop, added one at a time.")


# ------------------------------------------------------------------ beats


def beats(R, X):
    F, B, Q = X["forecasters"], X["buckets"], X["quad"]
    synth = X["meta"]["has_truth"]
    hw = X["plane"].get("hard_wall") or {}
    lp, st, half = X["loop"], X["storm"], X["storm"]["half"]
    b8, n95 = B["probe_08"], B["nb_095"]

    # 1. what 0.8 promises
    promise = f"""
<p class="lead">The probe gave <b>{b8['n']}</b> test tweets a score between 0.75 and 0.85. <b>{pct(b8['rate'])}</b> of them were real disasters. Ten of them, in the same proportion:</p>
{tweet_rows(b8['sample'], 'probe', synth)}
<p class="lead">Naive Bayes said 0.95 or more about <b>{n95['n']}</b> tweets. Only <b>{pct(n95['rate'])}</b> were real: it says "certain" and delivers about what the probe delivers when it says 0.8. Ten of those, in proportion:</p>
{tweet_rows(n95['sample'], 'nb', synth, 'naive Bayes')}"""

    # 2. four forecasters, same tweets
    cols = [("base", "base rate"), ("keyword", "keyword rates"), ("keyword_loud", "keyword, shouted"), ("nb", "naive Bayes"), ("probe", "probe")]
    head = "".join(f'<th class="num">{E_(n)}</th>' for _, n in cols)
    body = ""
    for r in Q:
        mark = '<span class="yes">real</span>' if r["y"] else '<span class="no">not</span>'
        body += f'<tr><td class="tw">{E_(r["text"])} {mark}</td>' + "".join(f'<td class="num">{r[k]:.2f}</td>' for k, _ in cols) + "</tr>"
    body += ('<tr class="sum"><td>when it says 0.9 or more, how often real</td>' +
             "".join(f'<td class="num">{pct(F[k]["hi_rate"]) if F[k]["hi_n"] else "never says it"}</td>' for k, _ in cols) + "</tr>")
    body += ('<tr class="sum"><td>when it says 0.1 or less, how often real</td>' +
             "".join(f'<td class="num">{pct(F[k]["lo_rate"]) if F[k]["lo_n"] else "never says it"}</td>' for k, _ in cols) + "</tr>")
    grid = f"""
<div class="quad">
  <div class="cell"><p class="q">honest, knows little</p><p><b>base rate</b>, <b>keyword rates</b>. Never claims more than it can back up, so never wrong about its confidence, and says nearly the same thing about a derailment and a mixtape.</p></div>
  <div class="cell"><p class="q">honest, knows a lot</p><p><b>the probe</b>. When it says 0.9 or more it's right {pct(F['probe']['hi_rate'])} of the time; when it says 0.1 or less, {pct(1 - (F['probe']['lo_rate'] or 0))}.</p></div>
  <div class="cell"><p class="q">loud, knows little</p><p><b>keyword rates, shouted</b>: the same rates pushed toward 0 and 1. Its 0.9 is real {pct(F['keyword_loud']['hi_rate'])} of the time, and its 0.1 is real {pct(F['keyword_loud']['lo_rate'])}.</p></div>
  <div class="cell"><p class="q">loud, knows a lot</p><p><b>naive Bayes</b>. It ranks tweets almost as well as the probe, but its 0.9 is real {pct(F['nb']['hi_rate'])} of the time and its 0.1 {pct(F['nb']['lo_rate'])}.</p></div>
</div>"""
    forecasters = f"""
<p class="lead">Five forecasters score the same four tweets. Read across a row to see them disagree; read down the bottom two rows to see what their extremes are worth.</p>
<div class="tablewrap"><table class="wide"><thead><tr><th>tweet</th>{head}</tr></thead><tbody>{body}</tbody></table></div>
{grid}"""

    platt = f"""
<p class="lead">Naive Bayes, raw, then after Platt scaling: a slope and an intercept fitted on its log-odds using about {round(R['meta']['n'] * 0.2, -2):,.0f} held-out labels. Every dot is one tenth of the test tweets, so each dot stands on the same number of tweets.</p>
{fig_platt(X)}
<p class="lead">Its 0.95-and-up tweets were real {pct(n95['rate'])} of the time. After the fix the same tweets, in the same order, get honest numbers. Not one ranking moves.</p>"""

    plane = f"""
<p class="lead">Each dot is a test tweet, placed in the embedding space as the head sees it: left to right is the one direction the head uses, up and down is the biggest remaining spread. Hover a dot for its text. Step 1 draws the line the head fitted on all {R['meta']['n'] // 2:,} training tweets, with the 0.1 and 0.9 contours either side: distance from the line is the logit.</p>
{fig_plane(X)}
<ol class="quotes">{''.join(f'<li>{E_(a_["text"])} <span class="dim">(probe {a_["p"]:.2f}, {"real" if a_["label"] else "not"})</span></li>' for a_ in X["plane"]["annotate"])}</ol>
<p class="lead">Step 2 refits on just six labelled tweets, with no penalty. A line separating six points in a plane exists about half the time even for random labels, so the fit always finds one if it can, then makes the slope as steep as it likes: the 0.01 and 0.99 contours squeeze onto the line. On the test tweets it says 0.99 or 0.01 for <b>{pct(hw.get('share_sure'))}</b> of them, and <b>{pct(hw.get('wrong_when_sure'))}</b> of those near-certain calls are wrong (ECE {hw.get('ece_hard', 0):.2f}, against {hw.get('ece_soft', 0):.2f} for the line fitted on everything).</p>
<p class="lead">The same thing happens in the real space with more labels: in {X['plane']['dim']} dimensions a separating wall exists for any labelling of up to about {2 * X['plane']['dim']:,} tweets.</p>"""

    ruler = f"""
<p class="lead">How long is a coastline? It depends on the ruler. Walk a pair of dividers along it: shorter steps follow more of the wiggles, so the total keeps growing.</p>
{fig_coast()}
<p class="lead">ECE is measured the same way. Sort the tweets by score, cut them into bins, and in each bin compare the average score with how often the tweets were real; ECE is the average of those gaps (the red lines). Here is one honest model, with outcomes drawn from its own probabilities so its true error is zero:</p>
{fig_bins(X)}
<p class="lead">5 bins of about {X['ruler']['5']['per_bin']} tweets: ECE {X['ruler']['5']['ece']:.3f}. 100 bins of about {X['ruler']['100']['per_bin']}: {X['ruler']['100']['ece']:.3f}. The model didn't change; the ruler did. Small bins hold few tweets, a few tweets are a noisy count, and the noise looks like error. On the real labels the probe scores {X['ruler_real']['5']:.3f}, {X['ruler_real']['20']:.3f} and {X['ruler_real']['100']:.3f}: most of what the fine ruler sees is the ruler.</p>"""

    budget = f"""
<div class="tile"><p class="big-num">{X['labels_needed']['0.05']}</p><p>labelled tweets in one bin to see a 5-point gap between what a model says and what happens. {X['labels_needed']['0.02']:,} to see 2 points. Ten bins at 5 points is about {10 * X['labels_needed']['0.05']:,} labels.</p></div>
<p class="lead">The count of a bin's real tweets wobbles by about √(p(1−p)/n), so halving the gap you want to see costs four times the labels. That's the conversation with whoever pays the reviewers.</p>"""

    cov = X["conformal"]
    rows = "".join(
        f'<tr><td class="num">{r["p"]:.2f}</td><td class="tw">{E_(r["text"])}</td><td>{"{" + ", ".join(r["set"]) + "}"}</td><td>{"<span class=yes>real</span>" if r["y"] else "<span class=no>not</span>"}</td></tr>'
        for r in cov["rows"])
    C = R["conformal"]
    coverage = f"""
<p class="lead">Conformal prediction doesn't output a probability; it outputs a set of answers that contains the truth 90% of the time. Confident tweets get one answer; doubtful ones get both.</p>
<div class="tablewrap"><table class="tweets"><thead><tr><th class="num">probe</th><th>tweet</th><th>set</th><th>label</th></tr></thead><tbody>{rows}</tbody></table></div>
<p class="lead">Over the test tweets the probe's sets contain the truth {pct(cov['coverage']['coverage'])} of the time. So do naive Bayes's ({pct(C['tfidf_nb']['split']['coverage'])}), badly calibrated as it is: the guarantee doesn't care. And keyword rates, the most honest model on the page, hit 90% overall by covering the 'not' tweets {pct(C['keyword_eb']['split']['coverage_neg'])} of the time and real disasters only {pct(C['keyword_eb']['split']['coverage_pos'])}. One threshold per class fixes that ({pct(C['keyword_eb']['mondrian']['coverage_pos'])}).</p>"""

    storm = f"""
<p class="lead">Train the probe on tweets with no water keywords, calibrate it, then send it {st['n_wet']:,} tweets about floods, hurricanes and storm surges. Some real ones it scored low:</p>
{tweet_rows([dict(m, p_true=None) for m in st['missed']], 'p', False, 'probe')}
<p class="lead">In the calm, the tweets this map scored about 0.5 were real <b>{pct(half['dry_rate'])}</b> of the time. Once the storm arrives, when more of the water tweets are real reports, the same 0.5 is real <b>{pct(half['wet_rate_storm'])}</b> of the time. The number on the screen didn't change. What it promised did.</p>"""

    loop = f"""
<p class="lead">One batch in the storm: {lp['n']} tweets. The rule sends a truck when the probability clears 0.5, so {lp['flagged']} are flagged. Dispatchers review those and confirm {lp['flagged_real']} were real. Nobody looks at the other {lp['unflagged']}, and {lp['missed']} of them were real disasters, like:</p>
<ul class="quotes">{''.join(f'<li>{E_(m["text"])} <span class="dim">({m["p"]:.2f})</span></li>' for m in lp['missed_examples'])}</ul>
<p class="lead">Now send six random unflagged tweets to the same reviewers. Each one stands for {lp['audit_weight']:.1f} unflagged tweets:</p>
{tweet_rows([dict(a_, p_true=None) for a_ in lp['audit']], 'p', False, 'probe')}
<p class="lead">{sum(a_['y'] for a_ in lp['audit'])} of the six were real, so the audit estimates {sum(a_['y'] for a_ in lp['audit']) * lp['audit_weight']:.0f} misses in this batch. The true count was {lp['missed']}. The flagged-only queue reports zero. Over the whole storm, averaged across runs:</p>
{fig_loop(R)}"""

    forget = f"""
<p class="lead">The calibration map is a memory of what its scores used to mean. Four ways of keeping it, revealed one at a time: never refit; refit on every label ever collected; refit on only the last six batches; and the last six batches with a separate map for water tweets.</p>
{fig_forget(R)}
<p class="lead">Keeping every label means months of calm outvote a week of storm. Forgetting follows the storm but bends one curve to fit two populations. A map per keyword family fixes that.</p>"""

    return [
        dict(id="promise", name="What does 0.8 promise?", body=promise,
             line=f"Of the tweets the probe called about 0.8, {pct(b8['rate'])} were real. Of the ones naive Bayes called 0.95, {pct(n95['rate'])}.",
             note="New opener, no chart. A probability is a promise about a crowd of tweets, never about one, and here's the crowd. The naive Bayes list shows a broken promise before anyone has to read an axis.",
             v1=None),
        dict(id="forecasters", name="Honest is not the same as knowing", body=forecasters,
             line="Five forecasters, the same four tweets: two honest and ignorant, one loud and ignorant, one loud and informed, one honest and informed.",
             note="This answers your note on the two-axes scatter: concrete tweets, and a 2×2 grid in words instead of the scatter. I made the fourth quadrant (loud and ignorant) by shouting the keyword rates, which is honest about being constructed. The bottom two rows of the table might be the whole slide.",
             v1="two-axes"),
        dict(id="platt", name="Two numbers fix naive Bayes", body=platt,
             line="Naive Bayes says 0.98 and is right three times in four. Two fitted numbers fix it without moving a single ranking.",
             note="Rebuilt per your note: equal-count bins (less noise), naive Bayes and its repair in rose and blue instead of two warm colours, the probe dropped, and three clicks: the diagonal, then the broken model, then the fix.",
             v1="reliability"),
        dict(id="plane", name="The line between the kinds", body=plane,
             line="Tweets are points; the head is a line between the kinds; distance from the line is the confidence. Fit the line on six tweets and it's sure about everything.",
             note="Your picture: statements in 2-D with a line between them. The two axes are real directions of the embedding (the head's own direction, and the biggest leftover spread), not a t-SNE squash, so the line really is the model's line. This replaces the Cover chart; Cover becomes one sentence at the end.",
             v1="cover"),
        dict(id="ruler", name="The error depends on the ruler", body=ruler,
             line=f"An honest model's ECE goes from {X['ruler']['5']['ece']:.3f} to {X['ruler']['100']['ece']:.3f} when you shrink the bins. The model didn't change. The ruler did.",
             note="Per your note: the coastline first, then what ECE and bins are, then the same honest model at 5, 20 and 100 bins. The log-log chart and the running-sum walk are both cut; if the room needs the √B law, it's one sentence.",
             v1="ruler"),
        dict(id="budget", name="How many labels", body=budget,
             line=f"{X['labels_needed']['0.05']} labels per bin to see a 5-point gap. Four times that to see half of it.",
             note="The labels chart, replaced by the number, as we both thought.", v1="labels"),
        dict(id="coverage", name="Coverage is not calibration", body=coverage,
             line="Conformal sets promise the answer is in the set 90% of the time, for any model. Even an honest model can keep that promise by failing the class you care about.",
             note="Grounded in four tweets and their sets. This is where 'conformal mapping' becomes the real distinction. It could be cut for time; it's a side road from the main story.",
             v1=None),
        dict(id="storm", name="The storm", body=storm,
             line=f"Before the storm, this map's 0.5 meant {pct(half['dry_rate'])}. During it, {pct(half['wet_rate_storm'])}.",
             note="No chart now; the drift reliability diagram is cut. The before-and-after meaning of the same 0.5 does the work, and the missed flood tweets make it concrete.",
             v1=None),
        dict(id="loop", name="Who you label decides what you can know", body=loop,
             line="Review only what you flagged and you'll report zero misses, forever. Six random tweets found them.",
             note="One batch, worked by hand, before the chart. The chart now reveals in three clicks: the real misses, the flat zero, then the audit catching up. That reveal is the punchline.",
             v1=None),
        dict(id="forget", name="Forget, and segment", body=forget,
             line="A calibration map is a memory of the calm. Forget old labels, and keep one map per population.",
             note="Kept, stepped one line per click. It's the most abstract beat left, and it only works if the storm slide's 59%-versus-86% example has already landed. A candidate to merge into the storm beat.",
             v1=None),
    ]


V1 = {}  # filled from the db read in main()


def card(b, i, v1_notes):
    v1 = v1_notes.get(b["v1"]) if b["v1"] else None
    prev = (f'<blockquote class="prev"><p class="crit">your note on round one</p><p>{E_(v1)}</p></blockquote>' if v1 else "")
    return f"""
<article class="card" data-fig="{b['id']}" id="{b['id']}">
  <header class="card-head">
    <p class="idx">{i:02d}</p>
    <h2>{E_(b['name'])}</h2>
    <div class="verdict" role="group" aria-label="verdict for {E_(b['name'])}">
      <button type="button" data-v="keep" aria-pressed="false">keep</button>
      <button type="button" data-v="maybe" aria-pressed="false">maybe</button>
      <button type="button" data-v="cut" aria-pressed="false">cut</button>
    </div>
  </header>
  <p class="slide-line">{E_(b['line'])}</p>
  <div class="beat">{b['body']}</div>
  <div class="side">
    <p class="crit">what I changed and why</p>
    <p class="mine">{E_(b['note'])}</p>
    {prev}
    <label class="crit" for="c-{b['id']}">your critique</label>
    <textarea id="c-{b['id']}" rows="4" placeholder="Does the example land? Keep, cut, reorder, rewrite the line..."></textarea>
    <p class="status" data-status aria-live="polite"></p>
  </div>
</article>"""


CSS = """
/* layout: one long review sheet; each beat is its examples first, then at most one chart that steps in on click, then my note and the critique box.
   palette: the site's whiteprint by day and blueprint by night, so charts look as they will in the deck. */
:root {
  --bg: #f3f5f7; --card: #e7ecf1; --ink: #12284a; --ink-2: #2f4a72; --ink-3: #4a6186; --line: #c3cfdc; --accent: #b0461a;
  --viz-amber: #8a5a00; --viz-rose: #b0461a; --viz-blue: #1f5cbf; --field: #ffffff;
  --text: var(--ink); --text-dim: var(--ink-2); --text-muted: var(--ink-3); --border: var(--line); --bg-card: var(--card);
  --serif: 'Crimson Pro', Georgia, 'Iowan Old Style', serif; --mono: 'JetBrains Mono', ui-monospace, 'SF Mono', Menlo, monospace;
  --font-jetbrains: var(--mono);
}
@media (prefers-color-scheme: dark) { :root:not([data-theme="light"]) {
  --bg: #0f2238; --card: #15304d; --ink: #eef2f5; --ink-2: #b3c3d3; --ink-3: #8fa4ba; --line: #25476b; --accent: #f08a4b;
  --viz-amber: #f2b84b; --viz-rose: #f07a5a; --viz-blue: #8fc9ff; --field: #0f2238; color-scheme: dark; } }
:root[data-theme="dark"] {
  --bg: #0f2238; --card: #15304d; --ink: #eef2f5; --ink-2: #b3c3d3; --ink-3: #8fa4ba; --line: #25476b; --accent: #f08a4b;
  --viz-amber: #f2b84b; --viz-rose: #f07a5a; --viz-blue: #8fc9ff; --field: #0f2238; color-scheme: dark; }
body { background: var(--bg); color: var(--ink); font-family: var(--serif); font-size: 18px; line-height: 1.5; }
main { max-width: 1000px; margin: 0 auto; padding-block: 40px 80px;
  padding-left: max(16px, env(safe-area-inset-left, 0px)); padding-right: max(16px, env(safe-area-inset-right, 0px));
  display: flex; flex-direction: column; gap: 36px; }
.kicker { font-family: var(--mono); font-size: 13px; letter-spacing: .06em; color: var(--accent); margin: 0; }
h1 { font-size: clamp(34px, 5vw, 50px); font-weight: 500; line-height: 1.05; margin: 6px 0 10px; text-wrap: balance; }
.intro p { margin: 0 0 10px; max-width: 66ch; color: var(--ink-2); }
.card { border-top: 1.5px solid var(--line); padding-top: 20px; display: flex; flex-direction: column; gap: 14px; }
.card-head { display: flex; align-items: baseline; gap: 14px; flex-wrap: wrap; }
.idx { font-family: var(--mono); font-size: 13px; color: var(--ink-3); margin: 0; font-variant-numeric: tabular-nums; }
.card h2 { font-size: 30px; font-weight: 500; margin: 0; flex: 1 1 auto; text-wrap: balance; }
.slide-line { margin: 0; font-size: 22px; font-style: italic; color: var(--ink); max-width: 60ch; }
.verdict { display: flex; gap: 6px; }
.verdict button, .steps button { font-family: var(--mono); font-size: 13px; padding: 4px 12px; border-radius: 999px; border: 1px solid var(--line);
  background: transparent; color: var(--ink-2); cursor: pointer; }
.verdict button:hover, .steps button:hover { border-color: var(--ink-3); }
.verdict button[aria-pressed="true"][data-v="keep"] { background: var(--viz-amber); border-color: var(--viz-amber); color: var(--bg); }
.verdict button[aria-pressed="true"][data-v="maybe"] { background: var(--viz-blue); border-color: var(--viz-blue); color: var(--bg); }
.verdict button[aria-pressed="true"][data-v="cut"] { background: var(--viz-rose); border-color: var(--viz-rose); color: var(--bg); }
.steps button[aria-pressed="true"] { border-color: var(--accent); color: var(--accent); }
button:focus-visible, textarea:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; }
.beat { display: flex; flex-direction: column; gap: 12px; min-width: 0; }
.lead { margin: 0; max-width: 68ch; color: var(--ink-2); }
.lead b { color: var(--ink); font-weight: 600; }
.tablewrap { overflow-x: auto; }
table { border-collapse: collapse; font-size: 16px; width: 100%; }
th { font-family: var(--mono); font-size: 12px; font-weight: 400; color: var(--ink-3); text-align: left; padding: 6px 8px; border-bottom: 1px solid var(--line); white-space: nowrap; }
td { padding: 6px 8px; border-bottom: 1px solid var(--line); vertical-align: top; }
.num { text-align: right; font-variant-numeric: tabular-nums; font-family: var(--mono); font-size: 14px; white-space: nowrap; }
.tw { min-width: 16ch; }
.dim { color: var(--ink-3); }
.yes, .no { font-family: var(--mono); font-size: 12px; padding: 1px 8px; border-radius: 999px; border: 1px solid var(--line); white-space: nowrap; }
.yes { color: var(--ink); border-color: var(--viz-rose); }
.no { color: var(--ink-3); }
tr.sum td { font-family: var(--mono); font-size: 13px; color: var(--ink-2); }
table.wide td.num { width: 1%; }
.quad { display: grid; grid-template-columns: 1fr 1fr; gap: 1px; background: var(--line); border: 1px solid var(--line); }
.quad .cell { background: var(--bg); padding: 12px 14px; }
.quad .cell p { margin: 0 0 4px; font-size: 16px; color: var(--ink-2); }
.quad .q { font-family: var(--mono); font-size: 12px; letter-spacing: .05em; color: var(--accent) !important; }
.quotes { margin: 0; padding-left: 1.2em; color: var(--ink); }
.quotes li { margin-bottom: 4px; }
.tile { display: flex; gap: 20px; align-items: baseline; flex-wrap: wrap; }
.tile p { margin: 0; max-width: 52ch; color: var(--ink-2); }
.big-num { font-size: 72px; line-height: 1; color: var(--ink) !important; font-variant-numeric: tabular-nums; }
.stepped { display: flex; flex-direction: column; gap: 8px; }
.stepped .layer { transition: opacity .25s ease; }
.steps { display: flex; gap: 6px; flex-wrap: wrap; }
.side { display: flex; flex-direction: column; gap: 6px; background: var(--card); padding: 14px 16px; border-radius: 6px; }
.crit { font-family: var(--mono); font-size: 12px; letter-spacing: .05em; color: var(--accent); margin: 4px 0 0; }
.mine { margin: 0; font-size: 17px; color: var(--ink-2); }
.prev { margin: 4px 0; padding: 0 0 0 12px; border-left: 2px solid var(--line); }
.prev p { margin: 0; font-size: 16px; color: var(--ink-2); }
textarea { width: 100%; box-sizing: border-box; font: inherit; font-size: 17px; line-height: 1.45; color: var(--ink);
  background: var(--field); border: 1px solid var(--line); border-radius: 6px; padding: 10px 12px; resize: vertical; }
.status { font-family: var(--mono); font-size: 12px; color: var(--ink-3); margin: 0; min-height: 1.2em; }
@media (max-width: 640px) { .quad { grid-template-columns: 1fr; } .slide-line { font-size: 19px; } .big-num { font-size: 56px; } }
@media (prefers-reduced-motion: reduce) { .stepped .layer { transition: none; } }
.fig { width: 100%; height: auto; display: block; }
.fig text { font-family: var(--mono); fill: var(--ink-2); }
.fig .tick { font-size: 12px; }
.fig .label { font-size: 12.5px; fill: var(--ink-3); }
.fig .mid { text-anchor: middle; }
.fig .end { text-anchor: end; }
.fig .grid { stroke: var(--line); stroke-width: 1; }
.fig .axis { stroke: var(--line); stroke-width: 1.5; }
.fig .ref { stroke: var(--ink-3); stroke-width: 1.5; stroke-dasharray: 4 4; fill: none; }
.fig .series { fill: none; stroke-width: 2; stroke-linecap: round; stroke-linejoin: round; }
.fig .key { font-size: 12.5px; fill: var(--ink); }
.fig .note { font-size: 11.5px; fill: var(--ink-3); }
.fig .big { font-size: 15px; fill: var(--ink); }
"""

JS = """
(() => {
  document.querySelectorAll('.stepped').forEach((s) => {
    const layers = Array.from(s.querySelectorAll('.layer'));
    const btns = Array.from(s.querySelectorAll('[data-go]'));
    const show = (k) => {
      const swap = s.dataset.mode === 'swap';
      layers.forEach((g) => { const i = +g.dataset.step; g.style.opacity = (swap ? i === k : i <= k) ? '1' : '0'; });
      btns.forEach((b) => b.setAttribute('aria-pressed', String(+b.dataset.go === k)));
      s.dataset.at = k;
    };
    btns.forEach((b) => b.addEventListener('click', () => show(+b.dataset.go)));
    s.addEventListener('keydown', (e) => {
      const k = +s.dataset.at;
      if (e.key === 'ArrowRight') { e.preventDefault(); show(Math.min(layers.length - 1, k + 1)); }
      if (e.key === 'ArrowLeft') { e.preventDefault(); show(Math.max(0, k - 1)); }
    });
    show(0);
  });

  const cards = Array.from(document.querySelectorAll('[data-fig]'));
  const state = {}, dirty = new Set(), timers = {}, chains = {};
  let col = null;
  const el = (id) => document.querySelector('[data-fig="' + id + '"]');
  const setStatus = (id, msg) => { const s = el(id)?.querySelector('[data-status]'); if (s) s.textContent = msg; };
  const setAll = (msg) => cards.forEach((c) => setStatus(c.dataset.fig, msg));
  const paint = (id) => el(id)?.querySelectorAll('.verdict button').forEach((b) => b.setAttribute('aria-pressed', String(state[id]?.verdict === b.dataset.v)));
  function save(id) {
    if (!col) { setStatus(id, "Can't save in this view."); return; }
    const body = { text: state[id]?.text || '', verdict: state[id]?.verdict || '', updated: new Date().toISOString() };
    setStatus(id, 'Saving…');
    chains[id] = (chains[id] || Promise.resolve()).then(() => col.doc(id).set(body)).then(
      () => { dirty.delete(id); setStatus(id, 'Saved ' + new Date().toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })); },
      (e) => setStatus(id, e && e.code === 'invalid_argument' ? 'Only the owner can save notes here.' : 'Not saved. Check your connection and type again.'));
  }
  cards.forEach((c) => {
    const id = c.dataset.fig;
    state[id] = { text: '', verdict: '' };
    const ta = c.querySelector('textarea');
    ta.addEventListener('input', () => { state[id].text = ta.value; dirty.add(id); setStatus(id, 'Typing…'); clearTimeout(timers[id]); timers[id] = setTimeout(() => save(id), 900); });
    c.querySelectorAll('.verdict button').forEach((b) => b.addEventListener('click', () => {
      state[id].verdict = state[id].verdict === b.dataset.v ? '' : b.dataset.v; paint(id); clearTimeout(timers[id]); save(id); }));
  });
  const use = window.claude && window.claude.use;
  if (!use) { setAll('Notes save only when this page is opened on claude.ai.'); return; }
  setAll('Loading saved notes…');
  use('db').then((db) => {
    if (!db) { setAll("Notes can't be saved in this view."); return; }
    col = db.collection('critiques-v2');
    const slow = setTimeout(() => setAll("Saved notes can't be reached yet. You can still type; it will save when the connection returns."), 10000);
    col.onSnapshot((snap) => {
      if (!snap.metadata.fromCache) clearTimeout(slow);
      const seen = new Set();
      snap.docs.forEach((d) => {
        const id = d.id; seen.add(id);
        if (!state[id] || dirty.has(id)) return;
        const v = d.data() || {};
        state[id] = { text: v.text || '', verdict: v.verdict || '' };
        const ta = el(id)?.querySelector('textarea');
        if (ta && document.activeElement !== ta) ta.value = state[id].text;
        paint(id);
        if (v.updated) setStatus(id, 'Saved ' + new Date(v.updated).toLocaleString([], { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }));
      });
      cards.forEach((c) => { if (!seen.has(c.dataset.fig) && !dirty.has(c.dataset.fig)) setStatus(c.dataset.fig, ''); });
    }, () => { clearTimeout(slow); setAll("Saved notes couldn't load. Reload the page to try again."); });
  }, () => setAll("Notes can't be saved in this view."));
})();
"""


def page(R, X, v1_notes) -> str:
    bs = beats(R, X)
    data_note = ("the synthetic stand-in for Disaster Tweets (every row has a known true probability, shown as 'truth')"
                 if X["meta"]["has_truth"] else "Kaggle's Disaster Tweets")
    cards = "\n".join(card(b, i + 1, v1_notes) for i, b in enumerate(bs))
    return f"""<title>Haze talk figures</title>
<meta name="claude:viewport-fit-sides" content="cover">
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Crimson+Pro:ital,wght@0,400..700;1,400..600&family=JetBrains+Mono:wght@400;500&display=swap">
<style>{CSS}</style>
<main>
  <section class="intro">
    <p class="kicker">enjoy your logits! · the haze · round two</p>
    <h1>Examples first, then one chart</h1>
    <p>Your round-one notes said the charts explained abstractions nobody had been grounded in. So every beat now opens with actual tweets and the numbers models put on them, and gets at most one chart. Charts build up one layer per click, the way they would on a slide: use the buttons under each one, or click it and use the arrow keys.</p>
    <p>Cut since round one: the temperature curve, the scatter of models, the Cover chart, the log-log ruler, the running-sum walk, the labels curve, the drift diagram and the Matryoshka chart. Data: {data_note}. The real-data run will swap in real tweets.</p>
  </section>
  <section class="card" data-fig="overall" id="overall">
    <label class="crit" for="c-overall">the story overall: arc, order, what's still missing</label>
    <textarea id="c-overall" rows="4" placeholder="Opening image, the turn, the close..."></textarea>
    <p class="status" data-status aria-live="polite"></p>
  </section>
  {cards}
</main>
<script>{JS}</script>
"""


if __name__ == "__main__":
    out = Path(sys.argv[1])
    rd = Path(sys.argv[2]) if len(sys.argv) > 2 else LAB / "results" / "synthetic-lsa"
    v1 = json.loads(Path(sys.argv[3]).read_text()) if len(sys.argv) > 3 else {}
    R, X = load(rd)
    s = page(R, X, v1)
    out.write_text(s)
    print(f"wrote {out} ({len(s) / 1e3:.0f} KB)")
