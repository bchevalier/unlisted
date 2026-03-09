import Link from 'next/link';
import { requireAdminSession } from '../../../features/direct/server/admin-session';
import { listAbuseReports } from '../../../features/direct/server/admin';
import { AdminNav } from '../admin-nav';

type PageProps = {
  searchParams?: Promise<{ page?: string; status?: string }>;
};

const STATUS_OPTIONS = ['', 'OPEN', 'REVIEWED', 'DISMISSED'];

export default async function AdminAbuseReportsPage({ searchParams }: PageProps) {
  const session = await requireAdminSession();
  const params = (await searchParams) ?? {};
  const page = Math.max(1, Number(params.page) || 1);
  const status = params.status ?? undefined;

  const { reports, pagination } = await listAbuseReports({ page, status });

  function buildUrl(overrides: Record<string, string | number | undefined>) {
    const base: Record<string, string> = {};
    if (status) base.status = status;
    for (const [k, v] of Object.entries(overrides)) {
      if (v !== undefined && v !== '') {
        base[k] = String(v);
      } else {
        delete base[k];
      }
    }
    const qs = new URLSearchParams(base).toString();
    return `/admin/abuse-reports${qs ? `?${qs}` : ''}`;
  }

  return (
    <main>
      <AdminNav email={session.email} />

      <h1>Abuse Reports ({pagination.totalCount})</h1>

      <form method="get" style={{ marginBottom: '1rem', display: 'flex', gap: '0.5rem' }}>
        <select name="status" defaultValue={status ?? ''} style={{ padding: '0.5rem' }}>
          {STATUS_OPTIONS.map((s) => (
            <option key={s} value={s}>
              {s || 'All statuses'}
            </option>
          ))}
        </select>
        <button type="submit" style={{ padding: '0.5rem 1rem' }}>Filter</button>
        {status && <Link href="/admin/abuse-reports">Clear</Link>}
      </form>

      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead>
          <tr style={{ textAlign: 'left', borderBottom: '2px solid #ccc' }}>
            <th style={{ padding: '0.5rem' }}>Reason</th>
            <th style={{ padding: '0.5rem' }}>Description</th>
            <th style={{ padding: '0.5rem' }}>Status</th>
            <th style={{ padding: '0.5rem' }}>Request</th>
            <th style={{ padding: '0.5rem' }}>Door</th>
            <th style={{ padding: '0.5rem' }}>Reporter</th>
            <th style={{ padding: '0.5rem' }}>Created</th>
          </tr>
        </thead>
        <tbody>
          {reports.map((report) => (
            <tr key={report.id} style={{ borderBottom: '1px solid #eee' }}>
              <td style={{ padding: '0.5rem' }}>{report.reason}</td>
              <td style={{ padding: '0.5rem', maxWidth: '200px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {report.description ?? '—'}
              </td>
              <td style={{ padding: '0.5rem' }}>
                <span style={{ color: report.status === 'OPEN' ? 'red' : 'inherit' }}>
                  {report.status}
                </span>
              </td>
              <td style={{ padding: '0.5rem' }}>
                {report.request ? (
                  <Link href={`/admin/requests/${report.request.id}`}>
                    {report.request.title ?? report.request.id.slice(0, 8)}
                  </Link>
                ) : (
                  '—'
                )}
              </td>
              <td style={{ padding: '0.5rem' }}>
                {report.door ? (
                  <Link href={`/admin/doors?search=${report.door.slug}`}>
                    {report.door.slug}
                  </Link>
                ) : (
                  '—'
                )}
              </td>
              <td style={{ padding: '0.5rem', fontSize: '0.85rem' }}>
                {report.reporterEmail ?? '—'}
              </td>
              <td style={{ padding: '0.5rem', fontSize: '0.85rem' }}>
                {new Date(report.createdAt).toLocaleDateString()}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {reports.length === 0 && <p>No abuse reports found.</p>}

      {pagination.totalPages > 1 && (
        <nav style={{ marginTop: '1rem', display: 'flex', gap: '1rem' }}>
          {page > 1 && (
            <Link href={buildUrl({ page: page - 1 })}>← Previous</Link>
          )}
          <span>
            Page {pagination.page} of {pagination.totalPages}
          </span>
          {page < pagination.totalPages && (
            <Link href={buildUrl({ page: page + 1 })}>Next →</Link>
          )}
        </nav>
      )}
    </main>
  );
}
