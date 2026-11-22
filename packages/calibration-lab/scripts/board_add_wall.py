"""The leaky-wall module: hard wall (T = 0), soft wall (finite T), the plumber.
New ids from e143. Sits right of the which-map section."""
import json, math, os
OUT = os.path.dirname(os.path.abspath(__file__))
els = {}
n = [142]
def nid():
    n[0] += 1; return f"e{n[0]}"
def lines_for(text, w, size=16):
    cpl = max(8, int((w - 30) / (0.52 * size)))
    return sum(max(1, math.ceil(len(p.replace("**", "")) / cpl)) for p in text.split("\n"))
def block(x, y, w, text, color="white", size="small", align="left", h=None):
    px = {"small": 14, "body": 16}[size]
    if h is None: h = int(lines_for(text, w, px) * px * 1.5 * 1.12 + 30)
    i = nid(); els[i] = {"type": "shape", "kind": "rounded", "x": x, "y": y, "w": w, "h": h, "color": color, "size": size, "text": text, "textAlign": align}
    return i, h
def text(x, y, s, size="body", wrap=None):
    i = nid(); e = {"type": "text", "x": x, "y": y, "text": s, "size": size}
    if wrap: e["wrap"] = wrap
    els[i] = e; return i
def arrow(a, b, fs, ts):
    i = nid(); els[i] = {"type": "arrow", "from": a, "to": b, "fromSide": fs, "toSide": ts}; return i
def image(x, y, w, h, svg):
    i = nid(); els[i] = {"type": "image", "x": x, "y": y, "w": w, "h": h, "by": "claude", "style": "plain", "src": "data:image/svg+xml," + svg.replace("#", "%23")}; return i

HARD = ("<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 320 190' fill='none' stroke='currentColor' stroke-width='2.5' stroke-linecap='round' stroke-linejoin='round'>"
        "<desc>Square-on diagram of a hard wall. Parts: floor line, tall solid wall with a darker face and a lighter top cap, ball resting on the floor left of the wall, ball highlight, "
        "dashed path from the ball up to the wall face, dashed return path back to the start, arrowhead on the return, empty floor right of the wall, small floor ticks.</desc>"
        "<line x1='14' y1='172' x2='306' y2='172'/>"
        "<rect x='176' y='26' width='30' height='146' fill='#5b6b80' stroke='#5b6b80'/>"
        "<rect x='176' y='26' width='30' height='8' fill='#8193a8' stroke='none'/>"
        "<circle cx='80' cy='156' r='15' fill='#3b6fd1' stroke='#2b5bb5'/>"
        "<circle cx='75' cy='151' r='4' fill='#ffffff' stroke='none' fill-opacity='.7'/>"
        "<path d='M96 150 C120 120 150 104 172 104' stroke-dasharray='5 5' stroke-width='2'/>"
        "<path d='M172 112 C150 124 126 136 104 146' stroke-dasharray='5 5' stroke-width='2'/>"
        "<polygon points='104,146 116,136 114,150' fill='currentColor' stroke='none'/>"
        "<line x1='230' y1='172' x2='230' y2='178' stroke-width='1.2'/><line x1='270' y1='172' x2='270' y2='178' stroke-width='1.2'/>"
        "</svg>")
