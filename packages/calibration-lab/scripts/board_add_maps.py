"""Add two sections under the honesty layer: which map (worked example +
decision tree) and micro-judgments fanned out. New ids start at e83."""
import json, math, os
OUT = os.path.dirname(os.path.abspath(__file__))
els = {}
n = [82]
def nid():
    n[0] += 1
    return f"e{n[0]}"
def lines_for(text, w, size=16):
    cpl = max(8, int((w - 30) / (0.52 * size)))
    return sum(max(1, math.ceil(len(p.replace("**", "").replace("`", "")) / cpl)) for p in text.split("\n"))
def block(x, y, w, text, color="white", size="small", kind="rounded", align="left", h=None, stroke=None):
    px = {"small": 14, "body": 16, "large": 28}[size]
    if h is None:
        h = int(lines_for(text, w, px) * px * 1.5 * 1.12 + 30)
    i = nid()
    e = {"type": "shape", "kind": kind, "x": x, "y": y, "w": w, "h": h, "color": color, "size": size, "text": text, "textAlign": align}
    if stroke: e["stroke"] = stroke
    els[i] = e
    return i, h
def text(x, y, s, size="body", wrap=None):
    i = nid(); e = {"type": "text", "x": x, "y": y, "text": s, "size": size}
    if wrap: e["wrap"] = wrap
    els[i] = e; return i
def section(x, y, w, h, title):
    i = nid(); els[i] = {"type": "container", "x": x, "y": y, "w": w, "h": h, "text": title}; return i
def arrow(a, b, fs, ts, label=None, dash=False, bends=None):
    i = nid(); e = {"type": "arrow", "from": a, "to": b, "fromSide": fs, "toSide": ts}
    if label: e["label"] = label
    if dash: e["dash"] = True
    if bends: e["bends"] = bends; e.pop("fromSide"); e.pop("toSide")
    els[i] = e; return i
def table(x, y, cols, rows):
    i = nid()
    c = {f"c{k+1}": {"at": k + 1, "w": w} for k, (_, w) in enumerate(cols)}
    r = {"r1": {"at": 1, **{f"c{k+1}": nm for k, (nm, _) in enumerate(cols)}}}
    for j, row in enumerate(rows):
        r[f"r{j+2}"] = {"at": j + 2, **{f"c{k+1}": v for k, v in enumerate(row)}}
    els[i] = {"type": "table", "x": x, "y": y, "cols": c, "rows": r, "size": "small"}; return i

sections = []
PAD = 24

# ======================================================= H: which map
HX, HY, HW = 0, 2775, 1508
ix = HX + PAD
y = HY + PAD
text(ix, y, "**The honesty layer, worked on one Jev answer.** Example numbers: this question's map has a = 0.6 (Jev runs loud here) and b = −0.4.", size="body", wrap=HW - 2 * PAD)
y += 48
steps = [
    "**Jev says**\nnoul = 0.997",
    "**clip**\nkeep it in 0.0001 to 0.9999, so the next step stays finite",
    "**logit**\nz = log(p / (1 − p)) = 5.81",
    "**a·z + b**\n0.6 × 5.81 − 0.4 = 3.08\n(temperature and chemical potential)",
    "**σ**\np = 1 / (1 + e^−3.08) = 0.956",
    "**act**\nif p ≥ c_FP / (c_FP + c_FN): with a miss costing 4× a false alarm, 0.2",
]
ids = []
x = ix
for s in steps:
    i, _ = block(x, y, 190, s, align="center", h=150, color="blue" if s.startswith("**a·z") else "white")
    ids.append(i); x += 190 + 64
for a_, b_ in zip(ids[:-1], ids[1:]):
    arrow(a_, b_, "right", "left")
y += 150 + 56

