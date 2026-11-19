"""A synthetic stand-in for Kaggle's "NLP with Disaster Tweets" train.csv.

Same columns (id, keyword, location, text, target), same row count (7613),
about the same base rate (0.43), the same mess (t.co links, @mentions,
hashtags, &amp;, %20 in keywords, a third of locations missing, retweets that
duplicate text with different labels).

What the real file can't give you and this one does: every row's true
probability. The generator draws a tweet, computes P(real disaster | text)
from features that are visible in the text, and only then flips a coin with
that probability for the label. That is the jev-mock trick in reverse
generative order: calibrated by construction, so `truth.csv` is an oracle you
can score any model against. On the real data the oracle column doesn't exist
and every oracle metric in the pipeline is skipped.

The truth is deliberately not linear in bag-of-words. The keyword's pull on
the label is multiplied by a per-register gain (ambiguous tweets lean on the
keyword, figurative ones barely do), so a linear probe on word counts can't
represent it exactly and a nonlinear one has something to find.

    uv run python -m lab.synth            # writes data/synthetic/{train,truth}.csv
"""

from __future__ import annotations

import argparse
import csv
import math
import string
from dataclasses import dataclass
from pathlib import Path

import numpy as np

HERE = Path(__file__).resolve().parent.parent

# --------------------------------------------------------------------------
# keywords, by family. The real file has 221 keywords; this has ~120, which is
# enough for keyword-holdout drift splits to be meaningful.
# pos: 'n' noun phrase ("the {kw}"), 's' state/verb ("I'm {kw}")
# lean: the keyword's own literal tendency on a logit scale, before register.
# --------------------------------------------------------------------------

FAMILIES: dict[str, list[tuple[str, str, float]]] = {
    "fire": [
        ("fire", "n", 0.2), ("wildfire", "n", 2.2), ("forest fire", "n", 2.4),
        ("bush fires", "n", 2.3), ("ablaze", "s", -0.2), ("blaze", "n", 0.6),
        ("flames", "n", -0.4), ("burning", "s", -0.3), ("arson", "n", 1.5),
        ("burned", "s", -0.1), ("blazing", "s", -1.6), ("engulfed", "s", 0.4),
        ("buildings on fire", "n", 1.9), ("fire truck", "n", 0.5),
    ],
    "water": [
        ("flood", "n", 1.0), ("flooding", "n", 1.4), ("hurricane", "n", 0.9),
        ("typhoon", "n", 2.2), ("tsunami", "n", 0.8), ("deluge", "n", -0.2),
        ("drown", "s", -1.0), ("drowned", "s", 0.1), ("sinking", "s", -0.7),
        ("rainstorm", "n", 0.7), ("flash flood", "n", 1.8), ("inundated", "s", 0.0),
        ("submerged", "s", 0.5), ("storm surge", "n", 1.7),
    ],
    "earth": [
        ("earthquake", "n", 1.3), ("aftershock", "n", -2.0), ("seismic", "s", 0.6),
        ("landslide", "n", 1.4), ("mudslide", "n", 0.9), ("sinkhole", "n", 1.3),
        ("collapse", "n", 0.0), ("collapsed", "s", 0.2), ("rubble", "n", 1.1),
        ("avalanche", "n", -0.3), ("volcano", "n", 0.5), ("lava", "n", -0.6),
    ],
    "transport": [
        ("derailment", "n", 2.9), ("derailed", "s", 2.2), ("train", "n", 0.3),
        ("crash", "n", 0.0), ("collision", "n", 1.1), ("airplane accident", "n", 2.0),
        ("wreck", "n", -0.6), ("wreckage", "n", 2.8), ("wrecked", "s", -1.4),
        ("pileup", "n", 1.6), ("crashed", "s", -0.2), ("debris", "n", 2.0),
    ],
    "violence": [
        ("bomb", "n", 0.1), ("bombing", "n", 1.6), ("explosion", "n", 0.9),
        ("exploded", "s", 0.0), ("suicide bomber", "n", 2.6), ("terrorism", "n", 1.4),
        ("hostage", "n", 0.8), ("riot", "n", 0.3), ("rioting", "n", 0.6),
        ("mass murder", "n", 0.9), ("gunfire", "n", 1.0), ("attack", "n", 0.0),
        ("detonate", "s", 0.2), ("casualties", "n", 1.5),
    ],
    "health": [
        ("outbreak", "n", 2.5), ("epidemic", "n", 0.9), ("quarantine", "n", 0.5),
        ("quarantined", "s", 0.6), ("ebola", "n", 1.4), ("chemical emergency", "n", 1.6),
        ("hazardous", "s", 0.4), ("bioterror", "n", 0.7), ("radiation emergency", "n", 1.1),
        ("injured", "s", 0.7), ("fatalities", "n", 1.5), ("evacuated", "s", 1.5),
    ],
    "weather": [
        ("storm", "n", 0.0), ("tornado", "n", 0.8), ("hail", "n", 0.2),
        ("lightning", "n", -0.3), ("thunder", "n", -0.9), ("heat wave", "n", 0.6),
        ("drought", "n", 1.4), ("blizzard", "n", -0.4), ("cyclone", "n", 1.5),
        ("whirlwind", "n", -1.0), ("windstorm", "n", 0.7), ("severe weather", "n", 1.3),
    ],
    "figurative": [
        ("panic", "n", -1.1), ("screaming", "s", -2.0), ("panicking", "s", -1.6),
        ("obliterated", "s", -1.2), ("annihilated", "s", -1.0), ("demolished", "s", -0.6),
        ("destroyed", "s", -0.5), ("body bags", "n", -2.2), ("armageddon", "n", -1.3),
        ("apocalypse", "n", -0.9), ("blew up", "s", -1.0), ("bloody", "s", -1.6),
        ("fear", "n", -1.5), ("trauma", "n", -0.9), ("ruin", "n", -2.1),
        ("catastrophe", "n", -0.2), ("disaster", "n", -0.3), ("emergency", "n", 0.3),
    ],
}

