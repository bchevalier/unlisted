import Link from 'next/link';
import { RequestStatus } from '@prisma/client';
import { requireAdminSession } from '../../../features/direct/server/admin-session';
import { listRequests } from '../../../features/direct/server/admin';
import { AdminNav } from '../admin-nav';

type PageProps = {
  searchParams?: Promise<{ page?: string; search?: string; status?: string; doorId?: string }>;
};

const STATUS_OPTIONS = ['', 'PENDING', 'AWAITING_COMPLETION', 'ACCEPTED', 'DECLINED', 'EXPIRED'];

function isValidStatus(value: string): value is RequestStatus {
  return ['PENDING', 'ACCEPTED', 'DECLINED', 'EXPIRED', 'AWAITING_COMPLETION'].includes(value);
}

export default async function AdminRequestsPage({ searchParams }: PageProps) {
  const session = await requireAdminSession();
  const params = (await searchParams) ?? {};
  const page = Math.max(1, Number(params.page) || 1);
  const search = params.search ?? undefined;
  const doorId = params.doorId ?? undefined;
  const status = params.status && isValidStatus(params.status) ? (params.status as RequestStatus) : undefined;

  const { requests, pagination } = await listRequests({ page, search, status, doorId });

  function buildUrl(overrides: Record<string, string | number | undefined>) {
    const base: Record<string, string> = {};
    if (search) base.search = search;
    if (status) base.status = status;
    if (doorId) base.doorId = doorId;
    for (const [k, v] of Object.entries(overrides)) {
      if (v !== undefined && v !== '') {
        base[k] = String(v);
      } else {
        delete base[k];
      }
    }
    const qs = new URLSearchParams(base).toString();
    return `/admin/requests${qs ? `?${qs}` : ''}`;
  }

  return (
    <main>
      <AdminNav email={session.email} />

      <h1>Requests ({pagination.totalCount})</h1>

      <form method="get" style={{ marginBottom: '1rem', display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
        <input
          name="search"
          placeholder="Search by title, message, sender…"
          defaultValue={search}
          style={{ padding: '0.5rem', width: '250px' }}
        />
        <select name="status" defaultValue={status ?? ''} style={{ padding: '0.5rem' }}>
          {STATUS_OPTIONS.map((s) => (
            <option key={s} value={s}>
              {s || 'All statuses'}
            </option>
          ))}
        </select>
        {doorId && <input type="hidden" name="doorId" value={doorId} />}
        <button type="submit" style={{ padding: '0.5rem 1rem' }}>
          Filter
        </button>
        {(search || status || doorId) && (
          <Link href="/admin/requests">Clear</Link>
        )}
      </form>

      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead>
          <tr style={{ textAlign: 'left', borderBottom: '2px solid #ccc' }}>
            <th style={{ padding: '0.5rem' }}>Title</th>
            <th style={{ padding: '0.5rem' }}>Sender</th>
            <th style={{ padding: '0.5rem' }}>Door</th>
            <th style={{ padding: '0.5rem' }}>Status</th>
            <th style={{ padding: '0.5rem' }}>Source</th>
            <th style={{ padding: '0.5rem' }}>Category</th>
            <th style={{ padding: '0.5rem' }}>Created</th>
          </tr>
        </thead>
        <tbody>
          {requests.map((req) => (
            <tr key={req.id} style={{ borderBottom: '1px solid #eee' }}>
              <td style={{ padding: '0.5rem' }}>
                <Link href={`/admin/requests/${req.id}`}>
                  {req.title ?? '(No title)'}
                </Link>
              </td>
              <td style={{ padding: '0.5rem', fontSize: '0.85rem' }}>
                {req.senderName ?? '—'}
                {req.senderEmail ? ` (${req.senderEmail})` : ''}
              </td>
              <td style={{ padding: '0.5rem' }}>
                <Link href={buildUrl({ doorId: req.door.slug })}>
                  {req.door.slug}
                </Link>
              </td>
              <td style={{ padding: '0.5rem' }}>{req.status}</td>
              <td style={{ padding: '0.5rem' }}>{req.source}</td>
              <td style={{ padding: '0.5rem' }}>{req.category?.label ?? '—'}</td>
              <td style={{ padding: '0.5rem', fontSize: '0.85rem' }}>
                {new Date(req.createdAt).toLocaleDateString()}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {requests.length === 0 && <p>No requests found.</p>}

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
