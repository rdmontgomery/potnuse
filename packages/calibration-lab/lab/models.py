"""The ladder: from the actuary's table to a frozen transformer with a head.

Every model takes training rows and returns P(target = 1) for any other rows.
None of them sees the calibration or test slices while fitting.

  keyword_eb   empirical-Bayes keyword rates. Each keyword's disaster rate,
               shrunk toward the global rate by a Beta prior fitted to all
               keywords. Traditional statistics, calibrated by construction,
               knows nothing but the keyword.
  tfidf_nb     multinomial naive Bayes on word counts. The textbook
               overconfident model: it multiplies evidence it double-counts.
  tfidf_lr     logistic regression on TF-IDF, C by cross-validated log loss.
               The traditional baseline every Kaggle notebook starts from.
  tfidf_gbm    LightGBM on TF-IDF. Boosting is what wins on tables; here it
               is the 'state of the art without a transformer' entry.
  probe_lr     frozen encoder + logistic head. The linear probe. A head on
               frozen features *is* logistic regression, so it inherits
               logistic regression's calibration-in-the-large.
  probe_wall   the same head with the L2 penalty removed (C = 1e4). In 256
               dimensions with a few thousand rows the classes are nearly
               separable, the weights run off toward infinity, and the
               probabilities slam into 0 and 1: the hard wall, T -> 0.
  probe_mlp    a small nonlinear head on the same frozen features.
  probe_tabpfn TabPFN on the first 128 dims, if installed: a transformer that
               was pretrained to do Bayesian inference in context, used here
               as the nonlinear head.
"""

from __future__ import annotations

import numpy as np
from scipy.optimize import minimize
from scipy.special import betaln
from sklearn.linear_model import LogisticRegression
from sklearn.model_selection import StratifiedKFold, cross_val_predict
from sklearn.naive_bayes import MultinomialNB
from sklearn.neural_network import MLPClassifier
from sklearn.feature_extraction.text import CountVectorizer

from . import embed as E

C_GRID = np.logspace(-2, 2, 9)


def _best_C(X, y, grid=C_GRID, seed=0):
    """Pick C by 5-fold out-of-fold log loss on the training rows only."""
    skf = StratifiedKFold(5, shuffle=True, random_state=seed)
    best, bestC = np.inf, grid[0]
    for C in grid:
        p = cross_val_predict(LogisticRegression(C=C, max_iter=3000), X, y, cv=skf, method="predict_proba")[:, 1]
        p = np.clip(p, 1e-7, 1 - 1e-7)
        ll = -np.mean(y * np.log(p) + (1 - y) * np.log(1 - p))
        if ll < best:
            best, bestC = ll, C
    return float(bestC)


# ---------------------------------------------------------------- keyword EB


def keyword_eb(keywords_tr, y_tr, keywords_out):
    kw = np.array([k if isinstance(k, str) else "" for k in keywords_tr])
    y = np.asarray(y_tr, float)
    groups = {k: (y[kw == k].sum(), (kw == k).sum()) for k in np.unique(kw)}
    ks = np.array([v[0] for v in groups.values()])
    ns = np.array([v[1] for v in groups.values()])

    # fit Beta(a, b) by maximising the beta-binomial marginal likelihood
    def nll(th):
        a, b = np.exp(th)
        return -np.sum(betaln(ks + a, ns - ks + b) - betaln(a, b))

    a, b = np.exp(minimize(nll, x0=np.log([2.0, 2.0]), method="Nelder-Mead").x)
    rate = {k: (s + a) / (n + a + b) for k, (s, n) in groups.items()}
    prior = a / (a + b)
    out = [[rate.get(k if isinstance(k, str) else "", prior) for k in ko] for ko in keywords_out]
    return [np.asarray(o) for o in out], dict(a=float(a), b=float(b), prior_strength=float(a + b))


# ------------------------------------------------------------- bag of words


def tfidf_nb(texts_tr, y_tr, texts_out):
    v = CountVectorizer(ngram_range=(1, 2), min_df=2)
    A = v.fit_transform(texts_tr)
    m = MultinomialNB(alpha=0.5).fit(A, y_tr)
    return [m.predict_proba(v.transform(t))[:, 1] for t in texts_out], {}


