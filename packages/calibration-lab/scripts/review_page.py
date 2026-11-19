"""Build the figure-review artifact: every candidate figure, the line it would
carry on a slide, a note to Rick on what it shows and where it's weak, and a
place for his critique (saved to the artifact's db, collection `critiques`).

    python3 scripts/review_page.py out.html
"""

from __future__ import annotations

import html
import json
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[3]
HAZE = ROOT / "apps/site/src/components/haze"
CAL = ROOT / "apps/site/src/components/calibration"
N = json.loads((HAZE / "numbers.json").read_text())


def svg(path: Path) -> str:
    s = path.read_text()
    return re.search(r"<svg.*?</svg>", s, re.S).group(0)


L, C, lp = N["ladder"], N["conformal"], N["loop"]
nb = L["tfidf_nb"]
seg = lp.get("stratified-window6-segmented", {})

TABLE = f"""<div class="tablewrap"><table class="tab">
<thead><tr><th>model</th><th>ECE</th><th>coverage</th><th>on real disasters</th><th>per class (Mondrian)</th></tr></thead>
<tbody>
<tr><td>naive Bayes</td><td>{C['tfidf_nb']['ece']:.3f}</td><td>{C['tfidf_nb']['split']['coverage']:.0%}</td><td>{C['tfidf_nb']['split']['coverage_pos']:.0%}</td><td>{C['tfidf_nb']['mondrian']['coverage_pos']:.0%}</td></tr>
<tr><td>keyword rates</td><td>{C['keyword_eb']['ece']:.3f}</td><td>{C['keyword_eb']['split']['coverage']:.0%}</td><td class="hot">{C['keyword_eb']['split']['coverage_pos']:.0%}</td><td>{C['keyword_eb']['mondrian']['coverage_pos']:.0%}</td></tr>
<tr><td>probe</td><td>{C['probe_lr']['ece']:.3f}</td><td>{C['probe_lr']['split']['coverage']:.0%}</td><td>{C['probe_lr']['split']['coverage_pos']:.0%}</td><td>{C['probe_lr']['mondrian']['coverage_pos']:.0%}</td></tr>
</tbody></table></div>"""