# --------------------------------------------------------------------------
# registers: how a tweet uses its keyword. base = intercept on the logit,
# gain = how much the keyword's lean counts in this register.
# --------------------------------------------------------------------------


@dataclass(frozen=True)
class Register:
    name: str
    weight: float
    base: float
    gain: float
    noun: tuple[str, ...]
    state: tuple[str, ...]


REGISTERS = [
    Register(
        "report", 0.30, 2.0, 0.45,
        noun=(
            "{N} people evacuated as {kw} hits {place}",
            "BREAKING: {kw} reported near {place}, emergency crews on scene",
            "Update: death toll from {place} {kw} rises to {N}",
            "Officials confirm {kw} in {place}. Residents told to stay indoors",
            "Roads closed after {kw} near {place} this morning",
            "{kw} in {place} leaves {N} injured, dozens displaced",
            "Live updates: {kw} damage across {place}",
            "Rescue teams searching for survivors after {kw} in {place}",
        ),
        state=(
            "{N} homes {kw} in {place} overnight, officials say",
            "Highway near {place} {kw} after last night, crews responding",
            "Entire block {kw} in {place}. Fire and police on scene",
            "Reports that the old bridge in {place} is {kw}. Stay away from the river",
        ),
    ),
    Register(
        "witness", 0.12, 1.2, 0.9,
        noun=(
            "Can see the {kw} from my window right now in {place}",
            "omg the {kw} is right down the street from us",
            "Just drove past the {kw}. Praying for everyone there",
            "Praying for everyone affected by the {kw} in {place}",
            "Our power is out because of the {kw}. Anyone else in {place}?",
            "The {kw} came out of nowhere, we're ok but shaken",
        ),
        state=(
            "Our whole street got {kw} last night. We're safe",
            "My cousin's town was {kw}. Thinking of them",
            "Neighbors' house {kw}. Firefighters just arrived",
        ),
    ),
    Register(
        "ambiguous", 0.16, 0.0, 1.5,
        noun=(
            "{kw} everywhere today, can't believe it",
            "Watching the {kw} coverage and just wow",
            "Thinking about the {kw} again",
            "That {kw} last night was something else",
            "Is anyone else hearing about this {kw}??",
            "Not the {kw} again",
            "So much {kw} talk on my timeline",
            "the {kw} tho",
        ),
        state=(
            "Everything is {kw} right now",
            "Feels like the whole city is {kw}",
            "Well that got {kw} fast",
            "Literally everything {kw}",
        ),
    ),
    Register(
        "news_other", 0.10, -0.6, 0.8,
        noun=(
            "{kw} drill scheduled at {place} high school on Tuesday",
            "Study: {kw} risk in {place} lower than previously thought",
            "Remembering the {year} {kw} in {place}",
            "How to prepare your family for a {kw}: a checklist",
            "Insurance rates rising in {place} over {kw} fears",
            "Ten years after the {kw}, {place} rebuilds",
            "Documentary on the {year} {kw} premieres tonight",
        ),
        state=(
            "Museum exhibit shows what {kw} cities looked like in {year}",
            "New report ranks {place} among most likely to be {kw} by {year2}",
        ),
    ),
    Register(
        "figurative", 0.20, -2.4, 0.3,
        noun=(
            "my mixtape is straight {kw}",
            "this exam was a total {kw} lol",
            "When your crush texts back: internal {kw}",
            "Monday morning {kw} as usual",
            "my inbox is a {kw} right now",
            "the group chat is pure {kw} tonight",
            "@{user} that outfit is a {kw} and I love it",
            "Me at 3am: {kw} mode activated",
            "my hair today = {kw}",
        ),
        state=(
            "@{user} you just {kw} that game",
            "I'm literally {kw} right now",
            "my sleep schedule is {kw}",
            "We got {kw} in the second half smh",
            "Brunch was so good I'm {kw}",
            "my phone battery is {kw} already",
        ),
    ),
    Register(
        "media", 0.12, -1.9, 0.2,
        noun=(
            "New track '{Kw} Season' out now",
            "Just finished the movie and the {kw} scene!!",
            "{kw} sale at the mall this weekend only",
            "Who else is watching {Kw} tonight? #TV",
            "Reading a novel called {Kw} and can't put it down",
            "Got the {kw} achievement in the game finally",
            "Band name idea: {Kw} and the {Kw2}s",
        ),
        state=(
            "Chapter 12 and everyone is {kw}. This book is wild",
            "The final boss got {kw} on the first try",
            "Season finale: the whole town gets {kw}. No spoilers",
        ),
    ),
]

