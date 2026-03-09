'use client';

import { useState, FormEvent } from 'react';
import { useRouter } from 'next/navigation';

export function AdminLoginForm() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const res = await fetch('/api/admin/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });

      if (!res.ok) {
        const data = await res.json();
        setError(data.error ?? 'Login failed');
        return;
      }

      router.push('/admin');
      router.refresh();
    } catch {
      setError('Network error');
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} style={{ maxWidth: '400px' }}>
      <h1>Knokio Admin</h1>

      {error && <p style={{ color: 'red' }}>{error}</p>}

      <div style={{ marginBottom: '1rem' }}>
        <label htmlFor="admin-email" style={{ display: 'block', marginBottom: '0.25rem' }}>
          Email
        </label>
        <input
          id="admin-email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          style={{ width: '100%', padding: '0.5rem' }}
        />
      </div>

      <div style={{ marginBottom: '1rem' }}>
        <label htmlFor="admin-password" style={{ display: 'block', marginBottom: '0.25rem' }}>
          Password
        </label>
        <input
          id="admin-password"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          style={{ width: '100%', padding: '0.5rem' }}
        />
      </div>

      <button type="submit" disabled={loading} style={{ padding: '0.5rem 1.5rem' }}>
        {loading ? 'Logging in…' : 'Log in'}
      </button>
    </form>
  );
}