FIGS = [
    dict(
        id="two-axes", name="Honesty is not knowledge", art=svg(HAZE / "TwoAxes.astro"),
        caption="Every model on Murphy's two axes: how dishonest against how much it knows. Down and to the right is better.",
        shows=(f"Reliability (log scale) against resolution for the whole ladder. Keyword rates are honest and know almost nothing "
               f"(AUC {L['keyword_eb']['auc']:.2f}). Naive Bayes knows a lot and lies about it. Everything else piles up bottom right."),
        story="The thesis picture: calibration and accuracy are separate axes, so a model can be good at one and bad at the other.",
        doubt="The interesting models are crammed into one corner and you have to hover to tell them apart. Real data with Gemma may spread them out, or may not.",
    ),
    dict(
        id="reliability", name="Two numbers fix naive Bayes", art=svg(HAZE / "Reliability.astro"),
        caption=f"Naive Bayes pins its forecasts to the corners (ECE {nb['ece10']:.3f}). Platt scaling, two fitted numbers, brings it back to the diagonal without changing one ranking.",
        shows="The standard reliability diagram: what the model claimed against how often it happened, ten bins with 95% intervals. Naive Bayes raw, naive Bayes after Platt, and the linear probe.",
        story="The 'a monotone map buys honesty, not knowledge' beat. It's also where logistic regression's free calibration comes in.",
        doubt="It's the most familiar chart in the field. A technical room has seen it many times; a mixed room needs it once.",
    ),
    dict(
        id="temperature", name="Confidence has a temperature", art=svg(CAL / "Temperature.astro"),
        caption="The same belief at three temperatures: 0.8 comes out as 0.94, 0.80 or 0.64, and no ranking moves.",
        shows=f"Reused from your 'confidence has a temperature' post: reported probability against believed probability at T = 0.5, 1 and 2.5. On the tweets, naive Bayes fits T = {nb['T_fit']:.1f}.",
        story="The Boltzmann bridge, softmax as a Gibbs distribution. This is where the physics gives the room a picture their CS training doesn't.",
        doubt="It isn't drawn from the tweets, so it reads as theory. It might be stronger paired with the naive Bayes T on the same slide.",
    ),
    dict(
        id="cover", name="The hyperplane always exists", art=svg(HAZE / "Cover.astro"),
        caption="Below about two labels per dimension the head separates its training set, the weights run off to infinity, and every probability slams into 0 or 1.",
        shows=(f"Test ECE against labels per dimension (n/d) on the {N['cover']['d']}-d embedding, for a head with no penalty (hard wall) and with an L2 penalty (soft wall). "
               "The shaded region is where the training labels were separable."),
        story="It answers your 'find the separating hyperplane, then calibrate it' idea directly. Cover 1965 and Gardner's capacity of 2 give you a real phase transition, not a metaphor.",
        doubt="n/d is an unfamiliar x-axis. The hard wall stays bad until about n/d = 6, past the separable region, because nearly separable data behaves almost the same way. That needs a sentence.",
    ),
    dict(
        id="ruler", name="The error depends on the ruler", art=svg(HAZE / "Ruler.astro"),
        caption=f"A perfectly calibrated model's ECE grows like the square root of the bin count (slope {N['richardson']['null']['slope']:.2f}): a coastline of dimension 1.5.",
        shows="Binned ECE against number of bins, log-log. Blue is calibrated by construction, amber is the probe after Platt, rose is naive Bayes, whose real error is a flat plateau above the noise.",
        story="Your fractals-and-rulers idea, and it's exact: the null walk is Brownian. This is the most original chart in the set.",
        doubt="A log-log plot loses people. It probably needs the coastline picture (Richardson, Britain) before it, or one sentence that does that job.",
    ),
    dict(
        id="walk", name="Measure the excursion, not the length", art=svg(HAZE / "Walk.astro"),
        caption="Sort by forecast and keep a running sum of outcome minus forecast. An honest model stays inside the Brownian band; naive Bayes leaves it immediately.",
        shows="The cumulative-difference walk for three forecasters with the 95% envelope of a Brownian excursion. KS on this walk is the binning-free test.",
        story="It resolves the ruler problem, and it's the natural place for the magnetoconductance story: read the noise's dimension, then look for what isn't noise.",
        doubt="It's a second measurement chart in a 15-minute talk. It could merge with the ruler, or replace it.",
    ),
    dict(
        id="labels", name="How many labels", art=svg(HAZE / "Labels.astro"),
        caption="Repairing a bent model: one parameter wins with few labels, and the flexible maps need hundreds before they stop fitting noise.",
        shows=f"Test ECE after repair against labels used, for temperature, Platt, isotonic and Venn-Abers, on a probe deliberately cooled and shifted. The formula behind it: {N['labels_needed']['0.05']} labels per bin to see a 5-point gap.",
        story="The budget conversation: 1/δ². It's the practical slide for anyone running a labeling team.",
        doubt="It's the least visual of the set. A single big number (385 labels to see 5 points) might beat the chart.",
    ),
    dict(
        id="conformal", name="Coverage is not calibration", art=TABLE,
        caption=f"Conformal coverage holds for the worst-calibrated model. The best-calibrated one covers real disasters only {C['keyword_eb']['split']['coverage_pos']:.0%} of the time until each class gets its own threshold.",
        shows="Split conformal at 90% for three models: overall coverage, coverage on real disasters, and the per-class (Mondrian) fix.",
        story="It replaces the 'conformal mapping' framing with the real distinction: coverage is about sets and is marginal; calibration is about probabilities at every level.",
        doubt="It's a table. As a chart it could be paired bars per model, but the single red cell may already be enough.",
    ),
    dict(
        id="drift", name="The storm", art=svg(HAZE / "Drift.astro"),
        caption=f"Same model, same map, new vocabulary: water tweets lift off the diagonal (ECE {N['drift']['dry_ece']:.3f} dry, {N['drift']['wet_ece']:.3f} wet).",
        shows="Reliability on held-out dry tweets against tweets with water keywords the model never trained on.",
        story="The bridge from measurement to the loop: exchangeability fails, and so does every guarantee built on it.",
        doubt="The effect is modest on synthetic data. With Gemma it may shrink further (prediction 6 in the notes), which would itself be the story: pretrained semantics transfer to unseen keywords.",
    ),
    dict(
        id="loop", name="Who you label decides what you can know", art=svg(HAZE / "Loop.astro"),
        caption="Label only what you flagged and you report zero misses. Forever.",
        shows=(f"Missed disasters per batch during the storm: actual (about {lp['stratified']['missed']:.0f}), and what three labeling policies estimate from the same budget. "
               f"Flagged-only reports {lp['flagged']['est_missed']:.0f}; near-threshold {lp['uncertainty']['est_missed']:.0f}; a 20% weighted audit {lp['stratified']['est_missed']:.0f}."),
        story="The strongest operational punchline. It's the one people will take back to work.",
        doubt="The point is a line sitting flat at zero, which is visually dull. It may need an annotation, or a reveal where the actual line appears second.",
    ),
    dict(
        id="forget", name="Forget, and segment", art=svg(HAZE / "Forget.astro"),
        caption="Refit, forget, segment: each knob fixes one mistake, and together they end about four times closer to the truth than the frozen map.",
        shows=(f"Error against the true probabilities over the stream for four ways of running the loop. Late in the storm: frozen {lp['frozen'].get('true_mse') or 0:.3f}, "
               f"windowed per-family maps {seg.get('true_mse') or 0:.3f}."),
        story="Memory: a map fitted in the calm is a claim about the calm. It connects to your memory research, if you want that easter egg.",
        doubt="Four lines is a lot, and error against the truth exists only on synthetic data. On the real file it becomes a noisier Brier curve.",
    ),
    dict(
        id="matryoshka", name="Dimensions cost knowledge", art=svg(HAZE / "Matryoshka.astro"),
        caption="Every embedding dimension dropped costs knowledge no calibration map can buy back.",
        shows="Brier after Platt against embedding dimensions kept (Matryoshka truncation).",
        story="It's weak on its own: monotone and expected.",
        doubt="Probably cut, unless the EmbeddingGemma task-prefix chart (empty until the real run) goes beside it as one slide about what the encoder contributes.",
    ),
]