SOFT = ("<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 320 190' fill='none' stroke='currentColor' stroke-width='2.5' stroke-linecap='round' stroke-linejoin='round'>"
        "<desc>Square-on diagram of a smooth energy barrier. Parts: floor line, rounded hill with a shaded body and a paler crest, ball on the left foot of the hill, ball highlight, "
        "dashed path climbing over the crest, faded ball that arrived on the far side, faded highlight, arrowhead at the far side, exponential tail marks thinning away from the crest.</desc>"
        "<line x1='14' y1='172' x2='306' y2='172'/>"
        "<path d='M40 172 C100 170 120 40 160 40 C200 40 220 170 280 172 Z' fill='#9fb3c8' fill-opacity='.45' stroke='#5b6b80'/>"
        "<path d='M128 70 C142 46 178 46 192 70' stroke='#ffffff' stroke-opacity='.6' stroke-width='3'/>"
        "<circle cx='52' cy='156' r='15' fill='#3b6fd1' stroke='#2b5bb5'/>"
        "<circle cx='47' cy='151' r='4' fill='#ffffff' stroke='none' fill-opacity='.7'/>"
        "<path d='M66 146 C100 120 120 22 160 22 C200 22 222 120 252 146' stroke-dasharray='5 5' stroke-width='2'/>"
        "<polygon points='252,146 240,140 248,132' fill='currentColor' stroke='none'/>"
        "<circle cx='270' cy='156' r='15' fill='#c0582f' stroke='#c0582f' fill-opacity='.35'/>"
        "<circle cx='265' cy='151' r='4' fill='#ffffff' stroke='none' fill-opacity='.5'/>"
        "<line x1='206' y1='178' x2='206' y2='182' stroke-width='3' stroke='#c0582f'/>"
        "<line x1='226' y1='178' x2='226' y2='181' stroke-width='2' stroke='#c0582f'/>"
        "<line x1='246' y1='178' x2='246' y2='180' stroke-width='1.2' stroke='#c0582f'/>"
        "</svg>")

JX, JY, JW = 1548, 2775, 1146
ix = JX + 24
c1, c2, c3 = ix, ix + 340 + 60, ix + 2 * (340 + 60)
y = JY + 24
text(ix, y, "**Inference turns every wall into a leaky one. Calibration measures the leak.**", size="body", wrap=JW - 48)
y += 48
text(c1, y, "**T = 0: if / else**")
text(c2, y, "**finite T: a classifier**")
text(c3, y, "**the plumber's number**")
y += 32
im1 = image(c1, y, 320, 190, HARD)
im2 = image(c2, y, 320, 190, SOFT)
arrow(im1, im2, "right", "left")
cap1, h1 = block(c1, y + 190 + 16, 340, "A hard wall. Below the threshold an input never crosses. The wall holds, or it has a bug.")
cap2, h2 = block(c2, y + 190 + 16, 340, "A soft wall: p = σ(z / T). Every input has some chance of ending up on the wrong side, shrinking like e^(−margin / T) away from the boundary. Boltzmann over the barrier: the same exponential as softmax.")
py = y
plumb = [
    "**calibrated p**\nthe measured leak rate",
    "**random audit**\nthe leak detector",
    "**drift alarm**\nthe pressure gauge",
    "**refit**\nthe repair visit",
]
pids = []
for s in plumb:
    i, h = block(c3, py, 298, s, color="blue", align="center", h=64)
    pids.append(i); py += 64 + 16
arrow(im2, pids[0], "right", "left")
text(c3, py + 4, "The full loop is in 'The honesty layer you own'.", size="small", wrap=298)
y = max(y + 190 + 16 + max(h1, h2), py + 40) + 24
w_ = (JW - 48 - 24) // 2
t1, a1 = block(ix, y, w_, "**Sometimes you want the leak.** It's how a model handles an input your rules never anticipated, the way heat lets annealing escape a local minimum. The leak and the generalization are the same mechanism. Budget for it.", color="peach")
t2, a2 = block(ix + w_ + 24, y, w_, "**Where the physics stops.** Formal: Boltzmann, ergodicity, hard vs soft walls, the Brownian ruler. Picture only: tunneling (a classifier has no amplitudes; nothing interferes). Method only: reading a noisy trace's fractal dimension, as with conductance fluctuations.")
y += max(a1, a2) + 24
sec = nid()
els[sec] = {"type": "container", "x": JX, "y": JY, "w": JW, "h": y - JY, "text": "Every wall leaks: the soft wall and the plumber"}
order = [sec] + [k for k in els if k != sec]
os.makedirs(os.path.join(OUT, "el3"), exist_ok=True)
for k, v in els.items():
    json.dump(v, open(os.path.join(OUT, "el3", f"{k}.json"), "w"))
print(len(els), "elements; section height", y - JY, "right edge", JX + JW)
print(" ".join(order))
