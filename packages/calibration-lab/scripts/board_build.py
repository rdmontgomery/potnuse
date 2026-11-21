"""Lay out the idea-grammar whiteboard: writes one JSON file per element plus
board/meta, and a manifest of writes in back-to-front order."""
import json, math, os
OUT = os.path.dirname(os.path.abspath(__file__))
els, order = {}, []
n = [0]

def nid():
    n[0] += 1
    return f"e{n[0]}"

def lines_for(text, w, size=16):
    cpl = max(8, int((w - 30) / (0.52 * size)))
    total = 0
    for para in text.split("\n"):
        plain = para.replace("**", "").replace("*", "").replace("`", "")
        total += max(1, math.ceil(len(plain) / cpl))
    return total

def block(x, y, w, text, color="white", size="body", kind="rounded", align="left", h=None, stroke=None):
    px = {"small": 14, "body": 16, "large": 28}[size]
    if h is None:
        h = int(lines_for(text, w, px) * px * 1.5 * 1.12 + 30)
    i = nid()
    e = {"type": "shape", "kind": kind, "x": x, "y": y, "w": w, "h": h, "color": color, "size": size, "text": text, "textAlign": align}
    if stroke:
        e["stroke"] = stroke
    els[i] = e
    return i, h

def text(x, y, s, size="body", wrap=None, color=None):
    i = nid()
    e = {"type": "text", "x": x, "y": y, "text": s, "size": size}
    if wrap:
        e["wrap"] = wrap
    if color:
        e["color"] = color
    els[i] = e
    return i

def section(x, y, w, h, title):
    i = nid()
    els[i] = {"type": "container", "x": x, "y": y, "w": w, "h": h, "text": title}
    return i

def arrow(a, b, fs, ts, label=None, dash=False):
    i = nid()
    e = {"type": "arrow", "from": a, "to": b, "fromSide": fs, "toSide": ts}
    if label:
        e["label"] = label
    if dash:
        e["dash"] = True
    els[i] = e
    return i

def image(x, y, w, h, svg):
    i = nid()
    src = "data:image/svg+xml," + svg.replace("#", "%23")
    els[i] = {"type": "image", "x": x, "y": y, "w": w, "h": h, "by": "claude", "style": "plain", "src": src}
    return i

def table(x, y, cols, rows, fills=None, size="small"):
    i = nid()
    c = {f"c{k+1}": {"at": k + 1, "w": w} for k, (_, w) in enumerate(cols)}
    r = {"r1": {"at": 1, **{f"c{k+1}": name for k, (name, _) in enumerate(cols)}}}
    for j, row in enumerate(rows):
        r[f"r{j+2}"] = {"at": j + 2, **{f"c{k+1}": v for k, v in enumerate(row)}}
    e = {"type": "table", "x": x, "y": y, "cols": c, "rows": r, "size": size}
    if fills:
        e["fills"] = fills
    els[i] = e
    return i

sections = []
PAD = 24

# ---------------------------------------------------------------- title
text(0, -230, "enjoy your logits!", size="title")
text(0, -160, "The box always outputs a belief. Check it.", size="large")
text(0, -110, "Seven modules to stack and reorder. Each block is one idea; drag what you need into talk order.", size="body", color="ink")

