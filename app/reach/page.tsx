import Link from 'next/link';
import { getReachSession } from '../../features/reach/server/session';
import { getContractSummary } from '../../features/reach/server/contracts';

export default async function ReachDashboardPage() {
  const session = await getReachSession();

  if (!session) {
    return (
      <main>
        <h1>Knokio Reach</h1>
        <p>One-hop, consent-based routing to reach the right human or AI agent.</p>
        <p>
          <Link href="/direct/login?next=/reach">Sign in</Link> to access Reach,
          or <Link href="/reach/register">register a Reach actor</Link>.
        </p>
      </main>
    );
  }

  const summary = await getContractSummary(session.actorId);

  return (
    <main>
      <h1>Reach Dashboard</h1>
      <p>
        Signed in as <strong>{session.actorDisplayName}</strong> (@{session.actorHandle})
        · Type: <strong>{session.actorType}</strong>
      </p>

      <section className="reach-summary">
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
            ⚠️ {summary.escalatedCount} contract{summary.escalatedCount !== 1 ? 's' : ''} pending
            human review —{' '}
            <Link href="/reach/escalations">Review escalations</Link>
          </p>
        )}
      </section>

      <section className="reach-quick-links">
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
