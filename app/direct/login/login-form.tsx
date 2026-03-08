'use client';

import { FormEvent, useState } from 'react';
import { useRouter } from 'next/navigation';

type LoginFormProps = {
  next: string;
};

export function LoginForm({ next }: LoginFormProps) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setLoading(true);

    const form = event.currentTarget;
    const formData = new FormData(form);

    try {
      const response = await fetch('/api/direct/auth/login', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          email: String(formData.get('email') ?? ''),
          password: String(formData.get('password') ?? '')
        })
      });

      const payload = (await response.json()) as { ok: boolean; error?: string };
      if (!response.ok || !payload.ok) {
        setError(payload.error ?? 'Login failed');
        setLoading(false);
        return;
      }

      router.push(next);
      router.refresh();
    } catch {
      setError('Unexpected error during login');
      setLoading(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="auth-form">
      <label>
        Email
        <input name="email" type="email" required />
      </label>
      <label>
        Password
        <input name="password" type="password" required />
      </label>
      <button type="submit" disabled={loading}>
        {loading ? 'Signing in…' : 'Sign in'}
      </button>
      {error ? <p className="knock-form__error">{error}</p> : null}
    </form>
  );
}
