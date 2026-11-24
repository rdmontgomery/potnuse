import numpy as np

from lab import honesty as H
from lab import metrics as M


def stream(n, seed, a_true=0.6, b_true=-0.4):
    """Jev-like answers that run loud and high: the truth is
    sigmoid(0.6 * logit(noul) - 0.4), so the right map is (0.6, -0.4)."""
    rng = np.random.default_rng(seed)
    z = rng.normal(0.5, 2.5, n)
    noul = H.sigmoid(z)
    y = (rng.random(n) < H.sigmoid(a_true * z + b_true)).astype(int)
    return noul, y


def test_platt_recovers_the_bend_and_repairs_calibration():
    noul, y = stream(20000, 0)
    m = H.fit_map(noul[:10000], y[:10000])
    assert abs(m["a"] - 0.6) < 0.05 and abs(m["b"] + 0.4) < 0.08
    raw = M.ece(noul[10000:], y[10000:])
    fixed = M.ece(H.apply_map(m, noul[10000:]), y[10000:])
    assert fixed < raw / 3


def test_gate_ships_a_better_map_and_refuses_identity():
    noul, y = stream(4000, 1)
    m = H.fit_map(noul[:3000], y[:3000])
    ship, scores = H.should_ship(m, H.IDENTITY, noul[3000:], y[3000:])
    assert ship and scores["new"] < scores["current"]


def test_intercept_only_fixes_a_pure_shift():
    noul, y = stream(20000, 2, a_true=1.0, b_true=-0.8)
    m = H.fit_map(noul, y, kind="intercept")
    assert abs(m["b"] + 0.8) < 0.08


def test_choice_temperature():
    rng = np.random.default_rng(3)
    logits = rng.normal(0, 2, (8000, 4))
    true = np.exp(logits) / np.exp(logits).sum(1, keepdims=True)
    y = np.array([rng.choice(4, p=p) for p in true])
    loud = np.exp(logits / 0.5)
    loud /= loud.sum(1, keepdims=True)
    T = H.fit_temperature(loud, y)
    assert abs(T - 2.0) < 0.15
