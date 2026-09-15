/** Rendering a Report for a human or for the agent that reads it. */

import type { Report } from './observe.ts';

function pad(value: string, width: number): string {
  return value.length >= width ? value : value + ' '.repeat(width - value.length);
}

function padStart(value: string, width: number): string {
  return value.length >= width ? value : ' '.repeat(width - value.length) + value;
}

function days(value: number): string {
  return Number.isFinite(value) ? `${Math.round(value)}d` : '-';
}

export function formatTable(report: Report): string {
  const out: string[] = [];
  const window = report.prior
    ? `${report.windowDays}d (since ${report.prior.when.slice(0, 10)}, ${report.prior.rev.slice(0, 8)})`
    : `${report.windowDays}d — no commit that old, deltas are unavailable`;

  out.push(`rhizome tending — head ${report.head.when.slice(0, 10)}`);
  out.push(`window        ${window}`);
  out.push(`corpus delta  ${report.corpusDelta >= 0 ? '+' : ''}${report.corpusDelta} nodes`);
  if (report.staticNodesFound === 0) {
    out.push('WARNING       no STATIC_NODES parsed from graph.ts — the regex in');
    out.push('              graph.ts::parseStaticNodes has drifted from the source');
  }
  out.push('');

  const widths = { slug: 22, state: 24, in: 4, d: 4, age: 6, quiet: 6, acc: 6 };
  out.push(
    [
      pad('node', widths.slug),
      pad('state', widths.state),
      padStart('in', widths.in),
      padStart('Δin', widths.d),
      padStart('age', widths.age),
      padStart('quiet', widths.quiet),
      padStart('accr', widths.acc),
    ].join('  '),
  );
  out.push('-'.repeat(80));

  for (const { signals, proposal } of report.rows) {
    const transition = proposal.changed
      ? `${proposal.from} -> ${proposal.to}`
      : proposal.to;
    out.push(
      [
        pad(signals.slug, widths.slug),
        pad(transition, widths.state),
        padStart(String(signals.inDegree), widths.in),
        padStart(
          `${signals.inDegreeDelta > 0 ? '+' : ''}${signals.inDegreeDelta}`,
          widths.d,
        ),
        padStart(days(signals.ageDays), widths.age),
        padStart(days(signals.quietDays), widths.quiet),
        padStart(
          proposal.accrual === null ? '-' : proposal.accrual.toFixed(2),
          widths.acc,
        ),
      ].join('  '),
    );
  }

  const changes = report.rows.filter((r) => r.proposal.changed);
  out.push('');
  if (changes.length === 0) {
    out.push('no state changes proposed.');
  } else {
    out.push(`proposed changes (${changes.length}):`);
    for (const { proposal } of changes) {
      out.push(`  ${proposal.slug}: ${proposal.from} -> ${proposal.to}`);
      out.push(`    ${proposal.because}`);
    }
  }

  if (report.orphans.length > 0) {
    out.push('');
    out.push(`orphans — nothing links in (${report.orphans.length}):`);
    for (const slug of report.orphans) out.push(`  ${slug}`);
  }
  if (report.dangling.length > 0) {
    out.push('');
    out.push(`dangling connects — graph.ts drops these silently (${report.dangling.length}):`);
    for (const d of report.dangling) out.push(`  ${d.from} -> ${d.target}`);
  }
  if (report.unmappedRoutes.length > 0) {
    out.push('');
    out.push(`live routes with no node — invisible on /rhizome (${report.unmappedRoutes.length}):`);
    for (const route of report.unmappedRoutes) out.push(`  ${route}`);
  }

  return out.join('\n');
}

export function hasFindings(report: Report): boolean {
  return (
    report.rows.some((r) => r.proposal.changed) ||
    report.orphans.length > 0 ||
    report.dangling.length > 0 ||
    report.unmappedRoutes.length > 0
  );
}