# ---------------------------------------------------------------- A pipeline
AX, AY, AW = 0, 0, 800
inner = AX + PAD
bw, gap = 136, 64
rows = [
    ("1. classic ML: a person chooses the features", [
        ("**raw facts**\ntweet text, keyword, location", 1),
        ("**M features**\nhas a link? keyword rate, word counts", 1),
        ("**box**\nlogistic regression, forest, boosting", 1),
        ("**Y**\nP(real) = 0.82", 1)]),
    ("2. deep learning: the box learns its own features", [
        ("**raw facts**\ntweet text, keyword, location", 1),
        ("**one network**\nfeatures are learned inside the box", 2),
        ("**Y**\nP(real) = 0.82", 1)]),
    ("3. transfer: the features are borrowed", [
        ("**raw facts**\ntweet text", 1),
        ("**pretrained encoder, frozen**\n768 numbers out", 1),
        ("**head**\na hyperplane: w·x + b", 1),
        ("**Y**\nP(real) = 0.82", 1)]),
]
y = AY + PAD
A_ids = []
for label, blocks in rows:
    text(inner, y, label, size="body")
    y += 34
    x = inner
    ids, hs = [], []
    for t, span in blocks:
        w = bw * span + gap * (span - 1)
        i, h = block(x, y, w, t, color="white", align="center", h=118)
        ids.append(i); hs.append(h)
        x += w + gap
    for a_, b_ in zip(ids[:-1], ids[1:]):
        arrow(a_, b_, "right", "left")
    A_ids += ids
    y += 118 + 30
fn = text(inner, y, "The border between features and box gets drawn, erased, and redrawn somewhere new. Row 3 is the 'not an LLM' paradigm: someone else's learned features, your own small head.", size="small", wrap=AW - 2 * PAD)
y += 70
A_h = y - AY
sections.append(section(AX, AY, AW, A_h, "The pipeline, three times"))

# ---------------------------------------------------------------- B Y is a belief
BX, BY, BW = 840, 0, 800
inner = BX + PAD
svg_cls = ("<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 352 270' fill='none' stroke='currentColor' stroke-width='2.5' stroke-linecap='round' stroke-linejoin='round'>"
           "<desc>Square-on diagram of a classifier's belief and its loss. Parts: baseline, bar for the outcome that happened (tall, accent), bar for the other outcome (short, pale), "
           "divider, loss axis, probability axis, loss curve minus log p falling from left to right, marker where the bar height is 0.8 with a short drop line, marker where the height is 0.2 with a tall drop line, tick marks at 0, 0.5 and 1.</desc>"
           "<line x1='40' y1='112' x2='170' y2='112'/>"
           "<rect x='62' y='24' width='38' height='88' fill='#c0582f' stroke='#c0582f'/>"
           "<rect x='112' y='90' width='38' height='22' fill='#9fb3c8' stroke='#9fb3c8'/>"
           "<line x1='190' y1='20' x2='190' y2='118' stroke-width='1.2' stroke-dasharray='4 4'/>"
           "<line x1='212' y1='112' x2='336' y2='112'/>"
           "<rect x='236' y='24' width='38' height='88' fill='#c0582f' stroke='#c0582f' fill-opacity='.25'/>"
           "<rect x='286' y='90' width='38' height='22' fill='#9fb3c8' stroke='#9fb3c8' fill-opacity='.25'/>"
           "<line x1='40' y1='250' x2='330' y2='250'/><line x1='40' y1='150' x2='40' y2='250'/>"
           "<line x1='40' y1='250' x2='40' y2='256' stroke-width='1.2'/><line x1='185' y1='250' x2='185' y2='256' stroke-width='1.2'/><line x1='330' y1='250' x2='330' y2='256' stroke-width='1.2'/>"
           "<path d='M46 152 C60 190 80 214 110 228 C150 240 220 246 330 250' stroke='#c0582f' stroke-width='3'/>"
           "<line x1='272' y1='248' x2='272' y2='242' stroke-width='1.6'/><circle cx='272' cy='242' r='6' fill='#c0582f' stroke='#c0582f'/>"
           "<line x1='98' y1='250' x2='98' y2='222' stroke-width='1.6' stroke-dasharray='3 3'/><circle cx='98' cy='222' r='6' fill='#9fb3c8' stroke='currentColor'/>"
           "</svg>")
