'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';

type AdminNavProps = {
  email: string;
};

const NAV_ITEMS = [
  { href: '/admin', label: 'Dashboard' },
  { href: '/admin/users', label: 'Users' },
  { href: '/admin/doors', label: 'Doors' },
  { href: '/admin/requests', label: 'Requests' },
  { href: '/admin/abuse-reports', label: 'Abuse Reports' },
];

export function AdminNav({ email }: AdminNavProps) {
  const pathname = usePathname();
  const router = useRouter();

  async function handleLogout() {
    await fetch('/api/admin/logout', { method: 'POST' });
    router.push('/admin/login');
    router.refresh();
  }

  return (
    <nav style={{ display: 'flex', gap: '1rem', alignItems: 'center', marginBottom: '1.5rem', flexWrap: 'wrap', borderBottom: '1px solid #ccc', paddingBottom: '0.75rem' }}>
      <strong>Knokio Admin</strong>
      {NAV_ITEMS.map((item) => (
        <Link
          key={item.href}
          href={item.href}
          style={{
            fontWeight: pathname === item.href ? 'bold' : 'normal',
            textDecoration: pathname === item.href ? 'underline' : 'none',
          }}
        >
          {item.label}
        </Link>
      ))}
      <span style={{ marginLeft: 'auto', fontSize: '0.85rem' }}>
        {email}
        {' · '}
        <button onClick={handleLogout} style={{ border: 'none', background: 'none', cursor: 'pointer', textDecoration: 'underline', color: 'inherit', fontSize: 'inherit' }}>
          Logout
        </button>
      </span>
    </nav>
  );
}
