"""Which tool, when (decision tree) and the 75-year timeline. New ids from e161."""
import json, math, os
OUT = os.path.dirname(os.path.abspath(__file__))
els = {}
n = [160]
def nid():
    n[0] += 1; return f"e{n[0]}"
def lines_for(text, w, size=16):
    cpl = max(8, int((w - 30) / (0.52 * size)))
    return sum(max(1, math.ceil(len(p.replace("**", "")) / cpl)) for p in text.split("\n"))
def hfor(text, w, px):
    return int(lines_for(text, w, px) * px * 1.5 * 1.12 + 30)
def block(x, y, w, text, color="white", size="small", align="left", h=None, kind="rounded", stroke=None):
    px = {"small": 14, "body": 16}[size]
    if h is None: h = hfor(text, w, px)
    i = nid(); e = {"type": "shape", "kind": kind, "x": x, "y": y, "w": w, "h": h, "color": color, "size": size, "text": text, "textAlign": align}
    if stroke: e["stroke"] = stroke
    els[i] = e; return i, h
def text(x, y, s, size="body", wrap=None):
    i = nid(); e = {"type": "text", "x": x, "y": y, "text": s, "size": size}
    if wrap: e["wrap"] = wrap
    els[i] = e; return i
def arrow(a, b, fs, ts, label=None):
    i = nid(); e = {"type": "arrow", "from": a, "to": b, "fromSide": fs, "toSide": ts}
    if label: e["label"] = label
    els[i] = e; return i
sections = []

# ===================================================== which tool, when
KX, KY, KW = 1548, 3521, 1146
dx, lx = KX + 24, KX + 24 + 300 + 156
lw = KX + KW - 24 - lx
y = KY + 24
text(dx, y, "**Which tool, when.** Ask in order; stop at the first yes.", wrap=KW - 48)
y += 46
DH, GAP = 140, 110
qs = [
    ("Will you ever learn the truth?", "no", "**Rank, don't calibrate.** Without outcomes nothing can be checked. Use the score as an ordering only, and say so."),
    ("Is the rule known and stable?", "yes", "**Code.** An if / else is a hard wall: deterministic, testable, free. Don't infer what you can write down."),
    ("Is the input a table of numbers and categories?", "yes", "**Gradient boosting or logistic regression**, then Platt on held-out labels. Still the best tool for tables."),
    ("Text, thousands of labels, and a question that will stay put?", "yes", "**Embedding + head.** A frozen encoder, a logistic head, Platt. Cheap per call, yours to retrain, easy to calibrate."),
    ("Is the answer a judgment: yes / no, one of k, a score?", "yes", "**System One** (Jev). Zero-shot on a question you wrote today; fan out small questions; calibrate on your own labels."),
]
prev = None
for k, (q, branch, leaf) in enumerate(qs):
    d, _ = block(dx, y, 300, q, kind="diamond", align="center", h=DH)
    lh = max(hfor(leaf, lw, 14), 96)
    l, _ = block(lx, y + (DH - lh) // 2, lw, leaf, align="left", h=lh)
    arrow(d, l, "right", "left", label=branch)
    if prev:
        arrow(prev, d, "bottom", "top", label="no" if qs[k - 1][1] == "yes" else "yes")
    prev = d
    y += DH + GAP
llm_text = "**LLM.** Prose, multi-step reasoning, tools, open-ended answers. If a number has to come out, read the log-probabilities, never a stated confidence, and calibrate those."
lh = hfor(llm_text, 300 + 156 + lw, 14)
llm, _ = block(dx, y - GAP + 64, 300 + 156 + lw, llm_text, h=lh)
arrow(prev, llm, "bottom", "top", label="no")
y = y - GAP + 64 + lh + 24
foot, fh = block(dx, y, KW - 48, "Every leaf that hands code a probability gets the honesty layer: log, audit, fit per question, refit.", color="peach")
y += fh + 24
sec = nid(); els[sec] = {"type": "container", "x": KX, "y": KY, "w": KW, "h": y - KY, "text": "Which tool, when"}
sections.append(sec)
K_bottom = y

# ===================================================== timeline
LX, LY, LW = 0, max(4757, K_bottom) + 110, 2694
y = LY + 24
text(LX + 24, y, "**System One is the newest step on a 75-year line, not a break from it.**", wrap=LW - 48)
y += 52
events = [
    ("1950", "**Brier**: a score that rewards honest weather forecasts"),
    ("1958", "**the perceptron** (Rosenblatt): a hyperplane learned from examples"),
    ("1972", "**GLMs** (Nelder & Wedderburn): one family for yes/no, counts and numbers"),
    ("1995", "**SVMs** (Cortes & Vapnik): the widest wall, but no probabilities"),
    ("1999", "**Platt scaling**: a sigmoid that turns SVM scores into probabilities"),
    ("2001", "**random forests** (Breiman): a vote of many trees"),
    ("2005", "**who's honest out of the box?** (Niculescu-Mizil & Caruana)"),
    ("2012", "**deep learning** (AlexNet): the box learns its own features"),
    ("2017", "**transformers**; Guo et al.: bigger nets, less honest; one temperature fixes it"),
    ("2018", "**BERT + a head**: borrowed features, your own small classifier"),
    ("2019", "**zero-shot by entailment** (Yin et al.): the label's description becomes the question"),
    ("2022", "**RLHF chat models**: trained on preference; confidence runs hot"),
    ("2026", "**System One** (Jev): a classifier with an instruction front end, trained toward honest probabilities (claimed)"),
]
bw, gap = 180, 22
H = max(hfor(f"{yr}\n{t}", bw, 14) for yr, t in events)
x = LX + 24
mid = y + H // 2
line = nid()
els[line] = {"type": "stroke", "x": LX + 24, "y": mid, "points": [0, 0, len(events) * bw + (len(events) - 1) * gap, 0], "color": "ink", "width": 3}
for yr, t in events:
    block(x, y, bw, f"**{yr}**\n{t}", color="peach" if yr == "2026" else "white", h=H)
    x += bw + gap
y += H + 24
eras = [("statistics", 0, 3), ("machine learning", 3, 7), ("deep learning and transformers", 7, 13)]
for name, a, b in eras:
    text(LX + 24 + a * (bw + gap), y, f"*{name}*", size="small")
y += 40
sec2 = nid(); els[sec2] = {"type": "container", "x": LX, "y": LY, "w": LW, "h": y - LY, "text": "The line System One sits on"}
sections.append(sec2)

order = sections + [k for k in els if k not in sections]
os.makedirs(os.path.join(OUT, "el4"), exist_ok=True)
for k, v in els.items():
    json.dump(v, open(os.path.join(OUT, "el4", f"{k}.json"), "w"))
print(len(els), "elements; K bottom", K_bottom, "timeline", LY, y)
print(" ".join(order))
