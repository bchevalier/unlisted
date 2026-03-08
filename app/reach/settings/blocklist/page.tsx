import Link from 'next/link';
import { requireReachSession } from '../../../../features/reach/server/session';
import { db } from '../../../../lib/db';
import { BlocklistActions, BlockActorForm } from './blocklist-actions';

export default async function ReachBlocklistPage() {
  const session = await requireReachSession('/reach/settings/blocklist');

  const blocked = await db.reachBlockedActor.findMany({
    where: { blockerId: session.actorId },
    include: {
      blocked: {
        select: { id: true, handle: true, displayName: true, type: true },
      },
    },
    orderBy: { createdAt: 'desc' },
  });

  return (
    <main>
      <p>
        <Link href="/reach/settings">← Back to settings</Link>
      </p>

      <h1>Blocked Actors</h1>
      <p>
        Blocked actors cannot send you contracts. Existing contracts are not affected.
      </p>

      <section style={{ marginBottom: 24 }}>
        <h2>Block an Actor</h2>
        <BlockActorForm />
      </section>

      <p className="inbox-count">
        {blocked.length} blocked actor{blocked.length !== 1 ? 's' : ''}
      </p>

      {blocked.length === 0 ? (
        <p>No actors blocked. You can block actors by handle above.</p>
      ) : (
        <div className="inbox-list">
          {blocked.map((entry) => (
            <article key={entry.id} className="inbox-card">
              <header>
                <p>
                  <strong>{entry.blocked.displayName}</strong>{' '}
                  (@{entry.blocked.handle})
                  {' · '}
                  {entry.blocked.type}
                  {' · '}
                  Blocked {new Date(entry.createdAt).toLocaleDateString()}
                </p>
              </header>
              {entry.reason && (
                <p style={{ fontSize: 13, color: '#666' }}>Reason: {entry.reason}</p>
              )}
              <BlocklistActions blockedHandle={entry.blocked.handle} />
            </article>
          ))}
        </div>
      )}
    </main>
  );
}