def tfidf_lr(texts_tr, y_tr, texts_out):
    A, outs = E.tfidf(texts_tr, texts_out)
    C = _best_C(A, y_tr)
    m = LogisticRegression(C=C, max_iter=5000).fit(A, y_tr)
    return [m.predict_proba(o)[:, 1] for o in outs], dict(C=C)


def tfidf_gbm(texts_tr, y_tr, texts_out, seed=0):
    import lightgbm as lgb

    A, outs = E.tfidf(texts_tr, texts_out)
    A = A.astype(np.float32)
    rng = np.random.default_rng(seed)
    idx = rng.permutation(A.shape[0])
    k = int(0.85 * len(idx))
    tr, va = idx[:k], idx[k:]
    m = lgb.LGBMClassifier(
        n_estimators=2000, learning_rate=0.03, num_leaves=15, min_child_samples=10,
        subsample=0.8, subsample_freq=1, colsample_bytree=0.5, reg_lambda=1.0,
        random_state=seed, verbose=-1,
    )
    m.fit(A[tr], y_tr[tr], eval_set=[(A[va], y_tr[va])], eval_metric="binary_logloss",
          callbacks=[lgb.early_stopping(100, verbose=False)])
    return [m.predict_proba(o.astype(np.float32))[:, 1] for o in outs], dict(trees=int(m.best_iteration_ or 0))


# ------------------------------------------------------------------- probes


def probe_lr(Z_tr, y_tr, Z_out, C=None):
    C = _best_C(Z_tr, y_tr) if C is None else C
    m = LogisticRegression(C=C, max_iter=10000).fit(Z_tr, y_tr)
    return [m.predict_proba(z)[:, 1] for z in Z_out], dict(C=float(C), w_norm=float(np.linalg.norm(m.coef_)),
                                                           train_acc=float(m.score(Z_tr, y_tr)))


def probe_wall(Z_tr, y_tr, Z_out):
    return probe_lr(Z_tr, y_tr, Z_out, C=1e4)


def probe_mlp(Z_tr, y_tr, Z_out, seed=0):
    m = MLPClassifier(hidden_layer_sizes=(64,), alpha=1e-3, early_stopping=True,
                      validation_fraction=0.15, max_iter=500, random_state=seed)
    m.fit(Z_tr, y_tr)
    return [m.predict_proba(z)[:, 1] for z in Z_out], dict(iters=int(m.n_iter_))


def tabpfn_available() -> bool:
    try:
        import tabpfn  # noqa: F401
        return True
    except Exception:
        return False


def probe_tabpfn(Z_tr, y_tr, Z_out, dim=128):
    from tabpfn import TabPFNClassifier

    m = TabPFNClassifier(random_state=0)
    m.fit(Z_tr[:, :dim], y_tr)
    return [m.predict_proba(z[:, :dim])[:, 1] for z in Z_out], dict(dim=dim)


def hard_wall_sweep(Z_tr, y_tr, Z_cal, y_cal, Z_te, y_te, grid=np.logspace(-3, 4, 15)):
    """The temperature a probe runs at, as a function of its L2 penalty.

    For each C: the weight norm (how steep the wall is), the training accuracy
    (how separable the rows look from inside), and the temperature a
    calibration map has to apply to fix it. T_fit > 1 means the head is running
    cold and the map is warming it back up.
    """
    from . import metrics as M
    from .recal import Temperature

    rows = []
    for C in grid:
        m = LogisticRegression(C=C, max_iter=20000).fit(Z_tr, y_tr)
        pc, pt = m.predict_proba(Z_cal)[:, 1], m.predict_proba(Z_te)[:, 1]
        T = Temperature().fit(pc, y_cal).T
        rows.append(dict(
            C=float(C), w_norm=float(np.linalg.norm(m.coef_)), train_acc=float(m.score(Z_tr, y_tr)),
            test_logloss=M.log_loss(pt, y_te), test_ece=M.ece(pt, y_te), test_auc=M.auc(pt, y_te),
            T_fit=float(T), mean_abs_logit=float(np.mean(np.abs(M.logit(pt)))),
        ))
    return rows
