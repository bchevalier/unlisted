import Link from 'next/link';
import { getRequestDetailForKeeper } from '../../../../features/direct/server/requests';
import { requireKeeperSession } from '../../../../features/direct/server/session';
import { RequestActions } from '../request-actions';

type RequestDetailPageProps = {
  params: Promise<{ requestId: string }>;
  searchParams?: Promise<{ slug?: string }>;
};

export default async function RequestDetailPage({ params, searchParams }: RequestDetailPageProps) {
  const session = await requireKeeperSession('/direct/inbox');
  const { requestId } = await params;
  const resolvedSearchParams = (await searchParams) ?? {};

  const request = await getRequestDetailForKeeper(session.userId, requestId);

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
  const rawStructuredData = request.structuredData as Record<string, unknown> | null;
  const emailMeta = rawStructuredData?._emailMeta as Record<string, string> | undefined;
  // Filter out internal metadata keys for display
  const structuredData = rawStructuredData
    ? Object.fromEntries(
        Object.entries(rawStructuredData).filter(([key]) => !key.startsWith('_'))
      ) as Record<string, string>
    : null;
  const hasStructuredFields = structuredData && Object.keys(structuredData).length > 0;

  return (
    <main>
      <p>
        <Link href={`/direct/inbox?slug=${backSlug}`}>← Back to inbox</Link>
      </p>

      <h1>{request.title ?? '(No title)'}</h1>

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

      <RequestActions requestId={request.id} status={request.status} />

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
