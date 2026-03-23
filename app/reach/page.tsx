import Link from 'next/link';
import { getReachSession } from '../../features/reach/server/session';
import { getContractSummary } from '../../features/reach/server/contracts';

export default async function ReachDashboardPage() {
  const session = await getReachSession();

  if (!session) {
    return (
      <main className="lane-page lane-page-reach">
        <header className="lane-header">
          <Link href="/" className="lane-back-link">
            ← Back to Knokio
          </Link>
          <span className="lane-chip lane-chip-magenta">Reach lane</span>
        </header>

        <section className="lane-hero-panel">
          <p className="lane-kicker">Knokio Reach</p>
          <h1>One-hop routing to the right human or AI.</h1>
          <p className="lane-lede">
            Reach keeps introductions consent-based and policy-bound, so you can move quickly without open-network
            noise.
          </p>
          <div className="lane-action-row">
            <Link className="button primary" href="/direct/login?next=/reach">
              Sign in for Reach
            </Link>
            <Link className="button secondary" href="/reach/register">
              Register Reach actor
            </Link>
          </div>
        </section>
      </main>
    );
  }

  const summary = await getContractSummary(session.actorId);

  return (
    <main className="lane-page lane-page-reach">
      <header className="lane-header">
        <Link href="/" className="lane-back-link">
          ← Back to Knokio
        </Link>
        <span className="lane-chip lane-chip-magenta">Reach lane</span>
      </header>

      <section className="lane-hero-panel">
        <p className="lane-kicker">Reach Dashboard</p>
        <h1>Coordinate faster with policy-bound contracts.</h1>
        <p className="lane-lede">
          Signed in as <strong>{session.actorDisplayName}</strong> (@{session.actorHandle}) · Type:{' '}
          <strong>{session.actorType}</strong>
        </p>
      </section>

      <section className="lane-panel reach-summary-panel">
        <h2>Contract Summary</h2>
        <div className="reach-stat-grid">
          <div className="reach-stat">
            <span className="reach-stat-value">{summary.total}</span>
            <span className="reach-stat-label">Total</span>
          </div>
          <div className="reach-stat">
            <span className="reach-stat-value">{summary.statusCounts['PROPOSED'] ?? 0}</span>
            <span className="reach-stat-label">Proposed</span>
          </div>
          <div className="reach-stat">
            <span className="reach-stat-value">{summary.statusCounts['ACTIVE'] ?? 0}</span>
            <span className="reach-stat-label">Active</span>
          </div>
          <div className="reach-stat">
            <span className="reach-stat-value">{summary.statusCounts['FULFILLED'] ?? 0}</span>
            <span className="reach-stat-label">Fulfilled</span>
          </div>
          <div className="reach-stat">
            <span className="reach-stat-value">{summary.statusCounts['REJECTED'] ?? 0}</span>
            <span className="reach-stat-label">Rejected</span>
          </div>
          <div className="reach-stat">
            <span className="reach-stat-value">{summary.statusCounts['EXPIRED'] ?? 0}</span>
            <span className="reach-stat-label">Expired</span>
          </div>
        </div>

        {summary.escalatedCount > 0 && (
          <p className="reach-escalation-alert">
            ⚠️ {summary.escalatedCount} contract{summary.escalatedCount !== 1 ? 's' : ''} pending human review —{' '}
            <Link href="/reach/escalations">Review escalations</Link>
          </p>
        )}
      </section>

      <section className="lane-panel">
        <h2>Quick Actions</h2>
        <p className="inbox-links">
          <Link href="/reach/contracts">View all contracts</Link>
          <Link href="/reach/contracts?role=target&status=PROPOSED">Incoming proposals</Link>
          <Link href="/reach/escalations">Escalation queue</Link>
          <Link href="/reach/policies">Manage policies</Link>
          <Link href="/reach/metrics">Pilot metrics</Link>
        </p>
      </section>
    </main>
  );
}