svg_reg = ("<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 352 270' fill='none' stroke='currentColor' stroke-width='2.5' stroke-linecap='round' stroke-linejoin='round'>"
           "<desc>Square-on diagram of a regression's belief and its loss. Parts: baseline, bell-shaped belief centred on the prediction, shaded bell body, centre line at the prediction, "
           "marker where the true answer landed to the right, drop line from bell to the answer, loss axis, answer axis, parabola of squared error centred on the prediction, marker on the parabola at the answer, tick marks.</desc>"
           "<line x1='24' y1='112' x2='330' y2='112'/>"
           "<path d='M24 111 C90 110 110 100 135 70 C155 40 165 26 177 26 C189 26 199 40 219 70 C244 100 264 110 330 111 Z' fill='#9fb3c8' fill-opacity='.35' stroke='#3b6fd1'/>"
           "<line x1='177' y1='26' x2='177' y2='118' stroke-width='1.2' stroke-dasharray='4 4'/>"
           "<line x1='250' y1='97' x2='250' y2='118' stroke='#c0582f' stroke-width='2'/><circle cx='250' cy='97' r='6' fill='#c0582f' stroke='#c0582f'/>"
           "<line x1='24' y1='250' x2='330' y2='250'/><line x1='24' y1='150' x2='24' y2='250'/>"
           "<line x1='177' y1='250' x2='177' y2='256' stroke-width='1.2'/>"
           "<path d='M64 152 C100 205 140 246 177 248 C214 246 254 205 290 152' stroke='#c0582f' stroke-width='3'/>"
           "<line x1='250' y1='250' x2='250' y2='204' stroke-width='1.6' stroke-dasharray='3 3'/><circle cx='250' cy='204' r='6' fill='#c0582f' stroke='#c0582f'/>"
           "</svg>")
y = BY + PAD
text(inner, y, "**classification**: a belief over a finite set", size="body")
text(inner + 376, y, "**regression**: a belief over the real line", size="body")
y += 34
image(inner, y, 352, 270, svg_cls)
image(inner + 376, y, 352, 270, svg_reg)
y += 270 + 12
cl, h1 = block(inner, y, 352, "Top: the belief is two bars. Bottom: the loss is −log of the bar that happened. Said 0.8 and it happened: small loss. Said 0.2: big loss. That's **cross-entropy** (log loss).", size="small")
rg, h2 = block(inner + 376, y, 352, "Top: the belief is a bell around the prediction μ. Bottom: −log of the bell's height where the answer landed is (y − μ)²/2σ² + a constant. Fix σ and that's **squared error**.", size="small")
y += max(h1, h2) + 20
one, h3 = block(inner, y, 728, "**One rule for both:** loss = −log(the probability you gave to what happened). Both losses are *proper*: the only way to minimise them is to report your honest belief.", color="peach")
y += h3 + 24
table(inner, y, [("answer space", 150), ("the belief", 180), ("loss", 190), ("link", 120)], [
    ("yes / no", "Bernoulli", "log loss", "logit"),
    ("one of k", "categorical", "cross-entropy", "softmax"),
    ("a number", "Gaussian, width fixed", "squared error", "identity"),
    ("a count", "Poisson", "Poisson deviance", "log"),
    ("1 to 5 stars", "ordered categories", "ordinal log loss", "cumulative logit"),
    ("next token (LLM)", "categorical, ~100k ways", "cross-entropy", "softmax"),
])
y += 7 * 40 + 24
text(inner, y, "Every row is a GLM's answer space; each link is the one that makes the loss convex. Jev's noul, score and choice are rows 1, 5 and 2.", size="small", wrap=BW - 2 * PAD)
y += 60
B_h = y - BY
sections.append(section(BX, BY, BW, B_h, "Y is a belief: two answer spaces, one loss"))