PLACES = [
    "California", "Oklahoma", "Japan", "Manila", "Houston", "New Orleans",
    "Baton Rouge", "Mumbai", "Lagos", "London", "Sydney", "Chile", "Nepal",
    "Haiti", "Florida", "the valley", "downtown", "Kashmir", "Texas",
    "Puerto Rico", "Jakarta", "Turkey", "Colorado", "Ohio", "Karachi",
    "Gulf Coast", "Saskatchewan", "the county", "Lake Charles", "Queens",
]
LOCATIONS = [
    "USA", "New York", "London", "Los Angeles, CA", "Canada", "Nigeria",
    "India", "Mumbai", "Washington, DC", "Kenya", "Worldwide", "Earth",
    "everywhere", "somewhere over the rainbow", "New Orleans, LA", "Chicago, IL",
    "Australia", "Texas", "Florida", "UK", "California", "ATL", "Your mom's house",
    "Philippines", "San Francisco", "Seattle", "Toronto", "Global", "Houston, TX",
]
USERS = [
    "jamie_k", "newsdesk", "bigmike", "kayla__", "sportsguy23", "theRealDee",
    "wx_alerts", "lulu", "Marco_P", "breakingwire", "nola_rick", "tasha.b",
]
TAGS_NEWS = ["#news", "#breaking", "#BreakingNews", "#update", "#alert", "#world"]
TAGS_FUN = ["#mood", "#fail", "#lol", "#mondays", "#relatable", "#music", "#np"]
WIRE = ["via @newsdesk", "via @breakingwire", "(AP)", "- Reuters", "| WSJ"]

# visible-feature effects on the logit, added after register and keyword
URL_EFFECT = 0.35
LOC_EFFECT = 0.15
SHOUT_EFFECT = -0.35  # "!!!", all caps, "lol"


def _url(rng: np.random.Generator) -> str:
    chars = string.ascii_letters + string.digits
    return "http://t.co/" + "".join(rng.choice(list(chars), size=10))


def _sigmoid(z: float) -> float:
    return 1.0 / (1.0 + math.exp(-z))


def _fill(template: str, kw: str, rng: np.random.Generator) -> str:
    kw2 = rng.choice([k for fam in FAMILIES.values() for k, _, _ in fam])
    return template.format(
        kw=kw,
        Kw=kw.title(),
        Kw2=str(kw2).title(),
        N=int(rng.choice([2, 3, 5, 7, 12, 15, 20, 40, 100, 300])),
        place=rng.choice(PLACES),
        year=int(rng.integers(1965, 2014)),
        year2=int(rng.integers(2030, 2060)),
        user=rng.choice(USERS),
    )


