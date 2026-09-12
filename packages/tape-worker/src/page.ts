import type { StoredMarket, StoredPosition } from '@rdm/tape';
import type { BankrollState } from '@rdm/tape';

export interface MarketRow {
  market: StoredMarket;
  cursor: string | null;
  position: StoredPosition | null;
  symbol: string;
  quoteSymbol: string;
}

export interface PageData {
  bankroll: BankrollState | null;
  budgetUsd: number;
  rows: MarketRow[];
  flash?: { kind: 'ok' | 'warn' | 'bad'; text: string; detail?: string };
  journal?: { market: string; lines: string[] };
}

const esc = (value: unknown) =>
  String(value).replace(/[&<>"']/g, (c) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!,
  );

const money = (n: number) => `${n < 0 ? '-' : ''}$${Math.abs(n).toFixed(2)}`;

const STYLE = `
:root{
  --paper:#e9eae4;--surface:#f4f5f0;--sunk:#e0e2d9;--ink:#191d18;--ink-soft:#5e655c;
  --ink-faint:#838a80;--rule:#c6c9be;--rule-soft:#d7dacf;--accent:#1e4a78;
  --accent-wash:#dfe6ee;--block:#8a2e23;--warn:#7f5a10;--ok:#3c6a4b;
  --block-wash:#f0ded9;--warn-wash:#f0e6cf;--ok-wash:#dde9de;
  --serif:'Newsreader',Georgia,serif;--mono:'IBM Plex Mono',ui-monospace,Menlo,monospace;
}
@media (prefers-color-scheme:dark){:root:not([data-theme="light"]){
  --paper:#13171a;--surface:#1a2024;--sunk:#0e1315;--ink:#dee3dd;--ink-soft:#939c93;
  --ink-faint:#6e7873;--rule:#2c3439;--rule-soft:#232a2e;--accent:#84b5e8;
  --accent-wash:#1a2836;--block:#e28374;--warn:#d6a848;--ok:#74bb90;
  --block-wash:#2e1a17;--warn-wash:#2c2314;--ok-wash:#16271c;
}}
*{box-sizing:border-box}
body{background:var(--paper);color:var(--ink);font-family:var(--serif);font-size:16px;
  line-height:1.6;margin:0;padding-inline:20px;padding-block:0;-webkit-font-smoothing:antialiased}
.sheet{max-width:60rem;margin-inline:auto;display:flex;flex-direction:column;gap:2.5rem;
  padding-block:2.5rem 4rem}
h1{font-size:clamp(2rem,7vw,3rem);font-weight:600;line-height:1;letter-spacing:-.02em;margin:0}
h1 em{font-style:italic;font-weight:300;color:var(--ink-soft)}
h2{font-size:1.35rem;font-weight:500;margin:0;letter-spacing:-.01em}
.slug{font-family:var(--mono);font-size:.6875rem;font-weight:500;letter-spacing:.14em;
  text-transform:uppercase;color:var(--accent)}
section{display:flex;flex-direction:column;gap:1rem}
.m,code{font-family:var(--mono);font-size:.8125rem}
.note{color:var(--ink-soft);font-size:.9375rem}
.tiles{display:grid;grid-template-columns:repeat(auto-fit,minmax(9rem,1fr));gap:1px;
  background:var(--rule-soft);border:1px solid var(--rule-soft)}
.tile{background:var(--surface);padding:.9rem 1rem;display:flex;flex-direction:column;gap:.25rem}
.tile .k{font-family:var(--mono);font-size:.625rem;letter-spacing:.1em;text-transform:uppercase;
  color:var(--ink-faint)}
.tile .v{font-family:var(--mono);font-size:1.25rem;font-weight:600;font-variant-numeric:tabular-nums}
.tile .v.neg{color:var(--block)} .tile .v.pos{color:var(--ok)}
table{width:100%;border-collapse:collapse;font-size:.875rem}
.scroll{overflow-x:auto;border:1px solid var(--rule-soft)}
th{font-family:var(--mono);font-size:.625rem;letter-spacing:.1em;text-transform:uppercase;
  color:var(--ink-faint);text-align:left;padding:.6rem .75rem;background:var(--sunk);font-weight:600}
td{padding:.7rem .75rem;border-top:1px solid var(--rule-soft);vertical-align:top;
  font-variant-numeric:tabular-nums;background:var(--surface)}
td.mono{font-family:var(--mono);font-size:.75rem}
form.inline{display:inline}
fieldset{border:1px solid var(--rule);padding:1.15rem;margin:0;background:var(--surface);
  display:grid;grid-template-columns:repeat(auto-fit,minmax(13rem,1fr));gap:.9rem}
legend{font-family:var(--mono);font-size:.6875rem;letter-spacing:.1em;text-transform:uppercase;
  color:var(--ink-soft);padding-inline:.4rem}
label{display:flex;flex-direction:column;gap:.3rem;font-family:var(--mono);font-size:.6875rem;
  letter-spacing:.06em;text-transform:uppercase;color:var(--ink-soft)}
input,select{font-family:var(--mono);font-size:.8125rem;padding:.5rem .6rem;border:1px solid var(--rule);
  background:var(--paper);color:var(--ink);border-radius:2px;width:100%;min-width:0}
input:focus-visible,select:focus-visible,button:focus-visible{outline:2px solid var(--accent);outline-offset:1px}
button{font-family:var(--mono);font-size:.6875rem;font-weight:600;letter-spacing:.08em;
  text-transform:uppercase;padding:.55em .9em;border:1px solid var(--rule);background:var(--paper);
  color:var(--ink-soft);border-radius:2px;cursor:pointer}
button:hover{border-color:var(--ink-soft);color:var(--ink)}
button.primary{background:var(--accent-wash);border-color:var(--accent);color:var(--accent)}
button.danger{color:var(--block);border-color:var(--block-wash)}
.flash{border-left:3px solid var(--accent);background:var(--accent-wash);padding:1rem 1.15rem;
  display:flex;flex-direction:column;gap:.4rem}
.flash.warn{border-left-color:var(--warn);background:var(--warn-wash)}
.flash.bad{border-left-color:var(--block);background:var(--block-wash)}
.flash .k{font-family:var(--mono);font-size:.6875rem;font-weight:600;letter-spacing:.1em;
  text-transform:uppercase}
.flash pre{font-family:var(--mono);font-size:.75rem;margin:0;white-space:pre-wrap;line-height:1.5}
.pill{font-family:var(--mono);font-size:.625rem;font-weight:600;letter-spacing:.08em;
  text-transform:uppercase;padding:.15em .45em;border-radius:2px;background:var(--sunk);color:var(--ink-soft)}
.pill.open{background:var(--ok-wash);color:var(--ok)}
.pill.flat{background:var(--sunk);color:var(--ink-faint)}
pre.journal{font-family:var(--mono);font-size:.6875rem;line-height:1.6;background:var(--sunk);
  border:1px solid var(--rule-soft);padding:1rem;overflow-x:auto;margin:0}
footer{border-top:1px solid var(--rule);padding-top:1rem;font-family:var(--mono);font-size:.6875rem;
  color:var(--ink-faint);line-height:1.7}
.row{display:flex;flex-wrap:wrap;gap:.5rem;align-items:center}
@media (prefers-reduced-motion:reduce){*{transition:none!important}}
`;

function shell(title: string, body: string): string {
  return `<!doctype html><html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(title)}</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Newsreader:ital,opsz,wght@0,6..72,300..700;1,6..72,300..600&family=IBM+Plex+Mono:wght@400;500;600&display=swap">
<style>${STYLE}</style></head><body><div class="sheet">${body}</div></body></html>`;
}

export function loginPage(error?: string): string {
  return shell(
    'Tape Runner',
    `<header><span class="slug">Paper trading runner</span>
<h1>Ladder <em>and</em> Ledger</h1></header>
${error ? `<div class="flash bad"><span class="k">Rejected</span><p>${esc(error)}</p></div>` : ''}
<form method="post" action="/login">
<fieldset><legend>Sign in</legend>
<label>Access token<input id="token" name="token" type="password" autocomplete="current-password" autofocus></label>
</fieldset>
<div class="row" style="margin-top:1rem"><button class="primary" type="submit">Enter</button></div>
</form>
<footer>No signer, no keys. This runner reads chains and writes rows; it cannot move money.</footer>`,
  );
}

export function dashboard(data: PageData): string {
  const b = data.bankroll;
  const committed = b?.committedUsd ?? 0;
  const realized = b?.realizedUsd ?? 0;
  const open = b?.openCount ?? 0;

  const tiles = `<div class="tiles">
<div class="tile"><span class="k">Budget</span><span class="v">${esc(money(data.budgetUsd))}</span></div>
<div class="tile"><span class="k">Committed</span><span class="v">${esc(money(committed))}</span></div>
<div class="tile"><span class="k">Realised</span><span class="v ${realized < 0 ? 'neg' : realized > 0 ? 'pos' : ''}">${esc(money(realized))}</span></div>
<div class="tile"><span class="k">Open</span><span class="v">${open}</span></div>
<div class="tile"><span class="k">Headroom</span><span class="v">${esc(money(Math.max(data.budgetUsd - committed, 0)))}</span></div>
</div>`;

  const rows = data.rows.length
    ? data.rows
        .map((row) => {
          const held = row.position?.position;
          const pnl = (row.position?.proceedsUsd ?? 0) - (row.position?.costUsd ?? 0);
          return `<tr>
<td><strong>${esc(row.symbol)}</strong> / ${esc(row.quoteSymbol)}<br><span class="m" style="color:var(--ink-faint)">${esc(row.market.id)}</span></td>
<td class="mono">${esc(row.cursor ?? 'not started')}</td>
<td>${held ? `<span class="pill open">holding</span>` : `<span class="pill flat">flat</span>`}</td>
<td class="mono">${row.position ? esc(money(row.position.costUsd)) : '—'}</td>
<td class="mono">${row.position ? esc(money(pnl)) : '—'}</td>
<td><div class="row">
${held ? '' : `<form class="inline" method="post" action="/market/enter"><input type="hidden" name="id" value="${esc(row.market.id)}"><button type="submit">Open ticket</button></form>`}
<a href="/?journal=${encodeURIComponent(row.market.id)}"><button type="button">Journal</button></a>
<form class="inline" method="post" action="/market/deactivate"><input type="hidden" name="id" value="${esc(row.market.id)}"><button class="danger" type="submit">Stop</button></form>
</div></td></tr>`;
        })
        .join('')
    : `<tr><td colspan="6" class="note">Nothing on the watchlist yet. Paste a contract address below.</td></tr>`;

  const flash = data.flash
    ? `<div class="flash ${data.flash.kind === 'ok' ? '' : data.flash.kind}">
<span class="k">${data.flash.kind === 'ok' ? 'Done' : data.flash.kind === 'warn' ? 'Proceed with care' : 'Refused'}</span>
<p>${esc(data.flash.text)}</p>
${data.flash.detail ? `<pre>${esc(data.flash.detail)}</pre>` : ''}</div>`
    : '';

  const journal = data.journal
    ? `<section><h2>Journal &middot; <span class="m">${esc(data.journal.market)}</span></h2>
<pre class="journal">${esc(data.journal.lines.join('\n')) || 'nothing recorded yet'}</pre></section>`
    : '';

  return shell(
    'Tape Runner',
    `<header><span class="slug">Paper trading runner</span>
<h1>Ladder <em>and</em> Ledger</h1></header>
${flash}
<section><h2>Program</h2>${tiles}</section>
<section><h2>Watchlist</h2>
<div class="scroll"><table><thead><tr>
<th>Market</th><th>Cursor</th><th>State</th><th>Cost</th><th>P&amp;L</th><th>Actions</th>
</tr></thead><tbody>${rows}</tbody></table></div>
<p class="note">The runner scans every minute. Opening a ticket is manual and always will be &mdash; which tickers enter the universe is the one judgement this system leaves to a person.</p>
</section>

<section><h2>Watch a contract</h2>
<form method="post" action="/market">
<fieldset><legend>Market</legend>
<label>Base token CA<input id="base" name="base" placeholder="0x…" required></label>
<label>Quote token CA<input id="quote" name="quote" placeholder="0x…" required></label>
<label>Pool address (optional)<input id="pool" name="pool" placeholder="0x…"></label>
<label>Factory (if no pool)<input id="factory" name="factory" placeholder="0x…"></label>
<label>RPC URL<input id="rpcUrl" name="rpcUrl" value="https://rpc.mainnet.chain.robinhood.com" required></label>
<label>Chain ID<input id="chainId" name="chainId" value="4663" required></label>
<label>Start block<input id="startBlock" name="startBlock" value="0" required></label>
</fieldset>
<fieldset><legend>Pricing and fees</legend>
<label>Quote USD reference<select id="usdRef" name="usdRef">
<option value="pegged">Stablecoin (1.00)</option>
<option value="none">None — pair ratio only</option>
</select></label>
<label>Buy fee bps<input id="buyBps" name="buyBps" value="100" required></label>
<label>Sell fee bps<input id="sellBps" name="sellBps" value="100" required></label>
<label>Measure multiples in<select id="denom" name="denom">
<option value="usd">USD</option><option value="quote">Quote asset</option>
</select></label>
</fieldset>
<fieldset><legend>Ladder and bankroll</legend>
<label>Rungs<input id="rungs" name="rungs" value="2:4000,3:3000,5:1500"></label>
<label>Stop multiple<input id="stop" name="stop" value="0.5"></label>
<label>Trail % off high<input id="trail" name="trail" value="35"></label>
<label>Program budget USD<input id="budget" name="budget" value="500" required></label>
<label>Slots<input id="slots" name="slots" value="10" required></label>
</fieldset>
<div class="row" style="margin-top:1rem">
<button class="primary" type="submit">Screen and watch</button>
<span class="note">Discovery reads decimals and symbols on-chain. The screen runs before anything is stored.</span>
</div>
</form></section>
${journal}
<footer>No signer, no keys, one write path. Set <span class="m">stop</span> to 0 to run without one.<br>
Anything the screen could not establish counts as a warning, never as clear.</footer>`,
  );
}