FIG_CSS = """
.fig { width: 100%; height: auto; display: block; }
.fig text { font-family: var(--mono); fill: var(--ink-2); }
.fig .tick { font-size: 12px; }
.fig .label { font-size: 12.5px; fill: var(--ink-3); }
.fig .mid { text-anchor: middle; }
.fig .end { text-anchor: end; }
.fig .grid { stroke: var(--line); stroke-width: 1; }
.fig .axis { stroke: var(--line); stroke-width: 1.5; }
.fig .ref { stroke: var(--ink-3); stroke-width: 1.5; stroke-dasharray: 4 4; fill: none; }
.fig .series { fill: none; stroke-width: 2; stroke-linecap: round; stroke-linejoin: round; }
.fig .key { font-size: 12.5px; fill: var(--ink); }
.fig .note { font-size: 11.5px; fill: var(--ink-3); }
.fig .big { font-size: 13px; fill: var(--ink); }
"""


def card(f, i):
    e = html.escape
    return f"""
<article class="card" data-fig="{f['id']}" id="{f['id']}">
  <header class="card-head">
    <p class="idx">{i:02d}</p>
    <h2>{e(f['name'])}</h2>
    <div class="verdict" role="group" aria-label="verdict for {e(f['name'])}">
      <button type="button" data-v="keep" aria-pressed="false">keep</button>
      <button type="button" data-v="maybe" aria-pressed="false">maybe</button>
      <button type="button" data-v="cut" aria-pressed="false">cut</button>
    </div>
  </header>
  <div class="body">
    <figure class="art">{f['art']}<figcaption>{e(f['caption'])}</figcaption></figure>
    <div class="side">
      <dl>
        <dt>what it shows</dt><dd>{e(f['shows'])}</dd>
        <dt>the story it could carry</dt><dd>{e(f['story'])}</dd>
        <dt>where I'm unsure</dt><dd>{e(f['doubt'])}</dd>
      </dl>
      <label class="crit" for="c-{f['id']}">your critique</label>
      <textarea id="c-{f['id']}" rows="5" placeholder="What does this say to the room? Keep, cut, rewrite the line, change the chart..."></textarea>
      <p class="status" data-status aria-live="polite"></p>
    </div>
  </div>
</article>"""


