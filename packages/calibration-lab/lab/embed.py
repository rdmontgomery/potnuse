"""Text -> vectors. One frozen encoder, many heads.

Three encoders behind one call, cached to disk by (encoder, prompt, data):

  lsa    TF-IDF (words + character n-grams) -> truncated SVD, L2-normalised.
         Runs anywhere, no download. Its components come out ordered by
         variance, so truncating to the first d is a crude Matryoshka. This is
         the overnight stand-in; it knows nothing a pretrained model knows.
  gemma  google/embeddinggemma-300m through sentence-transformers. 768-d,
         Matryoshka-trained to truncate at 512/256/128, and steered by a task
         prefix ("task: classification | query: ..."). Gated on Hugging Face:
         accept the Gemma licence, then `export HF_TOKEN=...`.
         Run in float32 or bfloat16; the model card warns float16 is unsupported.
  tfidf  the sparse matrix itself, for the bag-of-words baselines.

    X = embed(texts, "gemma", prompt=PROMPTS["classification"], dim=256)
"""

from __future__ import annotations

import hashlib
import json
from pathlib import Path

import numpy as np
from scipy import sparse
from sklearn.decomposition import TruncatedSVD
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.pipeline import FeatureUnion

CACHE = Path(__file__).resolve().parent.parent / "cache"

# EmbeddingGemma's documented prompt formats, plus one written for this task.
# The model card's classification prompt is "task: classification | query: ".
PROMPTS = {
    "none": "",
    "classification": "task: classification | query: ",
    "clustering": "task: clustering | query: ",
    "search": "task: search result | query: ",
    "custom": "task: is this tweet reporting a real disaster | query: ",
}

GEMMA_ID = "google/embeddinggemma-300m"


def tfidf_vectorizer() -> FeatureUnion:
    return FeatureUnion([
        ("w", TfidfVectorizer(ngram_range=(1, 2), min_df=2, sublinear_tf=True, lowercase=True)),
        ("c", TfidfVectorizer(analyzer="char_wb", ngram_range=(3, 5), min_df=3, sublinear_tf=True, max_features=40000)),
    ])


def _key(*parts) -> str:
    return hashlib.sha1(json.dumps(parts, sort_keys=True).encode()).hexdigest()[:16]


def _lsa(texts: list[str], dim: int = 256, seed: int = 0) -> np.ndarray:
    X = tfidf_vectorizer().fit_transform(texts)
    Z = TruncatedSVD(n_components=dim, random_state=seed, algorithm="randomized", n_iter=7).fit_transform(X)
    return Z


def _gemma(texts: list[str], prompt: str, batch: int = 64) -> np.ndarray:
    try:
        from sentence_transformers import SentenceTransformer
    except ImportError as e:  # pragma: no cover
        raise SystemExit("gemma needs the extra: uv sync --extra gemma (and HF_TOKEN for the gated weights)") from e
    model = SentenceTransformer(GEMMA_ID)
    return np.asarray(model.encode(texts, prompt=prompt, batch_size=batch,
                                   show_progress_bar=True, convert_to_numpy=True,
                                   normalize_embeddings=False))


def embed(texts: list[str], encoder: str = "lsa", prompt: str = "", dim: int | None = None,
          digest: str = "") -> np.ndarray:
    """Full-width vectors are cached; `dim` truncates and re-normalises, which
    is exactly how a Matryoshka model is meant to be shortened."""
    CACHE.mkdir(exist_ok=True)
    f = CACHE / f"{encoder}-{_key(encoder, prompt, digest or len(texts))}.npy"
    if f.exists():
        Z = np.load(f)
    else:
        if encoder == "lsa":
            Z = _lsa(texts)
        elif encoder == "gemma":
            Z = _gemma(texts, prompt)
        else:
            raise ValueError(encoder)
        np.save(f, Z)
    if dim is not None:
        Z = Z[:, :dim]
    return Z / np.maximum(np.linalg.norm(Z, axis=1, keepdims=True), 1e-12)


def tfidf(train_texts, other_texts):
    v = tfidf_vectorizer()
    A = v.fit_transform(train_texts)
    return A, [v.transform(t) for t in other_texts]


def fisher_ratio(score, y) -> float:
    """(mu1 - mu0)^2 / (var0 + var1) of a 1-d score: how far apart the two
    classes sit along the probe's direction, in units of their spread. The
    number to compare across task prefixes."""
    score, y = np.asarray(score, float), np.asarray(y)
    a, b = score[y == 1], score[y == 0]
    return float((a.mean() - b.mean()) ** 2 / (a.var() + b.var() + 1e-12))


def is_sparse(X) -> bool:
    return sparse.issparse(X)
