import Link from 'next/link';
import { requireAdminSession } from '../../../../features/direct/server/admin-session';
import { getRequestDetail } from '../../../../features/direct/server/admin';
import { AdminNav } from '../../admin-nav';
import { RequestAdminActions } from './request-admin-actions';

type PageProps = {
  params: Promise<{ requestId: string }>;
};

export default async function AdminRequestDetailPage({ params }: PageProps) {
  const session = await requireAdminSession();
  const { requestId } = await params;
  const request = await getRequestDetail(requestId);

  if (!request) {
    return (
      <main>
        <AdminNav email={session.email} />
        <h1>Request not found</h1>
        <Link href="/admin/requests">← Back to requests</Link>
      </main>
    );
  }

  return (
    <main>
      <AdminNav email={session.email} />

      <p>
        <Link href="/admin/requests">← Back to requests</Link>
      </p>

      <h1>Request: {request.title ?? '(No title)'}</h1>

      <h2>Metadata</h2>
      <table style={{ borderCollapse: 'collapse', marginBottom: '1rem' }}>
        <tbody>
          <Row label="ID" value={request.id} />
          <Row label="Status" value={request.status} />
          <Row label="Source" value={request.source} />
          <Row label="Category" value={request.category?.label ?? '—'} />
          <Row label="Sender Name" value={request.senderName ?? '—'} />
          <Row label="Sender Email" value={request.senderEmail ?? '—'} />
          <Row label="IP Hash" value={request.ipHash ?? '—'} />
          <Row label="Request Token" value={request.requestToken} />
          <Row label="Completion Token" value={request.completionToken ?? '—'} />
          <Row label="Completion Expires" value={request.completionExpiresAt ? new Date(request.completionExpiresAt).toLocaleString() : '—'} />
          <Row label="Created" value={new Date(request.createdAt).toLocaleString()} />
          <Row label="Updated" value={new Date(request.updatedAt).toLocaleString()} />
        </tbody>
      </table>

      <h2>Door</h2>
      <table style={{ borderCollapse: 'collapse', marginBottom: '1rem' }}>
        <tbody>
          <Row label="Door ID" value={request.door.id} />
          <Row label="Slug" value={request.door.slug} />
          <Row label="Display Name" value={request.door.displayName} />
          <Row label="Owner" value={request.door.user.email} />
        </tbody>
      </table>
      <p>
        <Link href={`/admin/users/${request.door.user.id}`}>View owner profile →</Link>
      </p>

      <h2>Message</h2>
      <pre style={{ background: '#f4f4f4', padding: '1rem', borderRadius: '4px', whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
        {request.message}
      </pre>

      {request.structuredData && (
        <>
          <h2>Structured Data</h2>
          <pre style={{ background: '#f4f4f4', padding: '1rem', borderRadius: '4px', whiteSpace: 'pre-wrap' }}>
            {JSON.stringify(request.structuredData, null, 2)}
          </pre>
        </>
      )}

      <h2>Events ({request.events.length})</h2>
      {request.events.length === 0 ? (
        <p>No events recorded.</p>
      ) : (
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ textAlign: 'left', borderBottom: '2px solid #ccc' }}>
              <th style={{ padding: '0.5rem' }}>Type</th>
              <th style={{ padding: '0.5rem' }}>Actor</th>
              <th style={{ padding: '0.5rem' }}>Note</th>
              <th style={{ padding: '0.5rem' }}>Metadata</th>
              <th style={{ padding: '0.5rem' }}>Created</th>
            </tr>
          </thead>
          <tbody>
            {request.events.map((event) => (
              <tr key={event.id} style={{ borderBottom: '1px solid #eee' }}>
                <td style={{ padding: '0.5rem' }}>{event.type}</td>
                <td style={{ padding: '0.5rem' }}>{event.actor}</td>
                <td style={{ padding: '0.5rem' }}>{event.note ?? '—'}</td>
                <td style={{ padding: '0.5rem', fontSize: '0.8rem' }}>
                  {event.metadata ? (
                    <pre style={{ margin: 0, whiteSpace: 'pre-wrap' }}>
                      {JSON.stringify(event.metadata, null, 2)}
                    </pre>
                  ) : (
                    '—'
                  )}
                </td>
                <td style={{ padding: '0.5rem', fontSize: '0.85rem' }}>
                  {new Date(event.createdAt).toLocaleString()}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {request.abuseReports.length > 0 && (
        <>
          <h2>Abuse Reports ({request.abuseReports.length})</h2>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ textAlign: 'left', borderBottom: '2px solid #ccc' }}>
                <th style={{ padding: '0.5rem' }}>Reason</th>
                <th style={{ padding: '0.5rem' }}>Description</th>
                <th style={{ padding: '0.5rem' }}>Status</th>
                <th style={{ padding: '0.5rem' }}>Reporter</th>
                <th style={{ padding: '0.5rem' }}>Created</th>
              </tr>
            </thead>
            <tbody>
              {request.abuseReports.map((report) => (
                <tr key={report.id} style={{ borderBottom: '1px solid #eee' }}>
                  <td style={{ padding: '0.5rem' }}>{report.reason}</td>
                  <td style={{ padding: '0.5rem' }}>{report.description ?? '—'}</td>
                  <td style={{ padding: '0.5rem' }}>{report.status}</td>
                  <td style={{ padding: '0.5rem' }}>{report.reporterEmail ?? '—'}</td>
                  <td style={{ padding: '0.5rem', fontSize: '0.85rem' }}>
                    {new Date(report.createdAt).toLocaleDateString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}

      <RequestAdminActions requestId={request.id} title={request.title ?? ''} />
    </main>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <tr style={{ borderBottom: '1px solid #eee' }}>
      <td style={{ padding: '0.5rem', fontWeight: 'bold', verticalAlign: 'top', whiteSpace: 'nowrap' }}>{label}</td>
      <td style={{ padding: '0.5rem', fontFamily: 'monospace', fontSize: '0.85rem' }}>{value}</td>
    </tr>
  );
}