def page() -> str:
    m = N["meta"]
    data_note = ("synthetic stand-in for Disaster Tweets, with a known true probability per row" if m["has_truth"]
                 else "Kaggle's Disaster Tweets")
    cards = "\n".join(card(f, i + 1) for i, f in enumerate(FIGS))
    return f"""<title>Haze talk figures</title>
<meta name="claude:viewport-fit-sides" content="cover">
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Crimson+Pro:ital,wght@0,400..700;1,400..600&family=JetBrains+Mono:wght@400;500&display=swap">
<style>
/* layout: one long review sheet; each figure a card with the chart left and the argument and critique box right, stacking on phones.
   palette: the site's whiteprint by day and blueprint by night, so figures look as they will in the deck. */
:root {{
  --bg: #f3f5f7; --card: #e7ecf1; --ink: #12284a; --ink-2: #2f4a72; --ink-3: #4a6186; --line: #c3cfdc; --accent: #b0461a;
  --viz-amber: #8a5a00; --viz-rose: #b0461a; --viz-blue: #1f5cbf; --field: #ffffff;
  --text: var(--ink); --text-dim: var(--ink-2); --text-muted: var(--ink-3); --border: var(--line); --bg-card: var(--card);
  --serif: 'Crimson Pro', Georgia, 'Iowan Old Style', serif; --mono: 'JetBrains Mono', ui-monospace, 'SF Mono', Menlo, monospace;
  --font-jetbrains: var(--mono);
}}
@media (prefers-color-scheme: dark) {{ :root:not([data-theme="light"]) {{
  --bg: #0f2238; --card: #15304d; --ink: #eef2f5; --ink-2: #b3c3d3; --ink-3: #8fa4ba; --line: #25476b; --accent: #f08a4b;
  --viz-amber: #f2b84b; --viz-rose: #f07a5a; --viz-blue: #8fc9ff; --field: #0f2238; color-scheme: dark; }} }}
:root[data-theme="dark"] {{
  --bg: #0f2238; --card: #15304d; --ink: #eef2f5; --ink-2: #b3c3d3; --ink-3: #8fa4ba; --line: #25476b; --accent: #f08a4b;
  --viz-amber: #f2b84b; --viz-rose: #f07a5a; --viz-blue: #8fc9ff; --field: #0f2238; color-scheme: dark; }}
body {{ background: var(--bg); color: var(--ink); font-family: var(--serif); font-size: 18px; line-height: 1.5; }}
main {{ max-width: 1180px; margin: 0 auto; padding-block: 40px 80px;
  padding-left: max(16px, env(safe-area-inset-left, 0px)); padding-right: max(16px, env(safe-area-inset-right, 0px));
  display: flex; flex-direction: column; gap: 28px; }}
.kicker {{ font-family: var(--mono); font-size: 13px; letter-spacing: .06em; color: var(--accent); margin: 0; }}
h1 {{ font-size: clamp(34px, 5vw, 52px); font-weight: 500; line-height: 1.05; margin: 6px 0 10px; text-wrap: balance; }}
.intro p {{ margin: 0 0 10px; max-width: 66ch; color: var(--ink-2); }}
.overall {{ display: flex; flex-direction: column; gap: 8px; }}
.card {{ border-top: 1.5px solid var(--line); padding-top: 18px; display: flex; flex-direction: column; gap: 14px; }}
.card-head {{ display: flex; align-items: baseline; gap: 14px; flex-wrap: wrap; }}
.idx {{ font-family: var(--mono); font-size: 13px; color: var(--ink-3); margin: 0; font-variant-numeric: tabular-nums; }}
.card h2 {{ font-size: 28px; font-weight: 500; margin: 0; flex: 1 1 auto; text-wrap: balance; }}
.verdict {{ display: flex; gap: 6px; }}
.verdict button {{ font-family: var(--mono); font-size: 13px; padding: 4px 12px; border-radius: 999px; border: 1px solid var(--line);
  background: transparent; color: var(--ink-2); cursor: pointer; }}
.verdict button:hover {{ border-color: var(--ink-3); }}
.verdict button[aria-pressed="true"][data-v="keep"] {{ background: var(--viz-amber); border-color: var(--viz-amber); color: var(--bg); }}
.verdict button[aria-pressed="true"][data-v="maybe"] {{ background: var(--viz-blue); border-color: var(--viz-blue); color: var(--bg); }}
.verdict button[aria-pressed="true"][data-v="cut"] {{ background: var(--viz-rose); border-color: var(--viz-rose); color: var(--bg); }}
button:focus-visible, textarea:focus-visible {{ outline: 2px solid var(--accent); outline-offset: 2px; }}
.body {{ display: grid; grid-template-columns: minmax(0, 1.35fr) minmax(0, 1fr); gap: 28px; align-items: start; }}
.art {{ margin: 0; min-width: 0; }}
.art figcaption {{ font-size: 19px; line-height: 1.4; margin-top: 10px; color: var(--ink); font-style: italic; }}
.side {{ min-width: 0; display: flex; flex-direction: column; gap: 10px; }}
dl {{ margin: 0; display: flex; flex-direction: column; gap: 4px; }}
dt {{ font-family: var(--mono); font-size: 12px; letter-spacing: .05em; color: var(--ink-3); margin-top: 6px; }}
dd {{ margin: 0; font-size: 17px; color: var(--ink-2); }}
.crit {{ font-family: var(--mono); font-size: 12px; letter-spacing: .05em; color: var(--accent); margin-top: 8px; }}
textarea {{ width: 100%; box-sizing: border-box; font: inherit; font-size: 17px; line-height: 1.45; color: var(--ink);
  background: var(--field); border: 1px solid var(--line); border-radius: 6px; padding: 10px 12px; resize: vertical; }}
.status {{ font-family: var(--mono); font-size: 12px; color: var(--ink-3); margin: 0; min-height: 1.2em; }}
.tablewrap {{ overflow-x: auto; }}
.tab {{ border-collapse: collapse; font-size: 17px; width: 100%; }}
.tab th {{ font-family: var(--mono); font-size: 12px; font-weight: 400; color: var(--ink-3); text-align: right; padding: 6px 10px; border-bottom: 1px solid var(--line); }}
.tab td {{ padding: 8px 10px; text-align: right; font-variant-numeric: tabular-nums; border-bottom: 1px solid var(--line); }}
.tab th:first-child, .tab td:first-child {{ text-align: left; }}
.tab td.hot {{ color: var(--viz-rose); font-weight: 600; }}
@media (max-width: 820px) {{ .body {{ grid-template-columns: minmax(0, 1fr); }} }}
{FIG_CSS}
</style>
<main>
  <section class="intro">
    <p class="kicker">enjoy your logits! · the haze · figure review</p>
    <h1>Which charts tell the story?</h1>
    <p>Every chart I think could carry a beat of the talk, from the overnight run on the {data_note}. Under each one: the line I'd put on the slide, what it shows, the story it could carry, and where I'm unsure.</p>
    <p>Tag each one keep, maybe or cut, and write into the box. Everything saves as you type and I can read it back, so critique piecemeal and come back. The order is only my first guess. The EmbeddingGemma task-prefix chart is missing until the real run.</p>
  </section>
  <section class="overall card" data-fig="overall" id="overall">
    <label class="crit" for="c-overall">the story overall: arc, order, what's missing</label>
    <textarea id="c-overall" rows="4" placeholder="Opening image, the turn, the close..."></textarea>
    <p class="status" data-status aria-live="polite"></p>
  </section>
  {cards}
</main>
<script>
(() => {{
  const cards = Array.from(document.querySelectorAll('[data-fig]'));
  const state = {{}};
  const dirty = new Set();
  const timers = {{}};
  const chains = {{}};
  let col = null;

  const el = (id) => document.querySelector('[data-fig="' + id + '"]');
  const setStatus = (id, msg) => {{ const s = el(id)?.querySelector('[data-status]'); if (s) s.textContent = msg; }};
  const setAll = (msg) => cards.forEach((c) => setStatus(c.dataset.fig, msg));
  const paintVerdict = (id) => {{
    el(id)?.querySelectorAll('.verdict button').forEach((b) => b.setAttribute('aria-pressed', String(state[id]?.verdict === b.dataset.v)));
  }};

  function save(id) {{
    if (!col) {{ setStatus(id, "Can't save in this view."); return; }}
    const body = {{ text: state[id]?.text || '', verdict: state[id]?.verdict || '', updated: new Date().toISOString() }};
    setStatus(id, 'Saving…');
    chains[id] = (chains[id] || Promise.resolve()).then(() => col.doc(id).set(body)).then(
      () => {{ dirty.delete(id); setStatus(id, 'Saved ' + new Date().toLocaleTimeString([], {{ hour: 'numeric', minute: '2-digit' }})); }},
      (e) => setStatus(id, e && e.code === 'invalid_argument' ? 'Only the owner can save notes here.' : 'Not saved. Check your connection and type again.'),
    );
  }}

  cards.forEach((c) => {{
    const id = c.dataset.fig;
    state[id] = {{ text: '', verdict: '' }};
    const ta = c.querySelector('textarea');
    ta.addEventListener('input', () => {{
      state[id].text = ta.value;
      dirty.add(id);
      setStatus(id, 'Typing…');
      clearTimeout(timers[id]);
      timers[id] = setTimeout(() => save(id), 900);
    }});
    c.querySelectorAll('.verdict button').forEach((b) => b.addEventListener('click', () => {{
      state[id].verdict = state[id].verdict === b.dataset.v ? '' : b.dataset.v;
      paintVerdict(id);
      clearTimeout(timers[id]);
      save(id);
    }}));
  }});

  const use = window.claude && window.claude.use;
  if (!use) {{ setAll('Notes save only when this page is opened on claude.ai.'); return; }}
  setAll('Loading saved notes…');
  use('db').then((db) => {{
    if (!db) {{ setAll("Notes can't be saved in this view."); return; }}
    col = db.collection('critiques');
    const slow = setTimeout(() => setAll("Saved notes can't be reached yet. You can still type; it will save when the connection returns."), 10000);
    col.onSnapshot((snap) => {{
      if (!snap.metadata.fromCache) clearTimeout(slow);
      const seen = new Set();
      snap.docs.forEach((d) => {{
        const id = d.id; seen.add(id);
        if (!state[id] || dirty.has(id)) return;
        const v = d.data() || {{}};
        state[id] = {{ text: v.text || '', verdict: v.verdict || '' }};
        const ta = el(id)?.querySelector('textarea');
        if (ta && document.activeElement !== ta) ta.value = state[id].text;
        paintVerdict(id);
        if (v.updated) setStatus(id, 'Saved ' + new Date(v.updated).toLocaleString([], {{ month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }}));
      }});
      cards.forEach((c) => {{ if (!seen.has(c.dataset.fig) && !dirty.has(c.dataset.fig)) setStatus(c.dataset.fig, ''); }});
    }}, () => {{ clearTimeout(slow); setAll("Saved notes couldn't load. Reload the page to try again."); }});
  }}, () => setAll("Notes can't be saved in this view."));
}})();
</script>
"""


if __name__ == "__main__":
    out = Path(sys.argv[1])
    out.write_text(page())
    print(f"wrote {out} ({len(page()) / 1e3:.0f} KB)")
