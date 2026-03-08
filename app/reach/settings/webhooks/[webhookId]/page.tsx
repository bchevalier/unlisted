import Link from 'next/link';
import { requireReachSession } from '../../../../../features/reach/server/session';
import { db } from '../../../../../lib/db';
import { getWebhookHealthStats } from '../../../../../lib/reach/webhooks';
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

  // Fetch health stats and recent deliveries in parallel.
  const [health, deliveries] = await Promise.all([
    getWebhookHealthStats(webhookId, 7),
    db.reachWebhookDelivery.findMany({
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
    }),
  ]);

  const events = webhook.events as string[];
  const successPct = health.totalDeliveries > 0
    ? `${(health.successRate * 100).toFixed(1)}%`
    : '—';

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

      {health.totalDeliveries > 0 && (
        <section style={{ margin: '16px 0' }}>
          <h2>Health (last 7 days)</h2>
          <table className="detail-meta">
            <tbody>
              <tr>
                <td><strong>Success rate</strong></td>
                <td>
                  <span style={{ color: health.successRate >= 0.9 ? '#2e7d32' : health.successRate >= 0.5 ? '#e65100' : '#d32f2f' }}>
                    {successPct}
                  </span>
                  {' '}({health.successCount}/{health.successCount + health.failedCount} deliveries)
                </td>
              </tr>
              <tr>
                <td><strong>Total deliveries</strong></td>
                <td>{health.totalDeliveries}{health.pendingCount > 0 ? ` (${health.pendingCount} pending)` : ''}</td>
              </tr>
              <tr>
                <td><strong>Avg attempts</strong></td>
                <td>{health.avgAttempts.toFixed(1)}</td>
              </tr>
              {health.lastSuccessAt && (
                <tr>
                  <td><strong>Last success</strong></td>
                  <td>{new Date(health.lastSuccessAt).toLocaleString()}</td>
                </tr>
              )}
              {health.lastFailureAt && (
                <tr>
                  <td><strong>Last failure</strong></td>
                  <td style={{ color: '#d32f2f' }}>{new Date(health.lastFailureAt).toLocaleString()}</td>
                </tr>
              )}
            </tbody>
          </table>
        </section>
      )}

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
              const isSuccess = delivery.status === 'success';
              const isFailed = delivery.status === 'failed';
              return (
                <article key={delivery.id} className="inbox-card">
                  <header>
                    <p>
                      <span
                        className={`contract-status contract-status-${isSuccess ? 'fulfilled' : isFailed ? 'rejected' : 'proposed'}`}
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
                  {isFailed && (
                    <WebhookDetailActions
                      webhookId={webhook.id}
                      actorHandle={session.actorHandle}
                      isActive={webhook.isActive}
                      retryDeliveryId={delivery.id}
                    />
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
