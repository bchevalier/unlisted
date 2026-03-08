import Link from 'next/link';
import { requireReachSession } from '../../../../../features/reach/server/session';
import { db } from '../../../../../lib/db';
import { WebhookDetailActions } from './webhook-detail-actions';

type WebhookDetailPageProps = {
  params: Promise<{ webhookId: string }>;
};

export default async function WebhookDetailPage({ params }: WebhookDetailPageProps) {
  const session = await requireReachSession('/reach/settings/webhooks');
  const { webhookId } = await params;

  const webhook = await db.reachWebhook.findUnique({
    where: { id: webhookId },
    select: {
      id: true,
      actorId: true,
      url: true,
      events: true,
      description: true,
      isActive: true,
      createdAt: true,
      updatedAt: true,
    },
  });

  if (!webhook || webhook.actorId !== session.actorId) {
    return (
      <main>
        <h1>Webhook Not Found</h1>
        <p>This webhook does not exist or is not accessible.</p>
        <Link href="/reach/settings/webhooks">← Back to webhooks</Link>
      </main>
    );
  }

  // Fetch recent deliveries.
  const deliveries = await db.reachWebhookDelivery.findMany({
    where: { webhookId },
    orderBy: { createdAt: 'desc' },
    take: 20,
    select: {
      id: true,
      event: true,
      httpStatus: true,
      status: true,
      attempts: true,
      lastError: true,
      deliveredAt: true,
      createdAt: true,
    },
  });

  const events = webhook.events as string[];

  return (
    <main>
      <p>
        <Link href="/reach/settings/webhooks">← Back to webhooks</Link>
      </p>

      <h1>Webhook Detail</h1>

      <table className="detail-meta">
        <tbody>
          <tr>
            <td><strong>URL</strong></td>
            <td style={{ wordBreak: 'break-all' }}>{webhook.url}</td>
          </tr>
          <tr>
            <td><strong>Status</strong></td>
            <td>{webhook.isActive ? '✓ Active' : '✗ Inactive'}</td>
          </tr>
          {webhook.description && (
            <tr>
              <td><strong>Description</strong></td>
              <td>{webhook.description}</td>
            </tr>
          )}
          <tr>
            <td><strong>Events</strong></td>
            <td>{events.length === 0 ? 'All events' : events.join(', ')}</td>
          </tr>
          <tr>
            <td><strong>Created</strong></td>
            <td>{new Date(webhook.createdAt).toLocaleString()}</td>
          </tr>
          <tr>
            <td><strong>Updated</strong></td>
            <td>{new Date(webhook.updatedAt).toLocaleString()}</td>
          </tr>
        </tbody>
      </table>

      <WebhookDetailActions
        webhookId={webhook.id}
        actorHandle={session.actorHandle}
        isActive={webhook.isActive}
      />

      <section style={{ marginTop: 24 }}>
        <h2>Recent Deliveries</h2>
        {deliveries.length === 0 ? (
          <p>No deliveries yet. Events will appear here once contracts trigger webhook calls.</p>
        ) : (
          <div className="inbox-list">
            {deliveries.map((delivery) => {
              const isSuccess = delivery.status === 'DELIVERED';
              return (
                <article key={delivery.id} className="inbox-card">
                  <header>
                    <p>
                      <span
                        className={`contract-status contract-status-${isSuccess ? 'fulfilled' : 'rejected'}`}
                      >
                        {delivery.status}
                      </span>
                      {' · '}
                      <strong>{delivery.event}</strong>
                      {' · '}
                      HTTP {delivery.httpStatus ?? '—'}
                      {' · '}
                      Attempts: {delivery.attempts}
                      {' · '}
                      {new Date(delivery.createdAt).toLocaleString()}
                    </p>
                  </header>
                  {delivery.lastError && (
                    <p style={{ color: '#d32f2f', fontSize: 13 }}>
                      {delivery.lastError}
                    </p>
                  )}
                </article>
              );
            })}
          </div>
        )}
      </section>
    </main>
  );
}
