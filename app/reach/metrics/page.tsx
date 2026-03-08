import Link from 'next/link';
import { requireReachSession } from '../../../features/reach/server/session';
import { getMetricsForActor } from '../../../features/reach/server/metrics';
import type { DistributionStats } from '../../../lib/reach/metrics';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatDuration(seconds: number): string {
  if (seconds < 60) return `${Math.round(seconds)}s`;
  if (seconds < 3600) return `${Math.round(seconds / 60)}m`;
  if (seconds < 86400) return `${(seconds / 3600).toFixed(1)}h`;
  return `${(seconds / 86400).toFixed(1)}d`;
}

function formatPercent(rate: number | null): string {
  if (rate === null) return '—';
  return `${(rate * 100).toFixed(1)}%`;
}

function formatDate(date: Date | null): string {
  if (!date) return '—';
  return new Date(date).toLocaleDateString('en-NZ', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

function formatContractType(type: string): string {
  return type.replace(/_/g, ' → ').replace(/HUMAN/g, 'Human').replace(/AI/g, 'AI');
}

// ---------------------------------------------------------------------------
// Components
// ---------------------------------------------------------------------------

function StatCard({ label, value, detail }: { label: string; value: string; detail?: string }) {
  return (
    <div className="reach-stat">
      <span className="reach-stat-value">{value}</span>
      <span className="reach-stat-label">{label}</span>
      {detail && <span className="reach-stat-detail">{detail}</span>}
    </div>
  );
}

function DistributionTable({
  title,
  stats,
  formatter = String,
}: {
  title: string;
  stats: DistributionStats | null;
  formatter?: (v: number) => string;
}) {
  if (!stats || stats.count === 0) {
    return (
      <div className="reach-metric-block">
        <h3>{title}</h3>
        <p>No data yet.</p>
      </div>
    );
  }

  return (
    <div className="reach-metric-block">
      <h3>{title}</h3>
      <table className="reach-metric-table">
        <tbody>
          <tr>
            <td>Samples</td>
            <td>{stats.count}</td>
          </tr>
          <tr>
            <td>Min</td>
            <td>{formatter(stats.min)}</td>
          </tr>
          <tr>
            <td>Median</td>
            <td>{formatter(stats.median)}</td>
          </tr>
          <tr>
            <td>Mean</td>
            <td>{formatter(stats.mean)}</td>
          </tr>
          <tr>
            <td>P90</td>
            <td>{formatter(stats.p90)}</td>
          </tr>
          <tr>
            <td>Max</td>
            <td>{formatter(stats.max)}</td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default async function ReachMetricsPage() {
  const session = await requireReachSession('/reach/metrics');
  const metrics = await getMetricsForActor(session.actorId);

  return (
    <main>
      <h1>Reach Pilot Metrics</h1>
      <p>
        <strong>{session.actorDisplayName}</strong> (@{session.actorHandle})
        {' · '}
        Data window: {formatDate(metrics.window.from)} — {formatDate(metrics.window.to)}
      </p>

      {/* Top-level stats */}
      <section className="reach-stat-grid">
        <StatCard label="Total Contracts" value={String(metrics.totalContracts)} />
        <StatCard label="Resolved" value={String(metrics.resolvedContracts)} />
        <StatCard label="In-Flight" value={String(metrics.inFlightContracts)} />
        <StatCard
          label="One-Hop Success"
          value={formatPercent(metrics.oneHopSuccess.rate)}
          detail={`${metrics.oneHopSuccess.oneHopCount} / ${metrics.oneHopSuccess.resolvedCount} resolved`}
        />
      </section>

      {/* Status breakdown */}
      <section className="reach-metric-block">
        <h2>Status Breakdown</h2>
        {Object.keys(metrics.statusBreakdown).length === 0 ? (
          <p>No contracts yet.</p>
        ) : (
          <div className="reach-stat-grid">
            {Object.entries(metrics.statusBreakdown).map(([status, count]) => (
              <StatCard key={status} label={status} value={String(count)} />
            ))}
          </div>
        )}
      </section>

      {/* Type breakdown */}
      <section className="reach-metric-block">
        <h2>Contract Types</h2>
        {Object.keys(metrics.typeBreakdown).length === 0 ? (
          <p>No contracts yet.</p>
        ) : (
          <div className="reach-stat-grid">
            {Object.entries(metrics.typeBreakdown).map(([type, count]) => (
              <StatCard key={type} label={formatContractType(type)} value={String(count)} />
            ))}
          </div>
        )}
      </section>

      {/* Core metrics */}
      <section>
        <h2>Core Pilot Metrics</h2>

        <div className="reach-metrics-grid">
          <DistributionTable
            title="Path Length (events per resolved contract)"
            stats={metrics.pathLength}
            formatter={(v) => `${v} events`}
          />

          <DistributionTable
            title="Time to Qualified Counterparty"
            stats={metrics.timeToCounterparty}
            formatter={formatDuration}
          />
        </div>

        <div className="reach-metric-block">
          <h3>One-Hop Success Rate</h3>
          {metrics.oneHopSuccess.rate === null ? (
            <p>No resolved contracts yet — check back after some contracts complete their lifecycle.</p>
          ) : (
            <>
              <p className="reach-big-metric">{formatPercent(metrics.oneHopSuccess.rate)}</p>
              <p>
                {metrics.oneHopSuccess.oneHopCount} of {metrics.oneHopSuccess.resolvedCount} resolved
                contracts reached acceptance without escalation or human override.
              </p>
            </>
          )}
        </div>
      </section>

      <nav className="reach-quick-links">
        <p className="inbox-links">
          <Link href="/reach">← Back to Dashboard</Link>
          <Link href="/reach/contracts">View Contracts</Link>
        </p>
      </nav>
    </main>
  );
}
