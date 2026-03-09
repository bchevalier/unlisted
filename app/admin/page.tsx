import { requireAdminSession } from '../../features/direct/server/admin-session';
import { getDashboardStats } from '../../features/direct/server/admin';
import { AdminNav } from './admin-nav';

export default async function AdminDashboardPage() {
  const session = await requireAdminSession();
  const stats = await getDashboardStats();

  return (
    <main>
      <AdminNav email={session.email} />

      <h1>Dashboard</h1>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem', marginTop: '1rem' }}>
        <StatCard label="Total Users" value={stats.totalUsers} />
        <StatCard label="Total Doors" value={stats.totalDoors} />
        <StatCard label="Total Requests" value={stats.totalRequests} />
        <StatCard label="Pending Requests" value={stats.pendingRequests} highlight={stats.pendingRequests > 0} />
        <StatCard label="Open Abuse Reports" value={stats.openAbuseReports} highlight={stats.openAbuseReports > 0} />
      </div>
    </main>
  );
}

function StatCard({ label, value, highlight }: { label: string; value: number; highlight?: boolean }) {
  return (
    <div
      style={{
        border: '1px solid #ccc',
        borderRadius: '8px',
        padding: '1.25rem',
        background: highlight ? '#fff3cd' : '#f9f9f9',
      }}
    >
      <div style={{ fontSize: '0.85rem', color: '#666' }}>{label}</div>
      <div style={{ fontSize: '2rem', fontWeight: 'bold' }}>{value}</div>
    </div>
  );
}
