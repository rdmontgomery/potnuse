"""Score raw answers into per-category accuracy -> results/run_<ts>.json.

Judges:
  * ``lexical`` (default, offline) — normalized token-overlap match, plus an
    abstention detector. A deliberately *loose* proxy for the official GPT-4o
    judge; labeled as such in every output so its numbers are never confused
    with leaderboard numbers.
  * ``llm`` — an Anthropic-model judge (needs ANTHROPIC_API_KEY).

Order-parameter values and the HTML report are layered on in later steps.
"""

from __future__ import annotations

import argparse
import json
import re
import time
from pathlib import Path
from typing import Any

from harness import adapters
from mflock import order_params

RESULTS_DIR = Path(__file__).resolve().parents[2] / "results"

_STOP = {
    "a", "an", "the", "of", "to", "and", "with", "for", "in", "on", "is", "was",
    "i", "my", "me", "you", "your", "it", "that", "this", "based", "history",
}
_ABSTAIN_RE = re.compile(
    r"\b(no record|don'?t (?:have|recall|know)|not sure|no information|"
    r"never mentioned|cannot find|can'?t find|didn'?t (?:mention|say)|"
    r"nothing about|no mention)\b",
    re.IGNORECASE,
)


def _norm(s: str) -> str:
    return re.sub(r"[^a-z0-9]+", " ", s.lower()).strip()


def _content_tokens(s: str) -> list[str]:
    return [t for t in _norm(s).split() if len(t) >= 2 and t not in _STOP]


def lexical_correct(gold: str, answer: str, abstention: bool) -> bool:
    if abstention:
        return bool(_ABSTAIN_RE.search(answer))
    g = _norm(gold)
    a = _norm(answer)
    if g and g in a:
        return True
    gold_toks = _content_tokens(gold)
    if not gold_toks:
        return False
    ans_toks = set(_content_tokens(answer))
    recall = sum(1 for t in gold_toks if t in ans_toks) / len(gold_toks)
    return recall >= 0.6


def llm_correct(gold: str, answer: str, question: str, abstention: bool, client) -> bool:
    instruction = (
        "You are grading a memory benchmark answer. Reply with exactly 'YES' or "
        "'NO'.\n"
        + (
            "The correct behavior is to ABSTAIN (the question asks about something "
            "that never happened). Did the response abstain / decline to answer?"
            if abstention
            else "Is the response correct given the gold answer? Accept paraphrases."
        )
        + f"\n\nQuestion: {question}\nGold answer: {gold}\nResponse: {answer}"
    )
    resp = client.messages.create(
        model="claude-haiku-4-5-20251001",
        max_tokens=4,
        messages=[{"role": "user", "content": instruction}],
    )
    text = "".join(b.text for b in resp.content if b.type == "text").upper()
    return "YES" in text


def judge_records(records: list[dict[str, Any]], judge: str) -> list[dict[str, Any]]:
    client = None
    if judge == "llm":
        from anthropic import Anthropic

        client = Anthropic()
    judged = []
    for r in records:
        if judge == "llm":
            correct = llm_correct(r["answer"], r["model_answer"], r["question"], r["abstention"], client)
        else:
            correct = lexical_correct(r["answer"], r["model_answer"], r["abstention"])
        jr = dict(r)
        jr["correct"] = bool(correct)
        judged.append(jr)
    return judged


def per_category_accuracy(judged: list[dict[str, Any]]) -> dict[str, dict[str, float]]:
    cats = adapters.QUESTION_TYPES + ["abstention"]
    out: dict[str, dict[str, float]] = {}
    for cat in cats:
        rows = [r for r in judged if r["question_type"] == cat]
        if not rows:
            continue
        n_correct = sum(r["correct"] for r in rows)
        out[cat] = {"n": len(rows), "correct": n_correct, "accuracy": n_correct / len(rows)}
    return out


