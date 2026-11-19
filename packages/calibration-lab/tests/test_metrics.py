import numpy as np
import pytest

from lab import conformal, metrics, recal


def calibrated(n=20000, seed=0):
    rng = np.random.default_rng(seed)
    p = rng.beta(0.8, 1.2, n)
    y = (rng.random(n) < p).astype(float)
    return p, y


def cooled(p, T=0.5):
    return metrics.sigmoid(metrics.logit(p) / T)


def test_murphy_closes():
    p, y = calibrated()
    m = metrics.murphy(p, y)
    assert m.brier == pytest.approx(m.reliability - m.resolution + m.uncertainty + m.within_bin)
    assert m.reliability < 1e-3


def test_resolution_is_variance_for_calibrated():
    # for a calibrated forecaster resolution -> Var(p); binning loses a little
    p, y = calibrated()
    m = metrics.murphy(p, y, bins=50)
    assert m.resolution == pytest.approx(p.var(), rel=0.06)


def test_richardson_slope_half_when_calibrated():
    p, y = calibrated()
    r = metrics.richardson(p, y)
    assert 0.4 < r["slope"] < 0.6


def test_richardson_plateau_when_miscalibrated():
    p, y = calibrated()
    q = cooled(p)
    r = metrics.richardson(q, y)
    # coarse rulers see the real error; ECE at 10 bins well above its noise floor
    i = r["bins"].index(min(r["bins"], key=lambda b: abs(b - 10)))
    assert r["ece"][i] > 4 * r["noise_floor"][i]


def test_cumulative_null_and_alternative():
    p, y = calibrated()
    assert metrics.cumulative(p, y)["p_value"] > 0.01
    assert metrics.cumulative(cooled(p), y)["p_value"] < 1e-6


def test_smooth_ece_orders():
    p, y = calibrated(8000)
    a = metrics.smooth_ece(p, y)["smece"]
    b = metrics.smooth_ece(cooled(p, 0.5), y)["smece"]
    assert a < 0.02 < b


@pytest.mark.parametrize("name", ["temperature", "platt", "beta", "isotonic", "histogram", "venn-abers"])
def test_maps_repair_cooling(name):
    p, y = calibrated(6000, seed=1)
    q = cooled(p, 0.5)
    fit, test = slice(0, 3000), slice(3000, None)
    m = recal.MAPS[name]().fit(q[fit], y[fit])
    before = metrics.ece(q[test], y[test])
    after = metrics.ece(m.predict(q[test]), y[test])
    assert after < before / 2


def test_temperature_recovers_T():
    p, y = calibrated(40000, seed=2)
    m = recal.Temperature().fit(cooled(p, 0.5), y)
    assert m.T == pytest.approx(2.0, rel=0.08)


def test_venn_abers_interval_brackets():
    p, y = calibrated(2000, seed=3)
    va = recal.VennAbers().fit(p[:1000], y[:1000])
    p0, p1 = va.interval(p[1000:1100])
    assert np.all(p0 <= p1 + 1e-12)
    assert np.mean(p1 - p0) < 0.05


def test_split_conformal_coverage():
    p, y = calibrated(20000, seed=4)
    q = cooled(p, 0.4)  # miscalibrated on purpose: coverage must hold anyway
    has0, has1, _ = conformal.split_sets(q[:5000], y[:5000], q[5000:], alpha=0.1)
    rep = conformal.report(has0, has1, y[5000:])
    assert rep["coverage"] == pytest.approx(0.9, abs=0.015)


def test_mondrian_per_class_coverage():
    p, y = calibrated(20000, seed=5)
    has0, has1, _ = conformal.mondrian(p[:8000], y[:8000], p[8000:], alpha=0.1)
    rep = conformal.report(has0, has1, y[8000:])
    assert rep["coverage_pos"] == pytest.approx(0.9, abs=0.02)
    assert rep["coverage_neg"] == pytest.approx(0.9, abs=0.02)


def test_labels_needed():
    assert metrics.labels_needed(0.05, 0.5) == 385