# ---------------------------------------------------------------- C logistic regression
CX, CY, CW = 1680, 0, 800
inner = CX + PAD
steps = [
    "**1. Two states.** A tweet is either real or not. Give the 'real' state an energy relative to 'not': E(x) = −(w·x + b). Features push the energy up or down.",
    "**2. Occupation.** The chance of the 'real' state is p = 1 / (1 + e^(E/T)): the Boltzmann factor for a two-state system, the Fermi–Dirac form. In logistic regression T is folded into the size of w.",
    "**3. The partition function.** Z = 1 + e^θ with θ = w·x + b. Its log, A(θ) = log(1 + e^θ), is convex. Its slope is the mean, p = A′(θ); its curvature is the fluctuation, p(1 − p) = A″(θ).",
    "**4. Training is maximum likelihood**, which is minimum cross-entropy. The gradient is Σ (y − p) x. At the optimum, for every feature, the data's average equals the model's average: moment matching. That's Jaynes's maximum-entropy model, which is why it's calibrated in the large for free.",
    "**5. One optimum, unless the data separates.** Convexity gives a single global optimum. If a line separates the training labels, there is none: |w| runs to infinity, T → 0, every p goes to 0 or 1. The hard wall. An L2 penalty is a prior, and keeps a finite temperature.",
    "**6. Platt scaling is the same model, one level up.** Input: the logit of some other model. p = σ(a·z + b), with a = 1/T and b = μ/T. You fit a temperature and a chemical potential. A base-rate shift moves μ; overconfidence is a T error.",
]
y = CY + PAD
for s in steps:
    i, h = block(inner, y, 752, s, size="small")
    y += h + 16
y += 8
C_h = y - CY
sections.append(section(CX, CY, CW, C_h, "Logistic regression is a two-state system"))

# ---------------------------------------------------------------- D loss taxonomy
row2 = max(A_h, B_h, C_h) + 110
DX, DY = 0, row2
inner = DX + PAD
cols = [("model", 190), ("what training optimizes", 250), ("one global objective?", 150), ("honest at its optimum?", 190), ("probabilities out of the box", 250)]
trows = [
    ("logistic / linear / Poisson regression", "the likelihood (log loss, squared error)", "yes, convex", "yes", "calibrated on its training data"),
    ("neural net classifier", "cross-entropy", "yes, not convex", "yes", "often overconfident: fix with T"),
    ("gradient boosting", "log loss, one tree at a time", "yes, built greedily", "yes", "usually close"),
    ("AdaBoost", "exponential loss", "yes", "half the log-odds", "squashed: needs Platt"),
    ("SVM", "hinge loss + margin", "yes, convex", "no: only the side", "none: Platt was invented for it"),
    ("random forest / tree", "impurity, split by split", "no", "no target", "squashed toward 0.5"),
    ("naive Bayes", "likelihood of words given class", "yes, wrong model", "no: assumes independence", "pushed to 0 and 1"),
    ("k-nearest neighbours", "nothing: it memorises", "no", "no target", "coarse fractions"),
    ("LLM, pretrained", "next-token cross-entropy", "yes", "yes", "roughly calibrated"),
    ("LLM after RLHF", "reward + KL penalty", "yes", "no: preference isn't proper", "often overconfident"),
    ("TabPFN", "cross-entropy over synthetic tasks", "yes, meta-learned", "yes, for its prior", "calibrated if the prior fits"),
    ("Jev (vendor claim)", "RL toward calibrated decisions", "yes", "claimed; unpublished", "check on your traffic"),
]
fills = {}
for j, r in enumerate(trows):
    if r[3].startswith("no"):
        fills[f"r{j+2}"] = {"c4": "pink"}
    elif r[3] == "yes":
        fills[f"r{j+2}"] = {"c4": "green"}
y = DY + PAD
text(inner, y, "A global, proper loss is what makes a model's probabilities honest at its optimum. Everything else needs a map after it.", size="body", wrap=1030)
y += 56
table(inner, y, cols, trows, fills=fills)
tw = sum(w for _, w in cols)
y += 13 * 40 + 24
D_w = tw + 2 * PAD
D_h = y - DY
sections.append(section(DX, DY, D_w, D_h, "Who has a global loss?"))