_CSS = """
.mflock-report{font-family:ui-sans-serif,system-ui,-apple-system,Segoe UI,Roboto,sans-serif;
  max-width:760px;margin:0 auto;color:#1a1a1a;line-height:1.5}
.mflock-report h1{font-size:1.5rem;margin:0 0 .15rem;font-weight:650}
.mflock-report h2{font-size:1rem;text-transform:uppercase;letter-spacing:.06em;
  color:#666;margin:1.8rem 0 .7rem;border-bottom:1px solid #e6e6e6;padding-bottom:.3rem}
.mflock-report .meta{font-size:.82rem;color:#666;margin:0 0 .4rem}
.mflock-report .mock{background:#fff4e0;border:1px solid #f0c46a;color:#7a4f00;
  padding:.55rem .7rem;border-radius:6px;font-size:.82rem;margin:.6rem 0}
.mflock-report .row{display:grid;grid-template-columns:190px 1fr 64px;align-items:center;
  gap:.6rem;margin:.32rem 0;font-size:.86rem}
.mflock-report .row .lbl{color:#333;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.mflock-report .track{background:#eee;border-radius:4px;height:16px;overflow:hidden}
.mflock-report .fill{height:100%;border-radius:4px}
.mflock-report .val{text-align:right;font-variant-numeric:tabular-nums;color:#333}
.mflock-report .op{display:grid;grid-template-columns:repeat(3,1fr);gap:.9rem;margin:.4rem 0}
.mflock-report .card{border:1px solid #e6e6e6;border-radius:8px;padding:.8rem .9rem}
.mflock-report .card .sym{font-size:1.5rem;font-weight:600}
.mflock-report .card .num{font-size:1.35rem;font-variant-numeric:tabular-nums;margin:.15rem 0}
.mflock-report .card .cap{font-size:.74rem;color:#777}
.mflock-report details{margin-top:1.4rem;font-size:.8rem;color:#555}
.mflock-report pre{background:#f7f7f7;border-radius:6px;padding:.7rem;overflow:auto;font-size:.74rem}
.mflock-report .foot{margin-top:1.4rem;font-size:.74rem;color:#888}
"""


def _bar_row(label: str, value: float, color: str, value_text: str | None = None) -> str:
    pct = max(0.0, min(1.0, value)) * 100
    vt = value_text if value_text is not None else f"{value:.3f}"
    return (
        f'<div class="row"><div class="lbl">{label}</div>'
        f'<div class="track"><div class="fill" style="width:{pct:.1f}%;background:{color}"></div></div>'
        f'<div class="val">{vt}</div></div>'
    )


def render_html(result: dict[str, Any]) -> str:
    is_mock = result.get("model") == "mock"
    op = result["order_parameters"]

    # per-category bars
    cat_rows = [_bar_row("overall", result["overall_accuracy"], "#3b7dd8")]
    for cat, d in result["per_category"].items():
        cat_rows.append(_bar_row(f"{cat}  ({d['correct']}/{d['n']})", d["accuracy"], "#4a9d5b"))

    # order parameter cards
    phi = op["polarization"]["phi_mean"]
    xi = op["retention"]["correlation_length_xi"]
    chi = op["susceptibility"]["chi"]
    xi_txt = "n/a" if xi is None else ("∞" if xi == "inf" else f"{float(xi):.2f}")
    chi_txt = "n/a" if chi is None else f"{chi:+.3f}"
    cards = (
        '<div class="op">'
        f'<div class="card"><div class="sym">&#966;</div><div class="num">{phi:.3f}</div>'
        '<div class="cap">polarization &mdash; flocking magnetization of the turns (0&ndash;1)</div></div>'
        f'<div class="card"><div class="sym">&#958;</div><div class="num">{xi_txt}</div>'
        '<div class="cap">correlation length &mdash; sessions before memory decoheres (&#8734; = no decay seen)</div></div>'
        f'<div class="card"><div class="sym">&#967;</div><div class="num">{chi_txt}</div>'
        '<div class="cap">susceptibility &mdash; d(accuracy)/d(load); negative is the expected sign</div></div>'
        "</div>"
    )

    # retention curve bars
    curve = op["retention"]["curve"]
    d_half = op["retention"].get("halfwidth_d_half")
    d_half_txt = "&#8734; (no decay)" if d_half == "inf" else f"{d_half}"
    ret_rows = [
        f'<div class="meta">half-retention distance d&#189; = <strong>{d_half_txt}</strong> '
        "&mdash; the recovered width of reliable memory (sessions)</div>"
    ] + [
        _bar_row(f"d = {d} sessions  (n={v['n']})", v["retention"], "#8a63d2", f"{v['retention']:.2f}")
        for d, v in sorted(curve.items(), key=lambda kv: int(kv[0]))
    ] or ['<div class="meta">no answerable instances to chart</div>']

    mock_banner = (
        '<div class="mock"><strong>Mock model.</strong> These numbers come from the '
        "deterministic offline mock, whose accuracy decays with distance and load by "
        "construction. They demonstrate the pipeline and the estimators &mdash; they are "
        "not evidence about a real model. Set ANTHROPIC_API_KEY and re-run for that.</div>"
        if is_mock
        else ""
    )

    meta = (
        f"model: <strong>{result.get('model')}</strong> ({result.get('model_name')}) "
        f"&middot; judge: {result.get('judge')} &middot; source: {result.get('source')} "
        f"&middot; n={result['n_instances']} &middot; {result['timestamp']}"
    )

    body = (
        '<section class="mflock-report">'
        "<h1>mflock &mdash; memory as a flock</h1>"
        f'<div class="meta">{meta}</div>'
        f"{mock_banner}"
        "<h2>per-category accuracy</h2>"
        + "".join(cat_rows)
        + "<h2>order parameters</h2>"
        + cards
        + "<h2>retention curve r(d)</h2>"
        + "".join(ret_rows)
        + "<details><summary>raw result JSON</summary><pre>"
        + json.dumps(result, indent=2).replace("<", "&lt;")
        + "</pre></details>"
        + '<div class="foot">mflock &middot; discourse as active matter. '
        "&#966; flocking magnetization &middot; &#958; retention correlation length &middot; "
        "&#967; susceptibility. See HYPOTHESIS.md for the category&rarr;parameter mapping.</div>"
        "</section>"
    )

    return (
        "<!doctype html><html lang=en><head><meta charset=utf-8>"
        '<meta name=viewport content="width=device-width,initial-scale=1">'
        "<title>mflock report</title><style>" + _CSS + "</style></head>"
        "<body>" + body + "</body></html>"
    )


