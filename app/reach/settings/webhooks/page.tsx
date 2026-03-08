import Link from 'next/link';
import { requireReachSession } from '../../../../features/reach/server/session';
import { db } from '../../../../lib/db';
import { WebhookActions } from './webhook-actions';

export default async function ReachWebhooksPage() {
  const session = await requireReachSession('/reach/settings/webhooks');

  const webhooks = await db.reachWebhook.findMany({
    where: { actorId: session.actorId },
    orderBy: { createdAt: 'asc' },
    select: {
      id: true,
      url: true,
      events: true,
      description: true,
      isActive: true,
      createdAt: true,
      updatedAt: true,
    },
  });

  const activeWebhooks = webhooks.filter((w) => w.isActive);
  const inactiveWebhooks = webhooks.filter((w) => !w.isActive);

  return (
    <main>
      <p>
        <Link href="/reach/settings">← Back to settings</Link>
      </p>

      <h1>Webhooks</h1>
      <p>
        Webhooks deliver contract lifecycle events to your external systems in real time.
        Each webhook receives signed payloads with HMAC verification.
      </p>

      <p className="inbox-count">
        {activeWebhooks.length} active webhook{activeWebhooks.length !== 1 ? 's' : ''}
        {inactiveWebhooks.length > 0
          ? ` · ${inactiveWebhooks.length} inactive`
          : ''}
        {' · '}
        <Link href="/reach/settings/webhooks/new">+ New Webhook</Link>
      </p>

      {webhooks.length === 0 ? (
        <p>
          No webhooks configured. Contract events are only visible in the dashboard.{' '}
          <Link href="/reach/settings/webhooks/new">Create your first webhook</Link>.
        </p>
      ) : (
        <div className="inbox-list">
          {[...activeWebhooks, ...inactiveWebhooks].map((webhook) => (
            <article
              key={webhook.id}
              className="inbox-card"
              style={!webhook.isActive ? { opacity: 0.6 } : undefined}
            >
              <header>
                <strong>
                  <Link href={`/reach/settings/webhooks/${webhook.id}`}>
                    {webhook.url.length > 60
                      ? `${webhook.url.slice(0, 60)}…`
                      : webhook.url}
                  </Link>
                </strong>
                {!webhook.isActive && <span> (inactive)</span>}
                <p>
                  {webhook.description ?? 'No description'}
                  {' · '}
                  Created {new Date(webhook.createdAt).toLocaleDateString()}
                </p>
              </header>
              <p>
                Events: {(webhook.events as string[]).length === 0
                  ? 'All events'
                  : (webhook.events as string[]).join(', ')}
              </p>

              <WebhookActions
                webhookId={webhook.id}
                actorHandle={session.actorHandle}
                isActive={webhook.isActive}
              />
            </article>
          ))}
        </div>
      )}
    </main>
  );
}