text(ix, y, "**Which map? Answer two questions about this question's labels.**", size="body", wrap=HW - 2 * PAD)
y += 48
cL, cM, cR, cR2 = ix, ix + 456, ix + 932, ix + 1260
wL, wM, wR = 300, 330, 300
DH, LH = 150, 120
d0, _ = block(cM, y, wM, "Does the audit already look honest?\n(the running sum stays in its band)", kind="diamond", align="center", h=DH, size="small")
idn, _ = block(cR, y + (DH - LH) // 2, wR, "**identity**\nchange nothing; keep auditing", color="blue", align="center", h=LH)
arrow(d0, idn, "right", "left", label="yes")
y1 = y + DH + 110
d1, _ = block(cM, y1, wM, "How many labels does this question have?", kind="diamond", align="center", h=DH, size="small")
few, _ = block(cL, y1 + (DH - LH) // 2, wL, "**intercept only**\nσ(z + b): 1 number\nfixes a base-rate shift", color="blue", align="center", h=LH)
iso, _ = block(cR, y1 + (DH - LH) // 2, wR, "**isotonic**\na step function: many numbers\nany monotone shape", color="blue", align="center", h=LH)
arrow(d0, d1, "bottom", "top", label="no")
arrow(d1, few, "left", "right", label="a few dozen")
arrow(d1, iso, "right", "left", label="thousands")
y2 = y1 + DH + 110
d2, _ = block(cM, y2, wM, "What shape is the miss on the audit?", kind="diamond", align="center", h=DH, size="small")
platt, _ = block(cL, y2 + (DH - LH) // 2, wL, "**Platt**\nσ(a·z + b): 2 numbers\nloud or quiet, and shifted", color="blue", align="center", h=LH)
beta, _ = block(cR, y2 + (DH - LH) // 2, wR, "**beta**\nlogistic on ln p and −ln(1−p): 3 numbers\nthe two ends bend differently", color="blue", align="center", h=LH)
arrow(d1, d2, "bottom", "top", label="a few hundred")
arrow(d2, platt, "left", "right", label="one bend or tilt")
arrow(d2, beta, "right", "left", label="good ends, mushy middle")
# right-hand column: the two refinements that apply to every branch
seg, hs = block(cR2, y1 - 10, 200, "**Segments disagree?** (water vs dry, small vs large refunds)\nAdd segment indicators beside z: one slope, an intercept per segment. Still a logistic regression.", size="small")
typ, ht = block(cR2, y1 - 10 + hs + 24, 200, "**Not a noul?**\nchoice: one temperature on the log-probabilities, or a slope and offset per option\nscore: a Platt map per level, on P(level ≥ k)", size="small")
y = y2 + DH + 40
H_h = y - HY
sections.append(section(HX, HY, HW, H_h, "Which map? The honesty layer as a diagram"))

# ======================================================= I: micro-judgments fanned out
IX, IY, IW = 0, HY + H_h + 110, 1508
ix = IX + PAD
y = IY + PAD
text(ix, y, "**Ask small questions, combine in code.** One tweet, five micro-judgments in one Jev call. Answers here are illustrative, not real Jev output.", size="body", wrap=IW - 2 * PAD)
y += 48
c1, c2, c3, c4 = ix, ix + 300, ix + 300 + 380 + 144, ix + 300 + 380 + 144 + 300 + 64
tw_, th_ = block(c1, y + 230, 236, "**the tweet**\n\"Just drove past the windstorm. Praying for everyone there\"", color="white", align="center", h=130, size="body")
J = [
    ("**literal** · noul\nIs something physically happening, not a metaphor, joke or title?\n→ 0.91"),
    ("**current** · noul\nNow or in the last day, not history, a drill or a forecast?\n→ 0.88"),
    ("**hazard** · choice\nfire · water and storm · quake · transport · violence · health · none\n→ water and storm, 0.74"),
    ("**speaker** · choice\nwitness · news · secondhand · unclear\n→ witness, 0.66"),
    ("**severity** · score\nnone · damage · injuries · deaths\n→ 1.3 (between damage and injuries)"),
]
jids = []
jy = y
for s in J:
    i, h = block(c2, jy, 380, s, color="yellow", size="small", h=104)
    jids.append(i); jy += 104 + 18
for k, j in enumerate(jids):
    arrow(tw_, j, "right", "left")
mid = y + (jy - y) // 2
rules, hr = block(c3, y + 40, 300, "**rules in code** (readable)\nsend if literal and current and hazard ≠ none\nroute by hazard; priority by severity\n0.91 × 0.88 × 0.95 = 0.76", size="small", h=170)
lr_, hl = block(c3, y + 40 + 170 + 120, 300, "**learned combiner** (honest)\na logistic regression on the five judgments' logits, fitted on 'was it real?' labels\np(real) = 0.83", size="small", color="blue", h=170)
for j in jids[:2]:
    arrow(j, rules, "right", "left")
arrow(jids[2], rules, "right", "left")
for j in jids:
    arrow(j, lr_, "right", "left", dash=True)
out1, _ = block(c4, y + 40, 260, "**decision + trace**\nsend a truck to the storm team; if it's wrong, the trace says which judgment was", align="center", h=170)
out2, _ = block(c4, y + 40 + 170 + 120, 260, "**a probability you can threshold**\nact if p ≥ c_FP / (c_FP + c_FN)", align="center", color="white", h=170)
arrow(rules, out1, "right", "left")
arrow(lr_, out2, "right", "left")
y = max(jy, y + 40 + 170 + 120 + 170) + 30
w1, h1 = block(ix, y, (IW - 3 * PAD) // 2, "**Why the product isn't honest:** each judgment can be calibrated and their product still won't be, because the judgments are about the same tweet and move together. A metaphor fails 'literal' and 'current' at once. Multiplying counts that evidence twice: naive Bayes again.", size="small", color="peach")
w2, h2 = block(ix + (IW - 3 * PAD) // 2 + PAD, y, (IW - 3 * PAD) // 2, "**So the honesty layer grows inputs:** one Platt map per judgment becomes one logistic regression over all of them, trained on the final outcome. That's stacking (Wolpert, 1992). Final-outcome labels train it; audit a single judgment only where the combiner leans on it hardest.", size="small", color="peach")
y += max(h1, h2) + 24
I_h = y - IY
sections.append(section(IX, IY, IW, I_h, "Micro-judgments: one tweet, fanned out"))

order = sections + [k for k in els if k not in sections]
os.makedirs(os.path.join(OUT, "el2"), exist_ok=True)
for k, v in els.items():
    json.dump(v, open(os.path.join(OUT, "el2", f"{k}.json"), "w"))
writes = [{"op": "set", "collection": "elements", "doc_id": k, "file_path": os.path.join(OUT, "el2", f"{k}.json")} for k in order]
json.dump(writes, open(os.path.join(OUT, "batch3.json"), "w"))
print(len(els), "new elements;", "H", HY, H_h, "I", IY, I_h, "bottom", IY + I_h)
print(" ".join(order))
