import type { ReactNode } from 'react';

type AdminLayoutProps = {
  children: ReactNode;
};

/**
 * Admin layout.
 *
 * Authentication is enforced by:
 *  1. Edge middleware (middleware.ts) — structural cookie check + redirect
 *  2. API route handlers — full HMAC session verification
 *  3. Individual page components — server-side session check (e.g., login page)
 */
export default function AdminLayout({ children }: AdminLayoutProps) {
  return (
    <div style={{ maxWidth: '1200px', margin: '0 auto', padding: '1rem' }}>
      {children}
    </div>
  );
}