def generate(n: int = 7613, seed: int = 0, base_rate: float = 0.43):
    """Return (rows, truths). rows mirror train.csv; truths hold the oracle."""
    rng = np.random.default_rng(seed)
    kws = [(fam, kw, pos, lean) for fam, items in FAMILIES.items() for kw, pos, lean in items]
    # keywords are not equally common; Zipf-ish weights, shuffled
    kw_w = 1.0 / np.arange(1, len(kws) + 1) ** 0.35
    rng.shuffle(kw_w)
    kw_w /= kw_w.sum()
    reg_w = np.array([r.weight for r in REGISTERS])
    reg_w /= reg_w.sum()

    drafts = []
    for i in range(n):
        fam, kw, pos, lean = kws[rng.choice(len(kws), p=kw_w)]
        reg = REGISTERS[rng.choice(len(REGISTERS), p=reg_w)]
        pool = reg.noun if pos == "n" else reg.state
        text = _fill(str(rng.choice(pool)), kw, rng)

        serious = reg.name in ("report", "news_other", "witness")
        # decoration: links, tags, wire credits, shouting
        has_url = rng.random() < (0.75 if serious else 0.35)
        shout = (not serious) and rng.random() < 0.35
        if serious and rng.random() < 0.3:
            text += " " + rng.choice(TAGS_NEWS)
        if not serious and rng.random() < 0.35:
            text += " " + rng.choice(TAGS_FUN)
        if reg.name == "report" and rng.random() < 0.25:
            text += " " + rng.choice(WIRE)
        if shout:
            text = rng.choice([text.upper() + "!!!", text + " lol", text + " LMAO", text + "!!!"])
        if has_url:
            text += " " + _url(rng)
        if rng.random() < 0.08:
            text = text.replace(" and ", " &amp; ").replace(" & ", " &amp; ")
        if rng.random() < 0.07:
            text = text.replace("the ", "teh ", 1)

        has_loc = rng.random() < 0.67
        location = str(rng.choice(LOCATIONS)) if has_loc else ""

        logit = (
            reg.base
            + reg.gain * lean
            + URL_EFFECT * has_url
            + LOC_EFFECT * has_loc
            + SHOUT_EFFECT * shout
        )
        drafts.append(dict(fam=fam, kw=kw, reg=reg.name, text=text, location=location, logit=logit))

    # one intercept so the expected base rate lands where the real file's does
    logits = np.array([d["logit"] for d in drafts])
    lo, hi = -6.0, 6.0
    for _ in range(60):
        mid = (lo + hi) / 2
        if (1 / (1 + np.exp(-(logits + mid)))).mean() < base_rate:
            lo = mid
        else:
            hi = mid
    shift = (lo + hi) / 2

    # retweets: ~2% of rows copy an earlier tweet's text. Same text, same
    # truth, independent coin flip: the conflicting duplicate labels the real
    # file is known for, arising for the honest reason.
    rows, truths = [], []
    for i, d in enumerate(drafts):
        if i > 50 and rng.random() < 0.02:
            j = int(rng.integers(0, i))
            src = drafts[j]
            d = dict(src, text=("RT @" + str(rng.choice(USERS)) + ": " + src["text"]) if rng.random() < 0.5 else src["text"])
            drafts[i] = d
        p = _sigmoid(d["logit"] + shift)
        y = int(rng.random() < p)
        kid = d["kw"].replace(" ", "%20")
        # the real file has ~0.8% of rows with no keyword
        if rng.random() < 0.008:
            kid = ""
        rid = i + 1 + i // 3  # ids in the real file are increasing with gaps
        rows.append(dict(id=rid, keyword=kid, location=d["location"], text=d["text"], target=y))
        truths.append(dict(id=rid, p_true=round(p, 6), family=d["fam"], register=d["reg"], keyword=d["kw"]))
    return rows, truths


def write(out_dir: Path, n: int, seed: int) -> None:
    rows, truths = generate(n=n, seed=seed)
    out_dir.mkdir(parents=True, exist_ok=True)
    with open(out_dir / "train.csv", "w", newline="") as f:
        w = csv.DictWriter(f, fieldnames=["id", "keyword", "location", "text", "target"])
        w.writeheader()
        w.writerows(rows)
    with open(out_dir / "truth.csv", "w", newline="") as f:
        w = csv.DictWriter(f, fieldnames=["id", "p_true", "family", "register", "keyword"])
        w.writeheader()
        w.writerows(truths)
    y = np.array([r["target"] for r in rows])
    p = np.array([t["p_true"] for t in truths])
    print(f"wrote {len(rows)} rows to {out_dir}  base rate {y.mean():.3f}  mean p_true {p.mean():.3f}")


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("--n", type=int, default=7613)
    ap.add_argument("--seed", type=int, default=0)
    ap.add_argument("--out", type=Path, default=HERE / "data" / "synthetic")
    a = ap.parse_args()
    write(a.out, a.n, a.seed)
