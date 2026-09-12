import { readFile } from 'node:fs/promises';
import { factsFrom, usdReference, type TapeConfig } from './config.ts';
import { poolFeed } from './feed/pool.ts';
import { jsonRpc } from './feed/rpc.ts';
import { fileJournal, memoryJournal, readJournal, summarize } from './journal.ts';
import { paperSession } from './paper.ts';
import { formatVerdict, screen } from './screen.ts';
import { slotSize, makeBankroll, openBankroll } from './bankroll.ts';
import { TapeError } from './types.ts';

const USAGE = `tape — paper-trading harness

  screen <config.json>              read the pool and score the token
  watch  <config.json>              poll the pool and record a tape
  report <journal.jsonl>            read a recorded run back

Nothing in this package can sign a transaction. It reads pools and writes
files. Entries are opened by hand, from the screen output.`;

async function loadConfig(path: string): Promise<TapeConfig> {
  return JSON.parse(await readFile(path, 'utf8')) as TapeConfig;
}

function build(config: TapeConfig) {
  const call = jsonRpc(config.rpcUrl);
  const feed = poolFeed(call, config.market, usdReference(config.usdRef));
  return { call, feed };
}

async function cmdScreen(path: string): Promise<void> {
  const config = await loadConfig(path);
  const { feed } = build(config);
  const observation = await feed.poll(Date.now());
  if (!observation) throw new TapeError('pool returned no reserves');

  const ticket = slotSize(makeBankroll(config.bankroll), openBankroll());
  const facts = factsFrom(config);
  const verdict = screen(
    {
      ...facts,
      usdPerQuote: facts.usdPerQuote ?? observation.mark.usdPerQuote,
      market: config.market,
      pool: observation.pool,
      fees: config.fees,
    },
    { ...config.screen, intendedSizeUsd: ticket },
  );

  const { base, quote } = config.market;
  console.log(`${base.symbol}/${quote.symbol} @ ${observation.mark.quotePerBase.toPrecision(6)} ${quote.symbol}`);
  console.log(`quote asset in USD: ${observation.mark.usdPerQuote ?? 'no reference'}`);
  console.log(`ticket: $${ticket}`);
  console.log(formatVerdict(verdict));
}

async function cmdWatch(path: string): Promise<void> {
  const config = await loadConfig(path);
  const { feed } = build(config);
  const pollMs = config.pollMs ?? 60_000;
  const journal = config.journalPath
    ? await fileJournal(config.journalPath)
    : memoryJournal();

  const session = paperSession(
    {
      market: config.market,
      plan: config.plan,
      bankroll: config.bankroll,
      fees: config.fees,
      latencyHaircutBps: config.latencyHaircutBps,
    },
    feed,
    journal,
  );

  await journal.write({ kind: 'session', t: Date.now(), note: 'watch', config });
  console.log(`watching ${config.market.base.symbol} every ${pollMs / 1000}s — ctrl-c to stop`);

  let stop = false;
  process.on('SIGINT', () => {
    stop = true;
  });

  while (!stop) {
    try {
      const alive = await session.tick(Date.now());
      if (!alive) console.warn('feed returned nothing this poll');
    } catch (error) {
      // A dropped poll is not a reason to lose the run. Record and carry on;
      // a gap in the tape is visible later, a crashed process is not.
      await journal.write({
        kind: 'note',
        t: Date.now(),
        market: config.market.pool,
        text: `poll failed: ${String(error)}`,
      });
    }
    await new Promise((resolve) => setTimeout(resolve, pollMs));
  }

  console.log(JSON.stringify(summarize(journal.events), null, 2));
}

async function cmdReport(path: string): Promise<void> {
  const summary = summarize(await readJournal(path));
  console.log(JSON.stringify(summary, null, 2));
  if (summary.fills > 0 && Math.abs(summary.meanSlippageBps) < 10) {
    // If paper says execution was nearly free, paper is wrong, and every
    // other number in this summary inherits that error.
    console.warn('\nmean slippage under 10bps — check the fee schedule and depth before believing this run');
  }
}

async function main(): Promise<void> {
  const [command, argument] = process.argv.slice(2);
  if (!command || !argument) {
    console.log(USAGE);
    process.exitCode = command ? 1 : 0;
    return;
  }
  if (command === 'screen') return cmdScreen(argument);
  if (command === 'watch') return cmdWatch(argument);
  if (command === 'report') return cmdReport(argument);
  console.log(USAGE);
  process.exitCode = 1;
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
