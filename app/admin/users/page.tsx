import Link from 'next/link';
import { requireAdminSession } from '../../../features/direct/server/admin-session';
import { listUsers } from '../../../features/direct/server/admin';
import { AdminNav } from '../admin-nav';

type PageProps = {
  searchParams?: Promise<{ page?: string; search?: string }>;
};

export default async function AdminUsersPage({ searchParams }: PageProps) {
  const session = await requireAdminSession();
  const params = (await searchParams) ?? {};
  const page = Math.max(1, Number(params.page) || 1);
  const search = params.search ?? undefined;

  const { users, pagination } = await listUsers({ page, search });

  return (
    <main>
      <AdminNav email={session.email} />

      <h1>Users ({pagination.totalCount})</h1>

      <form method="get" style={{ marginBottom: '1rem' }}>
        <input
          name="search"
          placeholder="Search by email or name…"
          defaultValue={search}
          style={{ padding: '0.5rem', width: '300px' }}
        />
        <button type="submit" style={{ marginLeft: '0.5rem', padding: '0.5rem 1rem' }}>
          Search
        </button>
        {search && (
          <Link href="/admin/users" style={{ marginLeft: '0.5rem' }}>
            Clear
          </Link>
        )}
      </form>

      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead>
          <tr style={{ textAlign: 'left', borderBottom: '2px solid #ccc' }}>
            <th style={{ padding: '0.5rem' }}>Email</th>
            <th style={{ padding: '0.5rem' }}>Name</th>
            <th style={{ padding: '0.5rem' }}>Door</th>
            <th style={{ padding: '0.5rem' }}>Plan</th>
            <th style={{ padding: '0.5rem' }}>Verified</th>
            <th style={{ padding: '0.5rem' }}>2FA</th>
            <th style={{ padding: '0.5rem' }}>Created</th>
          </tr>
        </thead>
        <tbody>
          {users.map((user) => (
            <tr key={user.id} style={{ borderBottom: '1px solid #eee' }}>
              <td style={{ padding: '0.5rem' }}>
                <Link href={`/admin/users/${user.id}`}>{user.email}</Link>
              </td>
              <td style={{ padding: '0.5rem' }}>{user.name ?? '—'}</td>
              <td style={{ padding: '0.5rem' }}>
                {user.door ? (
                  <Link href={`/admin/doors?search=${user.door.slug}`}>
                    {user.door.slug}
                    {!user.door.isEnabled && ' (suspended)'}
                  </Link>
                ) : (
                  '—'
                )}
              </td>
              <td style={{ padding: '0.5rem' }}>{user.door?.plan ?? '—'}</td>
              <td style={{ padding: '0.5rem' }}>{user.emailVerifiedAt ? '✓' : '✗'}</td>
              <td style={{ padding: '0.5rem' }}>{user.twoFactorEnabled ? '✓' : '—'}</td>
              <td style={{ padding: '0.5rem', fontSize: '0.85rem' }}>
                {new Date(user.createdAt).toLocaleDateString()}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {users.length === 0 && <p>No users found.</p>}

      {pagination.totalPages > 1 && (
        <nav style={{ marginTop: '1rem', display: 'flex', gap: '1rem' }}>
          {page > 1 && (
            <Link href={`/admin/users?page=${page - 1}${search ? `&search=${search}` : ''}`}>
              ← Previous
            </Link>
          )}
          <span>
            Page {pagination.page} of {pagination.totalPages}
          </span>
          {page < pagination.totalPages && (
            <Link href={`/admin/users?page=${page + 1}${search ? `&search=${search}` : ''}`}>
              Next →
            </Link>
          )}
        </nav>
      )}
    </main>
  );
}