# ---------------------------------------------------------------- E System One check
EX, EY = D_w + 40, row2
EW = 1300
inner = EX + PAD
colw = (EW - 3 * PAD) // 2
y = EY + PAD
c1, h = block(inner, y, EW - 2 * PAD, "**Your claim:** System One models didn't create a new kind of ML solution.", color="peach", size="body")
y += h + 20
yl = yr = y
blocksL = [
    "**Verdict: true for the kind of answer; open on the training.** The answer types are the oldest in ML: yes/no, one of k, an ordered score. The shape is an old one too: a transformer reads (text, question) and outputs a distribution over a typed answer space.",
    "**What it's built on:** BERT with a classification head (2018); zero-shot classification by entailment, where the label's description is the 'question' (Yin et al., 2019); cross-encoders that read two texts at once. Jev's instructions + criteria is this pattern.",
    "**What may be new, if the claims hold:** answering a question you wrote five minutes ago, with no training data, at LLM-like breadth; all questions in one pass; and training aimed at honest probabilities rather than preferred answers. The architecture is unpublished.",
]
blocksR = [
    "**Why an LLM isn't the same thing:** an LLM can imitate any data-science output as text (a label, a number, a score), but text drops the distribution. A stated confidence ('90% sure') bunches on round numbers; the logprobs are closer but are for tokens, not your question.",
    "**System One returns the distribution itself.** That's a classifier's output, not a chatbot's. It's the reason the honesty layer below can sit on top of it.",
    "**A line you can defend:** System One is a classifier with an instruction-following front end. New question, no training data; old kind of answer.",
]
for s in blocksL:
    i, h = block(inner, yl, colw, s, size="small")
    yl += h + 16
for k, s in enumerate(blocksR):
    i, h = block(inner + colw + PAD, yr, colw, s, size="small", color="peach" if k == 2 else "white")
    yr += h + 16
y = max(yl, yr) + 8
E_h = y - EY
sections.append(section(EX, EY, EW, E_h, "Is System One new? A claim check"))

# ---------------------------------------------------------------- F the honesty layer
row3 = row2 + max(D_h, E_h) + 110
FX, FY, FW = 0, row3, 1500
inner = FX + PAD
y = FY + PAD
pre, h = block(inner, y, FW - 2 * PAD, "**Before the loop, once:** list every place code acts on the model's number. For each, write what a false alarm and a miss cost, and check the truth is ever learnable. If you'll never find out, you can't calibrate it.", size="small")
y += h + 40
sw, sg = 400, 96
loop_blocks = [
    "**1. Serve and log.** p = σ(a · logit(raw) + b). Act if p ≥ c_FP / (c_FP + c_FN). Log the raw score, the question, the model version, the decision.",
    "**2. Label two ways.** The reviews you already do, plus a random 2–3% of everything, including what you didn't act on. Record each item's chance of being picked.",
    "**3. Fit per question.** Platt's two numbers on labels the model never trained on: a few hundred per question. Weight audit labels by 1 / chance. Hold back the newest slice.",
    "**4. Ship only if better.** The new map must beat the old one on the held-back slice. Pin the model version: an alias that moves breaks every map.",
    "**5. Watch.** Daily: has the raw-score histogram shifted (PSI)? Weekly: on the random audit, do the 0.8s happen 8 in 10? Either one pulls a refit forward.",
]
pos = [(inner + 20, y), (inner + 20 + sw + sg, y), (inner + 20 + 2 * (sw + sg), y)]
ids = []
hmax = 0
for k in range(3):
    i, h = block(pos[k][0], pos[k][1], sw, loop_blocks[k], color="blue", size="small", h=150)
    ids.append(i)
