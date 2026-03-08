import Link from 'next/link';
import { requireReachSession } from '../../../features/reach/server/session';
import { db } from '../../../lib/db';

export default async function ReachSettingsPage() {
  const session = await requireReachSession('/reach/settings');

  const actor = await db.reachActor.findUnique({
    where: { id: session.actorId },
  });

  if (!actor) {
    return (
      <main>
        <h1>Reach Settings</h1>
        <p>Actor not found.</p>
      </main>
    );
  }

  // Count org memberships if any.
  const orgMemberships = await db.reachOrgMember.findMany({
    where: { memberId: session.actorId, isActive: true },
    include: {
      org: { select: { id: true, handle: true, displayName: true } },
    },
  });

  return (
    <main>
      <h1>Reach Settings</h1>

      <section>
        <h2>Actor Profile</h2>
        <table className="detail-meta">
          <tbody>
            <tr>
              <td><strong>Handle</strong></td>
              <td>@{actor.handle}</td>
            </tr>
            <tr>
              <td><strong>Display name</strong></td>
              <td>{actor.displayName}</td>
            </tr>
            <tr>
              <td><strong>Type</strong></td>
              <td>{actor.type}</td>
            </tr>
            <tr>
              <td><strong>Status</strong></td>
              <td>{actor.isActive ? 'Active' : 'Inactive'}</td>
            </tr>
            <tr>
              <td><strong>Endpoint</strong></td>
              <td>{actor.endpoint ?? '(none)'}</td>
            </tr>
            <tr>
              <td><strong>Registered</strong></td>
              <td>{new Date(actor.createdAt).toLocaleString()}</td>
            </tr>
            {actor.capabilities && Object.keys(actor.capabilities as Record<string, unknown>).length > 0 && (
              <tr>
                <td><strong>Capabilities</strong></td>
                <td><code>{JSON.stringify(actor.capabilities)}</code></td>
              </tr>
            )}
          </tbody>
        </table>
        <p style={{ color: '#666', fontSize: '13px' }}>
          Actor profile updates are available via the Reach API.
        </p>
      </section>

      {orgMemberships.length > 0 && (
        <section>
          <h2>Organization Memberships</h2>
          <div className="inbox-list">
            {orgMemberships.map((m) => (
              <article key={m.id} className="inbox-card">
                <p>
                  <strong>{m.org.displayName}</strong> (@{m.org.handle})
                  {' · '}
                  Role: <strong>{m.role}</strong>
                </p>
              </article>
            ))}
          </div>
        </section>
      )}

      <section>
        <h2>Navigation</h2>
        <p className="inbox-links">
          <Link href="/reach">Dashboard</Link>
          <Link href="/reach/contracts">Contracts</Link>
          <Link href="/reach/policies">Policies</Link>
          <Link href="/direct/settings">Direct settings</Link>
        </p>
      </section>
    </main>
  );
}
