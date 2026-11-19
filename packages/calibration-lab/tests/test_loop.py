import numpy as np
import pandas as pd

from lab import data, hitl, synth


def test_synth_matches_kaggle_schema(tmp_path):
    synth.write(tmp_path, n=600, seed=3)
    df = pd.read_csv(tmp_path / "train.csv")
    assert list(df.columns) == ["id", "keyword", "location", "text", "target"]
    assert df["id"].is_unique and df["target"].isin([0, 1]).all()
    t = pd.read_csv(tmp_path / "truth.csv")
    assert ((t.p_true > 0) & (t.p_true < 1)).all()
    ds = data.load(tmp_path / "train.csv")
    assert ds.truth is not None and len(ds.texts) == 600


def _stream(seed=0, nb=12, n=150):
    rng = np.random.default_rng(seed)
    t = [rng.beta(1, 1.3, n) for _ in range(nb)]
    y = [(rng.random(n) < ti).astype(int) for ti in t]
    raw = [np.clip(ti + rng.normal(0, 0.05, n), 0.01, 0.99) for ti in t]
    lt = rng.beta(1, 1.3, 300)
    return raw, y, t, np.clip(lt, 0.01, 0.99), (rng.random(300) < lt).astype(int)


def test_flagged_only_never_sees_a_miss():
    raw, y, t, lr, ly = _stream()
    r = hitl.run_policy("flagged", raw, y, t, lr, ly, budget=30)
    assert np.nansum(r.est_missed) == 0
    assert np.nansum(r.true_missed) > 0


def test_weighted_audit_is_unbiased_for_misses():
    est, true = [], []
    for s in range(30):
        raw, y, t, lr, ly = _stream(seed=s)
        r = hitl.run_policy("stratified", raw, y, t, lr, ly, budget=30, seed=s)
        est.append(np.nanmean(r.est_missed))
        true.append(np.nanmean(r.true_missed))
    assert abs(np.mean(est) - np.mean(true)) < 0.15 * np.mean(true)


def test_stream_ramps_to_peak():
    dry, wet = np.arange(0, 2000), np.arange(2000, 2600)
    b = hitl.build_stream(dry, wet, n_batches=20, batch=100, onset=0.3, peak=0.6)
    share = [np.mean(x >= 2000) for x in b]
    assert share[0] == 0 and abs(share[-1] - 0.6) < 0.02
