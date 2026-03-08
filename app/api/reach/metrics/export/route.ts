/**
 * GET /api/reach/metrics/export — Export Reach pilot metrics as CSV.
 *
 * Auth required. Returns a downloadable CSV with core metrics summary.
 * Supports ?from= and ?to= ISO date filters.
 */

import {
  getReachPilotMetrics,
} from '../../../../../lib/reach/metrics';
import type { ReachPilotMetrics } from '../../../../../lib/reach/metrics';
import {
  authenticateReachRequest,
  reachDisabledResponse,
  unauthorizedResponse,
} from '../../../../../lib/reach/auth';

function metricsToCSV(m: ReachPilotMetrics): string {
  const lines: string[] = [];

  // Header section
  lines.push('Knokio Reach Pilot Metrics Export');
  lines.push(`Generated,${new Date().toISOString()}`);
  lines.push(`Data Window,${m.window.from?.toISOString() ?? 'N/A'},${m.window.to?.toISOString() ?? 'N/A'}`);
  lines.push('');

  // Summary
  lines.push('Summary');
  lines.push('Metric,Value');
  lines.push(`Total Contracts,${m.totalContracts}`);
  lines.push(`Resolved Contracts,${m.resolvedContracts}`);
  lines.push(`In-Flight Contracts,${m.inFlightContracts}`);
  lines.push(`One-Hop Success Rate,${m.oneHopSuccess.rate !== null ? (m.oneHopSuccess.rate * 100).toFixed(1) + '%' : 'N/A'}`);
  lines.push(`One-Hop Count,${m.oneHopSuccess.oneHopCount}`);
  lines.push('');

  // Conversion funnel
  lines.push('Conversion Funnel');
  lines.push('Stage,Count,Rate');
  lines.push(`Proposed,${m.funnel.proposed},100%`);
  lines.push(`Active,${m.funnel.active},${fmtRate(m.funnel.proposedToActiveRate)}`);
  lines.push(`Fulfilled,${m.funnel.fulfilled},${fmtRate(m.funnel.overallRate)}`);
  lines.push('');

  // SLA
  lines.push('SLA Compliance');
  lines.push('Threshold (s),Within SLA,Total,Rate');
  lines.push(`${m.sla.thresholdSeconds},${m.sla.withinSla},${m.sla.total},${fmtRate(m.sla.rate)}`);
  lines.push('');

  // Distribution: Path Length
  if (m.pathLength) {
    lines.push('Path Length Distribution (events per resolved contract)');
    lines.push('Stat,Value');
    lines.push(`Count,${m.pathLength.count}`);
    lines.push(`Min,${m.pathLength.min}`);
    lines.push(`Median,${m.pathLength.median}`);
    lines.push(`Mean,${m.pathLength.mean}`);
    lines.push(`P90,${m.pathLength.p90}`);
    lines.push(`Max,${m.pathLength.max}`);
    lines.push('');
  }

  // Distribution: Time to Counterparty
  if (m.timeToCounterparty) {
    lines.push('Time to Qualified Counterparty (seconds)');
    lines.push('Stat,Value');
    lines.push(`Count,${m.timeToCounterparty.count}`);
    lines.push(`Min,${m.timeToCounterparty.min}`);
    lines.push(`Median,${m.timeToCounterparty.median}`);
    lines.push(`Mean,${m.timeToCounterparty.mean}`);
    lines.push(`P90,${m.timeToCounterparty.p90}`);
    lines.push(`Max,${m.timeToCounterparty.max}`);
    lines.push('');
  }

  // Status breakdown
  lines.push('Status Breakdown');
  lines.push('Status,Count');
  for (const [status, count] of Object.entries(m.statusBreakdown)) {
    lines.push(`${status},${count}`);
  }
  lines.push('');

  // Type breakdown
  lines.push('Contract Type Breakdown');
  lines.push('Type,Count');
  for (const [type, count] of Object.entries(m.typeBreakdown)) {
    lines.push(`${type},${count}`);
  }
  lines.push('');

  // Per-type segments
  if (m.byType.length > 0) {
    lines.push('Per-Type Performance');
    lines.push('Type,Total,Resolved,In-Flight,One-Hop Rate,Acceptance Rate,Fulfillment Rate,Median TTC (s),Median Path Length');
    for (const seg of m.byType) {
      lines.push([
        seg.type,
        seg.total,
        seg.resolved,
        seg.inFlight,
        fmtRate(seg.oneHopRate),
        fmtRate(seg.funnel.proposedToActiveRate),
        fmtRate(seg.funnel.overallRate),
        seg.timeToCounterparty?.median ?? 'N/A',
        seg.pathLength?.median ?? 'N/A',
      ].join(','));
    }
  }

  return lines.join('\n');
}

function fmtRate(r: number | null): string {
  return r !== null ? (r * 100).toFixed(1) + '%' : 'N/A';
}

export async function GET(request: Request) {
  const blocked = reachDisabledResponse();
  if (blocked) return blocked;

  const auth = await authenticateReachRequest(request);
  if (!auth) return unauthorizedResponse();

  try {
    const url = new URL(request.url);
    const fromParam = url.searchParams.get('from');
    const toParam = url.searchParams.get('to');
    const from = fromParam ? new Date(fromParam) : undefined;
    const to = toParam ? new Date(toParam) : undefined;

    if (from && isNaN(from.getTime())) {
      return Response.json({ ok: false, error: 'Invalid "from" date' }, { status: 400 });
    }
    if (to && isNaN(to.getTime())) {
      return Response.json({ ok: false, error: 'Invalid "to" date' }, { status: 400 });
    }

    const metrics = await getReachPilotMetrics({ actorId: auth.actorId, from, to });
    const csv = metricsToCSV(metrics);
    const filename = `reach-metrics-${new Date().toISOString().slice(0, 10)}.csv`;

    return new Response(csv, {
      status: 200,
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="${filename}"`,
      },
    });
  } catch (error) {
    console.error('[reach/metrics/export GET]', error);
    return Response.json({ ok: false, error: 'Internal server error' }, { status: 500 });
  }
}
