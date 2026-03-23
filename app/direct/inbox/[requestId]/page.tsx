import React from 'react';
import Link from 'next/link';
import { getDirectDemoRequestFixture, isDirectDemoFixture } from '../../../../features/direct/demo-fixtures';
import { getRequestDetailForKeeper } from '../../../../features/direct/server/requests';
import { requireKeeperSession } from '../../../../features/direct/server/session';
import { getRequestStatusNarrative } from '../outcome-summary';
import { RequestActions } from '../request-actions';

type RequestDetailPageProps = {
  params: Promise<{ requestId: string }>;
  searchParams?: Promise<{ slug?: string; fixture?: string }>;
};

/** Human-readable verification status label */
function verificationLabel(status: string | null): { text: string; color: string } {
  if (status === 'ORG_VERIFIED') return { text: '✓ Org verified', color: '#15803d' };
  if (status === 'BASIC_VERIFIED') return { text: '✓ Basic verified', color: '#2563eb' };
  return { text: 'Unverified', color: '#a3a3a3' };
}

/** Format cents as currency string */
function formatQuote(amountCents: number, currency: string): string {
  const amount = amountCents / 100;
  try {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(amount);
  } catch {
    return `${currency} ${amount.toFixed(2)}`;
  }
}

export default async function RequestDetailPage({ params, searchParams }: RequestDetailPageProps) {
  const { requestId } = await params;
  const resolvedSearchParams = (await searchParams) ?? {};
  const useDemoFixture = isDirectDemoFixture(resolvedSearchParams.fixture);
  const session = useDemoFixture
    ? { userId: 'direct_demo_fixture', email: 'demo@knokio.example' }
    : await requireKeeperSession('/direct/inbox');

  const request = useDemoFixture
    ? getDirectDemoRequestFixture(requestId, resolvedSearchParams.slug)
    : await getRequestDetailForKeeper(session.userId, requestId);

  if (!request) {
    return (
      <main>
        <h1>Request Not Found</h1>
        <p>This request does not exist or is not accessible.</p>
        <Link href="/direct/inbox">← Back to inbox</Link>
      </main>
    );
  }

  const backSlug = resolvedSearchParams.slug ?? request.door.slug;
  const backHref = `/direct/inbox?slug=${backSlug}${useDemoFixture ? '&fixture=demo' : ''}`;
  const rawStructuredData = request.structuredData as Record<string, unknown> | null;
  const emailMeta = rawStructuredData?._emailMeta as Record<string, string> | undefined;
  // Filter out internal metadata keys for display
  const structuredData = rawStructuredData
    ? Object.fromEntries(
        Object.entries(rawStructuredData).filter(([key]) => !key.startsWith('_'))
      ) as Record<string, string>
    : null;
  const hasStructuredFields = structuredData && Object.keys(structuredData).length > 0;

  const vLabel = verificationLabel(request.requesterVerificationStatus);
  const statusNarrative = getRequestStatusNarrative(request.status);

  return (
    <main>
      <p>
        <Link href={backHref}>← Back to inbox</Link>
      </p>

      <h1>{request.title ?? '(No title)'}</h1>

      <section className="direct-surface-card" aria-label="Request routing narrative" style={{ padding: '12px 16px', marginBottom: 16 }}>
        <p className="direct-surface-eyebrow">Routing state</p>
        <h2 style={{ margin: '0 0 8px 0' }}>{statusNarrative.label}</h2>
        <p style={{ margin: 0 }}>{statusNarrative.detail}</p>
      </section>

      <table className="detail-meta">
        <tbody>
          <tr>
            <td><strong>Status</strong></td>
            <td>{request.status}</td>
          </tr>
          <tr>
            <td><strong>Source</strong></td>
            <td>{request.source}</td>
          </tr>
          <tr>
            <td><strong>Category</strong></td>
            <td>{request.category?.label ?? '—'}</td>
          </tr>
          <tr>
            <td><strong>Sender</strong></td>
            <td>
              {request.senderName ?? 'Unknown'}
              {request.senderEmail ? ` (${request.senderEmail})` : ''}
            </td>
          </tr>
          <tr>
            <td><strong>Verification</strong></td>
            <td>
              <span style={{ color: vLabel.color, fontWeight: 600 }}>{vLabel.text}</span>
              {request.requesterVerificationReason && (
                <span style={{ color: '#888', fontSize: '13px', marginLeft: 8 }}>
                  ({request.requesterVerificationReason})
                </span>
              )}
            </td>
          </tr>
          {request.requesterType === 'ORGANIZATION' && (
            <>
              <tr>
                <td><strong>Organization</strong></td>
                <td>{request.requesterOrgName ?? '—'}</td>
              </tr>
              {request.requesterOrgWebsite && (
                <tr>
                  <td><strong>Org website</strong></td>
                  <td>
                    <a href={request.requesterOrgWebsite} target="_blank" rel="noopener noreferrer">
                      {request.requesterOrgWebsite}
                    </a>
                  </td>
                </tr>
              )}
              {request.requesterRoleTitle && (
                <tr>
                  <td><strong>Role / title</strong></td>
                  <td>{request.requesterRoleTitle}</td>
                </tr>
              )}
            </>
          )}
          <tr>
            <td><strong>Received</strong></td>
            <td>{new Date(request.createdAt).toLocaleString()}</td>
          </tr>
          <tr>
            <td><strong>Last updated</strong></td>
            <td>{new Date(request.updatedAt).toLocaleString()}</td>
          </tr>
          <tr>
            <td><strong>Request token</strong></td>
            <td>
              <Link href={`/r/${request.requestToken}`} target="_blank">
                {request.requestToken}
              </Link>
            </td>
          </tr>
        </tbody>
      </table>

      <h2>Message</h2>
      <div className="detail-message">
        <p style={{ whiteSpace: 'pre-wrap' }}>{request.message}</p>
      </div>

      {emailMeta && (
        <>
          <h2>Email Origin</h2>
          <table className="detail-meta">
            <tbody>
              {emailMeta.from && (
                <tr>
                  <td><strong>From (raw)</strong></td>
                  <td>{emailMeta.from}</td>
                </tr>
              )}
              {emailMeta.to && (
                <tr>
                  <td><strong>To</strong></td>
                  <td>{emailMeta.to}</td>
                </tr>
              )}
              {emailMeta.alias && (
                <tr>
                  <td><strong>Alias</strong></td>
                  <td>{emailMeta.alias}</td>
                </tr>
              )}
            </tbody>
          </table>
        </>
      )}

      {hasStructuredFields && (
        <>
          <h2>Structured Data</h2>
          <table className="detail-meta">
            <tbody>
              {Object.entries(structuredData).map(([key, value]) => (
                <tr key={key}>
                  <td><strong>{key}</strong></td>
                  <td>{String(value)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}

      {request.status === 'AWAITING_COMPLETION' && (
        <div className="detail-completion-notice" style={{ padding: '12px 16px', background: '#fffbe6', border: '1px solid #ffe58f', borderRadius: 6, margin: '16px 0' }}>
          <p style={{ margin: 0 }}>
            <strong>⏳ Awaiting form completion</strong>
          </p>
          <p style={{ margin: '4px 0 0 0', color: '#666' }}>
            The sender was emailed a link to complete required fields.
            {request.completionExpiresAt ? (
              <> Link expires: <strong>{new Date(request.completionExpiresAt).toLocaleString()}</strong>.</>
            ) : null}
          </p>
          <p style={{ margin: '4px 0 0 0', color: '#666', fontSize: '13px' }}>
            You can decline this request if you don&apos;t want to wait.
          </p>
        </div>
      )}

      <RequestActions requestId={request.id} status={request.status as 'PENDING' | 'ACCEPTED' | 'DECLINED' | 'EXPIRED' | 'AWAITING_COMPLETION'} />

      {request.status === 'ACCEPTED' && request.door.settings && (
        <>
          <h2>Contact Reveal</h2>
          {request.door.settings.revealMethod === 'NONE' ? (
            <p>No contact reveal configured for this door.</p>
          ) : request.door.settings.revealMethod === 'EMAIL' ? (
            <p>
              Revealed email: <strong>{request.door.settings.revealValue ?? '(not set)'}</strong>
            </p>
          ) : request.door.settings.revealMethod === 'URL' ? (
            <p>
              Redirect URL:{' '}
              <a href={request.door.settings.revealValue ?? '#'} target="_blank" rel="noopener noreferrer">
                {request.door.settings.revealValue ?? '(not set)'}
              </a>
            </p>
          ) : null}
        </>
      )}

      {request.keeperQuoteAmountCents != null && (
        <div style={{ padding: '12px 16px', background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 6, margin: '16px 0' }}>
          <h2 style={{ margin: '0 0 8px 0', fontSize: '16px' }}>Quote Snapshot</h2>
          <p style={{ margin: 0 }}>
            <strong>{formatQuote(request.keeperQuoteAmountCents, request.keeperQuoteCurrency ?? 'USD')}</strong>
          </p>
          {request.keeperQuoteNote && (
            <p style={{ margin: '4px 0 0 0', color: '#666', fontSize: '14px' }}>
              {request.keeperQuoteNote}
            </p>
          )}
          {request.door.settings && (
            <p style={{ margin: '8px 0 0 0', color: '#888', fontSize: '13px' }}>
              Visibility: {request.door.settings.quoteVisibleToVerifiedOrgsOnly
                ? 'Verified orgs only'
                : 'All verified requesters'}
              {' · '}
              Requester: <span style={{ color: vLabel.color }}>{vLabel.text}</span>
            </p>
          )}
        </div>
      )}

      {request.events.length > 0 && (
        <>
          <h2>Event History</h2>
          <div className="detail-events">
            {request.events.map((event) => (
              <div key={event.id} className="event-row">
                <span className="event-type">{event.type}</span>
                <span className="event-actor">{event.actor}</span>
                <span className="event-time">{new Date(event.createdAt).toLocaleString()}</span>
                {event.note && <span className="event-note">{event.note}</span>}
              </div>
            ))}
          </div>
        </>
      )}
    </main>
  );
}
