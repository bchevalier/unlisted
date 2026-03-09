import Link from 'next/link';
import { requireAdminSession } from '../../../features/direct/server/admin-session';
import { listDoors } from '../../../features/direct/server/admin';
import { AdminNav } from '../admin-nav';
import { DoorAdminActions } from './door-admin-actions';

type PageProps = {
  searchParams?: Promise<{ page?: string; search?: string }>;
};

export default async function AdminDoorsPage({ searchParams }: PageProps) {
  const session = await requireAdminSession();
  const params = (await searchParams) ?? {};
  const page = Math.max(1, Number(params.page) || 1);
  const search = params.search ?? undefined;

  const { doors, pagination } = await listDoors({ page, search });

  return (
    <main>
      <AdminNav email={session.email} />

      <h1>Doors ({pagination.totalCount})</h1>

      <form method="get" style={{ marginBottom: '1rem' }}>
        <input
          name="search"
          placeholder="Search by slug, name, or owner email…"
          defaultValue={search}
          style={{ padding: '0.5rem', width: '300px' }}
        />
        <button type="submit" style={{ marginLeft: '0.5rem', padding: '0.5rem 1rem' }}>
          Search
        </button>
        {search && (
          <Link href="/admin/doors" style={{ marginLeft: '0.5rem' }}>
            Clear
          </Link>
        )}
      </form>

      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead>
          <tr style={{ textAlign: 'left', borderBottom: '2px solid #ccc' }}>
            <th style={{ padding: '0.5rem' }}>Slug</th>
            <th style={{ padding: '0.5rem' }}>Display Name</th>
            <th style={{ padding: '0.5rem' }}>Owner</th>
            <th style={{ padding: '0.5rem' }}>Plan</th>
            <th style={{ padding: '0.5rem' }}>Status</th>
            <th style={{ padding: '0.5rem' }}>Requests</th>
            <th style={{ padding: '0.5rem' }}>Created</th>
            <th style={{ padding: '0.5rem' }}>Actions</th>
          </tr>
        </thead>
        <tbody>
          {doors.map((door) => (
            <tr key={door.id} style={{ borderBottom: '1px solid #eee' }}>
              <td style={{ padding: '0.5rem' }}>
                <Link href={`/u/${door.slug}`} target="_blank">
                  {door.slug}
                </Link>
              </td>
              <td style={{ padding: '0.5rem' }}>{door.displayName}</td>
              <td style={{ padding: '0.5rem' }}>
                <Link href={`/admin/users/${door.user.id}`}>
                  {door.user.email}
                </Link>
              </td>
              <td style={{ padding: '0.5rem' }}>{door.plan}</td>
              <td style={{ padding: '0.5rem' }}>
                {door.isEnabled ? (
                  <span style={{ color: 'green' }}>Active</span>
                ) : (
                  <span style={{ color: 'red' }}>Suspended</span>
                )}
              </td>
              <td style={{ padding: '0.5rem' }}>{door._count.requests}</td>
              <td style={{ padding: '0.5rem', fontSize: '0.85rem' }}>
                {new Date(door.createdAt).toLocaleDateString()}
              </td>
              <td style={{ padding: '0.5rem' }}>
                <DoorAdminActions
                  doorId={door.id}
                  slug={door.slug}
                  isEnabled={door.isEnabled}
                />
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {doors.length === 0 && <p>No doors found.</p>}

      {pagination.totalPages > 1 && (
        <nav style={{ marginTop: '1rem', display: 'flex', gap: '1rem' }}>
          {page > 1 && (
            <Link href={`/admin/doors?page=${page - 1}${search ? `&search=${search}` : ''}`}>
              ← Previous
            </Link>
          )}
          <span>
            Page {pagination.page} of {pagination.totalPages}
          </span>
          {page < pagination.totalPages && (
            <Link href={`/admin/doors?page=${page + 1}${search ? `&search=${search}` : ''}`}>
              Next →
            </Link>
          )}
        </nav>
      )}
    </main>
  );
}
