import Link from 'next/link';
import { requireAdminSession } from '../../../../features/direct/server/admin-session';
import { getUserDetail } from '../../../../features/direct/server/admin';
import { AdminNav } from '../../admin-nav';
import { UserAdminActions } from './user-admin-actions';

type PageProps = {
  params: Promise<{ userId: string }>;
};

export default async function AdminUserDetailPage({ params }: PageProps) {
  const session = await requireAdminSession();
  const { userId } = await params;
  const user = await getUserDetail(userId);

  if (!user) {
    return (
      <main>
        <AdminNav email={session.email} />
        <h1>User not found</h1>
        <Link href="/admin/users">← Back to users</Link>
      </main>
    );
  }

  const isDisabled = !user.emailVerifiedAt;

  return (
    <main>
      <AdminNav email={session.email} />

      <p>
        <Link href="/admin/users">← Back to users</Link>
      </p>

      <h1>User: {user.email}</h1>

      <table style={{ borderCollapse: 'collapse', marginBottom: '1rem' }}>
        <tbody>
          <Row label="ID" value={user.id} />
          <Row label="Email" value={user.email} />
          <Row label="Name" value={user.name ?? '—'} />
          <Row label="Email Verified" value={user.emailVerifiedAt ? new Date(user.emailVerifiedAt).toLocaleString() : 'No (disabled)'} />
          <Row label="2FA Enabled" value={user.twoFactorEnabled ? 'Yes' : 'No'} />
          <Row label="Stripe Customer" value={user.stripeCustomerId ?? '—'} />
          <Row label="Created" value={new Date(user.createdAt).toLocaleString()} />
          <Row label="Updated" value={new Date(user.updatedAt).toLocaleString()} />
        </tbody>
      </table>

      <UserAdminActions userId={user.id} email={user.email} isDisabled={isDisabled} />

      <h2 style={{ marginTop: '2rem' }}>Auth Identities</h2>
      {user.identities.length === 0 ? (
        <p>No auth identities.</p>
      ) : (
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ textAlign: 'left', borderBottom: '2px solid #ccc' }}>
              <th style={{ padding: '0.5rem' }}>Provider</th>
              <th style={{ padding: '0.5rem' }}>Email</th>
              <th style={{ padding: '0.5rem' }}>Created</th>
            </tr>
          </thead>
          <tbody>
            {user.identities.map((id, i) => (
              <tr key={i} style={{ borderBottom: '1px solid #eee' }}>
                <td style={{ padding: '0.5rem' }}>{id.provider}</td>
                <td style={{ padding: '0.5rem' }}>{id.providerEmail ?? '—'}</td>
                <td style={{ padding: '0.5rem', fontSize: '0.85rem' }}>
                  {new Date(id.createdAt).toLocaleDateString()}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {user.door && (
        <>
          <h2 style={{ marginTop: '2rem' }}>Door</h2>
          <table style={{ borderCollapse: 'collapse' }}>
            <tbody>
              <Row label="Door ID" value={user.door.id} />
              <Row label="Slug" value={user.door.slug} />
              <Row label="Display Name" value={user.door.displayName} />
              <Row label="Plan" value={user.door.plan} />
              <Row label="Enabled" value={user.door.isEnabled ? 'Yes' : 'No (suspended)'} />
              <Row label="Requests" value={String(user.door._count.requests)} />
              <Row label="Categories" value={String(user.door._count.categories)} />
              <Row label="Blocked Senders" value={String(user.door._count.blockedSenders)} />
            </tbody>
          </table>

          {user.door.settings && (
            <>
              <h3>Door Settings</h3>
              <table style={{ borderCollapse: 'collapse' }}>
                <tbody>
                  <Row label="Weekly Cap" value={user.door.settings.weeklyRequestCap?.toString() ?? 'No limit'} />
                  <Row label="Reveal Method" value={user.door.settings.revealMethod} />
                  <Row label="Auto-Reply" value={user.door.settings.autoReplyEnabled ? 'Yes' : 'No'} />
                  <Row label="Notify New Request" value={user.door.settings.notifyNewRequest ? 'Yes' : 'No'} />
                  <Row label="Digest" value={user.door.settings.notifyDigest ? 'Yes' : 'No'} />
                </tbody>
              </table>
            </>
          )}
        </>
      )}
    </main>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <tr style={{ borderBottom: '1px solid #eee' }}>
      <td style={{ padding: '0.5rem', fontWeight: 'bold', verticalAlign: 'top', whiteSpace: 'nowrap' }}>{label}</td>
      <td style={{ padding: '0.5rem' }}>{value}</td>
    </tr>
  );
}
