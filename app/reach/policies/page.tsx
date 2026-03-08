import Link from 'next/link';
import { requireReachSession } from '../../../features/reach/server/session';
import { db } from '../../../lib/db';
import { PolicyActions } from './policy-actions';

export default async function ReachPoliciesPage() {
  const session = await requireReachSession('/reach/policies');

  const policies = await db.reachPolicy.findMany({
    where: { actorId: session.actorId },
    orderBy: { priority: 'desc' },
  });

  const activePolicies = policies.filter((p) => p.isActive);
  const inactivePolicies = policies.filter((p) => !p.isActive);

  return (
    <main>
      <h1>Reach Policies</h1>
      <p>
        Policies control how inbound contracts are automatically handled.
        Higher priority policies are evaluated first.
      </p>

      <p className="inbox-count">
        {activePolicies.length} active polic{activePolicies.length !== 1 ? 'ies' : 'y'}
        {inactivePolicies.length > 0
          ? ` · ${inactivePolicies.length} inactive`
          : ''}
        {' · '}
        <Link href="/reach/policies/new">+ New Policy</Link>
      </p>

      {activePolicies.length === 0 && inactivePolicies.length === 0 ? (
        <p>
          No policies configured. All inbound contracts will require manual review.{' '}
          <Link href="/reach/policies/new">Create your first policy</Link>.
        </p>
      ) : (
        <div className="inbox-list">
          {[...activePolicies, ...inactivePolicies].map((policy) => (
            <article
              key={policy.id}
              className="inbox-card"
              style={!policy.isActive ? { opacity: 0.6 } : undefined}
            >
              <header>
                <strong>
                  <Link href={`/reach/policies/${policy.id}/edit`}>
                    {policy.name}
                  </Link>
                </strong>
                {!policy.isActive && <span> (inactive)</span>}
                <p>
                  Action: <strong>{policy.action}</strong>
                  {' · '}
                  Priority: <strong>{policy.priority}</strong>
                  {' · '}
                  Types: {(policy.contractTypes as string[]).join(', ')}
                </p>
              </header>
              <table className="detail-meta" style={{ marginTop: 8 }}>
                <tbody>
                  {policy.maxWeeklyInbound !== null && (
                    <tr>
                      <td><strong>Weekly cap</strong></td>
                      <td>{policy.maxWeeklyInbound}</td>
                    </tr>
                  )}
                  <tr>
                    <td><strong>Require verified sender</strong></td>
                    <td>{policy.requireVerifiedSender ? 'Yes' : 'No'}</td>
                  </tr>
                  <tr>
                    <td><strong>Auto-accept matching</strong></td>
                    <td>{policy.autoAcceptMatching ? 'Yes' : 'No'}</td>
                  </tr>
                  <tr>
                    <td><strong>Escalate to human</strong></td>
                    <td>{policy.escalateToHuman ? 'Yes' : 'No'}</td>
                  </tr>
                  {policy.filters && Object.keys(policy.filters as Record<string, unknown>).length > 0 && (
                    <tr>
                      <td><strong>Filters</strong></td>
                      <td><code>{JSON.stringify(policy.filters)}</code></td>
                    </tr>
                  )}
                </tbody>
              </table>

              <PolicyActions
                policyId={policy.id}
                isActive={policy.isActive}
              />
            </article>
          ))}
        </div>
      )}
    </main>
  );
}
