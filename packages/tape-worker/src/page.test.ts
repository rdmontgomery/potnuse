import { describe, expect, it } from 'vitest';
import { dashboard, loginPage, type PageData } from './page.ts';
import { parseRungs, sameSecret } from './index.ts';

const empty: PageData = { bankroll: null, budgetUsd: 500, rows: [] };

const withMarket = (overrides: Partial<PageData['rows'][number]> = {}): PageData => ({
  bankroll: {
    deployedUsd: 50,
    committedUsd: 150,
    realizedUsd: -12.5,
    openCount: 1,
    burned: {},
    lastLossAt: null,
  },
  budgetUsd: 500,
  rows: [
    {
      market: { id: '0xpool', config: {}, active: true },
      cursor: '12345',
      position: null,
      symbol: 'MEME',
      quoteSymbol: 'USDC',
      ...overrides,
    },
  ],
});

describe('rung parsing', () => {
  it('reads multiple:bps pairs', () => {
    expect(parseRungs('2:4000,3:3000,5:1500')).toEqual([
      { atMultiple: 2, sellBps: 4000 },
      { atMultiple: 3, sellBps: 3000 },
      { atMultiple: 5, sellBps: 1500 },
    ]);
  });

  it('tolerates whitespace and trailing commas', () => {
    expect(parseRungs(' 2:4000 , 3:3000 , ')).toHaveLength(2);
  });

  it('names the bad rung rather than failing silently', () => {
    expect(() => parseRungs('2:4000,banana')).toThrow(/banana/);
  });
});

describe('secret comparison', () => {
  it('accepts an exact match and nothing else', () => {
    expect(sameSecret('hunter2', 'hunter2')).toBe(true);
    expect(sameSecret('hunter2', 'hunter3')).toBe(false);
    expect(sameSecret('hunter2', 'hunter22')).toBe(false);
    expect(sameSecret('', '')).toBe(true);
  });
});

describe('login page', () => {
  it('renders a complete document with a password field', () => {
    const out = loginPage();
    expect(out.startsWith('<!doctype html>')).toBe(true);
    expect(out).toContain('type="password"');
    expect(out).toContain('cannot move money');
  });

  it('shows an error without leaking the token back into the page', () => {
    const out = loginPage({ kind: 'rejected', text: 'That token is not right.' });
    expect(out).toContain('That token is not right.');
    expect(out).not.toContain('value="');
  });

  it('does not blame the reader for a runner nobody configured', () => {
    // "Rejected" sends someone hunting for a typo instead of a missing secret.
    const out = loginPage({ kind: 'unconfigured', text: 'No access token is set yet.' });
    expect(out).toContain('Not configured yet');
    expect(out).not.toContain('Not signed in');
  });

  it('names the setting to add so the fix needs no documentation', () => {
    const out = loginPage({
      kind: 'unconfigured',
      text: 'No access token is set on this Worker yet. Add TAPE_READ_TOKEN as a Secret under Settings, then reload.',
    });
    expect(out).toContain('TAPE_READ_TOKEN');
  });
});

describe('dashboard', () => {
  it('invites a first contract when the watchlist is empty', () => {
    expect(dashboard(empty)).toContain('Nothing on the watchlist yet');
  });

  it('renders bankroll figures, marking a loss', () => {
    const out = dashboard(withMarket());
    expect(out).toContain('-$12.50');
    expect(out).toContain('class="v neg"');
    // Headroom is budget minus committed, not minus realised.
    expect(out).toContain('$350.00');
  });

  it('offers a ticket only on a flat market', () => {
    expect(dashboard(withMarket())).toContain('Open ticket');
    const holding = withMarket({
      position: {
        position: {
          entryBasis: 1,
          qtyOriginal: 1n,
          qtyOpen: 1n,
          rungsFilled: [],
          highWater: 1,
          trailArmed: false,
          openedAt: 0,
          closedAt: null,
        },
        costUsd: 50,
        proceedsUsd: 0,
      },
    });
    const out = dashboard(holding);
    expect(out).not.toContain('Open ticket');
    expect(out).toContain('holding');
  });

  it('escapes market data rather than interpolating it raw', () => {
    // Market symbols come off-chain and are attacker-controlled.
    const hostile = withMarket({ symbol: '<img src=x onerror=alert(1)>' });
    const out = dashboard(hostile);
    expect(out).not.toContain('<img src=x');
    expect(out).toContain('&lt;img src=x');
  });

  it('renders a journal when one is requested', () => {
    const data = withMarket();
    data.journal = { market: '0xpool', lines: ['12:00:01  mark      0.1000'] };
    expect(dashboard(data)).toContain('12:00:01');
  });

  it('says so rather than rendering an empty block for a silent market', () => {
    const data = withMarket();
    data.journal = { market: '0xpool', lines: [] };
    expect(dashboard(data)).toContain('nothing recorded yet');
  });

  it('reports a blocked screen as refused', () => {
    const data = withMarket();
    data.flash = { kind: 'bad', text: 'blocked', detail: 'block pool-too-thin: …' };
    const out = dashboard(data);
    expect(out).toContain('Refused');
    expect(out).toContain('pool-too-thin');
  });
});
