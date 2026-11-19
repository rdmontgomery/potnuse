"""Loading and splitting. Works the same on the Kaggle file and the synthetic one.

The real file: https://www.kaggle.com/competitions/nlp-getting-started/data
(train.csv only; test.csv has no labels and is useless for calibration).
Drop it at data/real/train.csv, or pass --data.

If a truth.csv sits next to train.csv (only the synthetic one has it), its
p_true column is joined on id and every oracle metric switches on.
"""

from __future__ import annotations

import hashlib
import html
import re
from dataclasses import dataclass
from pathlib import Path
from urllib.parse import unquote

import numpy as np
import pandas as pd

ROOT = Path(__file__).resolve().parent.parent
SYNTH = ROOT / "data" / "synthetic" / "train.csv"
REAL = ROOT / "data" / "real" / "train.csv"

# The drift split: tweets about water. Matches keywords in both the real file
# (flood, floods, flooding, deluged, drowning, sunk, inundation, ...) and the
# synthetic one. Held out of training entirely, they arrive later in the stream.
WATER = re.compile(r"flood|hurrican|typhoon|tsunami|delug|drown|sink|sunk|rainstorm|inundat|submerg|storm surge|cyclone")

URL = re.compile(r"https?://\S+")


def clean(text: str) -> str:
    t = html.unescape(str(text))
    t = URL.sub("http", t)
    return re.sub(r"\s+", " ", t).strip()


@dataclass
class Dataset:
    df: pd.DataFrame          # id, keyword, location, text, target, [p_true]
    name: str

    @property
    def texts(self) -> list[str]:
        return [clean(t) for t in self.df["text"]]

    @property
    def y(self) -> np.ndarray:
        return self.df["target"].to_numpy().astype(int)

    @property
    def truth(self) -> np.ndarray | None:
        return self.df["p_true"].to_numpy() if "p_true" in self.df else None

    @property
    def water(self) -> np.ndarray:
        return self.df["keyword"].fillna("").str.contains(WATER).to_numpy()

    @property
    def digest(self) -> str:
        h = hashlib.sha1("\x1f".join(self.df["text"].astype(str)).encode()).hexdigest()
        return h[:12]


def load(path: Path | str | None = None) -> Dataset:
    if path is None:
        path = REAL if REAL.exists() else SYNTH
    path = Path(path)
    df = pd.read_csv(path)
    missing = {"id", "text", "target"} - set(df.columns)
    if missing:
        raise ValueError(f"{path} is missing columns {missing}; expected Kaggle's train.csv")
    for c in ("keyword", "location"):
        if c not in df:
            df[c] = np.nan
    df["keyword"] = df["keyword"].map(lambda k: unquote(k) if isinstance(k, str) else k)
    truth = path.parent / "truth.csv"
    if truth.exists():
        t = pd.read_csv(truth)[["id", "p_true", "register", "family"]]
        df = df.merge(t, on="id", how="left")
    return Dataset(df=df.reset_index(drop=True), name=path.parent.name)


@dataclass
class Split:
    train: np.ndarray
    cal: np.ndarray
    test: np.ndarray


def random_split(n: int, y: np.ndarray, seed: int = 0, frac=(0.5, 0.2, 0.3)) -> Split:
    """Stratified train / calibration / test. Calibration is its own slice:
    a map fitted on the rows the model trained on learns the model's
    overfitting, not its miscalibration."""
    rng = np.random.default_rng(seed)
    parts = [[], [], []]
    for cls in (0, 1):
        idx = np.flatnonzero(y == cls)
        rng.shuffle(idx)
        a = int(round(frac[0] * len(idx)))
        b = a + int(round(frac[1] * len(idx)))
        parts[0] += list(idx[:a])
        parts[1] += list(idx[a:b])
        parts[2] += list(idx[b:])
    return Split(*(np.array(sorted(p)) for p in parts))


def drift_split(ds: Dataset, seed: int = 0, train_frac: float = 0.6):
    """Train only on dry tweets. Returns train idx, the remaining dry idx and
    all water idx, for the stream to play in that order."""
    rng = np.random.default_rng(seed)
    dry = np.flatnonzero(~ds.water)
    wet = np.flatnonzero(ds.water)
    rng.shuffle(dry)
    rng.shuffle(wet)
    k = int(train_frac * len(dry))
    return np.sort(dry[:k]), dry[k:], wet