y2 = y + 150 + 110
centre, hc = block(inner + 20 + sw + sg, y2 - 10 - 20, sw, "**The honesty layer**\na monotone map after a model you don't control: Jev, an LLM, a vendor's score", color="white", align="center", h=96, stroke="ink")
i4, _ = block(inner + 20 + 2 * (sw + sg), y2 + 80, sw, loop_blocks[3], color="blue", size="small", h=150)
i5, _ = block(inner + 20, y2 + 80, sw, loop_blocks[4], color="blue", size="small", h=150)
arrow(ids[0], ids[1], "right", "left")
arrow(ids[1], ids[2], "right", "left")
arrow(ids[2], i4, "bottom", "top")
arrow(i4, i5, "left", "right", label="refit on a rolling window")
arrow(i5, ids[0], "top", "bottom")
y = y2 + 80 + 150 + 40
why, h = block(inner, y, (FW - 3 * PAD) // 2, "**Why a separate stage:** ranking is the expensive part (thousands of labels, a long retrain); honesty is two numbers that a few hundred labels pin down. Splitting them lets you refit the cheap part every week, and it's the only part you can touch when the model is someone else's.", size="small")
code, h2 = block(inner + (FW - 3 * PAD) // 2 + PAD, y, (FW - 3 * PAD) // 2,
                 "`raw = model(text)            # Jev's noul, a logprob, a vendor score`\n`key = (question, model_version)`\n`a, b = table[key]            # refit weekly`\n`p = sigmoid(a * logit(raw) + b)`\n`act = p >= c_fp / (c_fp + c_fn)`\n`log(key, raw, p, act)`", size="small")
y += max(h, h2) + 24
F_h = y - FY
sections.append(section(FX, FY, FW, F_h, "The honesty layer you own: set up once, run forever"))

# ---------------------------------------------------------------- G the boundary softens
GX, GY = FW + 40, row3
GW = 5 * 170 + 4 * 64 + 2 * PAD
inner = GX + PAD
y = GY + PAD
steps = [
    "**hand-written rules**\nif / else; every branch is a person's decision",
    "**handwired**\nCheng Lou's compiler: the same if / else as a fixed-weight network of matrix multiplies and ReLUs. Rules become weights, untrained",
    "**differentiable programming**\nonce the program is weights, a gradient can tune it from data",
    "**learned**\n'Software 2.0' (Karpathy, 2017): the weights are found from data; nobody writes the rules",
    "**borrowed**\nfoundation models and agents: someone else's learned weights, steered by a prompt",
]
ids = []
x = inner
for s in steps:
    i, h = block(x, y, 170, s, size="small", align="center", h=250)
    ids.append(i)
    x += 170 + 64
for a_, b_ in zip(ids[:-1], ids[1:]):
    arrow(a_, b_, "right", "left")
y += 250 + 28
g, h = block(inner, y, GW - 2 * PAD, "**The guardrails the data side learned the hard way, and agentic engineering mostly skips:** held-out data, proper losses, calibration, drift monitoring, a random audit. A prompt is a program you can't unit-test; a probability is a claim you have to audit.", color="peach", size="small")
y += h + 16
text(inner, y, "Handwired is from secondary write-ups; check github.com/chenglou/handwired before quoting it.", size="small", wrap=GW - 2 * PAD)
y += 50
G_h = y - GY
sections.append(section(GX, GY, GW, G_h, "Rules become weights: the boundary softens"))

# ---------------------------------------------------------------- write out
others = [k for k in els if k not in sections]
order = sections + others
os.makedirs(os.path.join(OUT, "el"), exist_ok=True)
for k, v in els.items():
    json.dump(v, open(os.path.join(OUT, "el", f"{k}.json"), "w"))
json.dump({"v": 1, "title": "enjoy your logits: idea grammar", "order": order}, open(os.path.join(OUT, "meta.json"), "w"))
json.dump(order, open(os.path.join(OUT, "order.json"), "w"))
xs = [v.get("x", 0) + v.get("w", 0) for v in els.values() if "x" in v]
ys = [v.get("y", 0) + v.get("h", 0) for v in els.values() if "y" in v]
print(len(els), "elements; board extent", max(xs), "x", max(ys))
print("order:", " ".join(order))