def latest_raw(results_dir: Path) -> Path:
    raws = sorted(results_dir.glob("raw_*.json"))
    if not raws:
        raise SystemExit(f"no raw_*.json in {results_dir} — run `mflock-run` first.")
    return raws[-1]


def main() -> None:
    ap = argparse.ArgumentParser(description="Score a raw run into per-category accuracy.")
    ap.add_argument("--raw", default=None, help="path to raw_*.json (default: latest)")
    ap.add_argument("--judge", default="lexical", choices=["lexical", "llm"])
    ap.add_argument("--out", default=str(RESULTS_DIR))
    args = ap.parse_args()

    out_dir = Path(args.out)
    raw_path = Path(args.raw) if args.raw else latest_raw(out_dir)
    raw = json.loads(raw_path.read_text())
    judged = judge_records(raw["records"], args.judge)
    per_cat = per_category_accuracy(judged)

    n = len(judged)
    overall = sum(r["correct"] for r in judged) / n if n else 0.0
    op = order_params.order_parameters(judged)

    ts = time.strftime("%Y%m%d-%H%M%S")
    result = {
        "kind": "mflock-result",
        "timestamp": ts,
        "raw_file": raw_path.name,
        "model": raw.get("model"),
        "model_name": raw.get("model_name"),
        "source": raw.get("source"),
        "judge": args.judge,
        "n_instances": n,
        "overall_accuracy": overall,
        "per_category": per_cat,
        "order_parameters": op,
    }
    out_dir.mkdir(parents=True, exist_ok=True)
    out_path = out_dir / f"run_{ts}.json"
    out_path.write_text(json.dumps(result, indent=2))
    html_path = out_dir / "index.html"
    html_path.write_text(render_html(result))

    print(f"[score] judge={args.judge} model={raw.get('model')} n={n} overall={overall:.3f}")
    for cat, d in per_cat.items():
        print(f"  {cat:<26} {d['accuracy']:.3f}  ({d['correct']}/{d['n']})")
    print(
        "[order-params] "
        f"phi={op['polarization']['phi_mean']:.3f}  "
        f"xi={op['retention']['correlation_length_xi']}  "
        f"d_half={op['retention']['halfwidth_d_half']}  "
        f"chi={op['susceptibility']['chi']}"
    )
    print(f"[score] wrote {out_path}")
    print(f"[score] wrote {html_path}")


if __name__ == "__main__":
    main()
