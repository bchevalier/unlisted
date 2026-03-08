'use client';

import { FormEvent, useState } from 'react';
import { useRouter } from 'next/navigation';

export function SignupForm() {
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
      const response = await fetch('/api/direct/auth/signup', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          name: String(formData.get('name') ?? ''),
          email: String(formData.get('email') ?? ''),
          password: String(formData.get('password') ?? ''),
          desiredSlug: String(formData.get('desiredSlug') ?? ''),
          plan: String(formData.get('plan') ?? 'FREE')
        })
      });

      const payload = (await response.json()) as { ok: boolean; error?: string; keeper?: { doorSlug?: string } };
      if (!response.ok || !payload.ok) {
        setError(payload.error ?? 'Signup failed');
        setLoading(false);
        return;
      }

      const next = payload.keeper?.doorSlug ? `/direct/inbox?slug=${payload.keeper.doorSlug}` : '/direct/inbox';
      router.push(next);
      router.refresh();
    } catch {
      setError('Unexpected error during signup');
      setLoading(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="auth-form">
      <label>
        Name
        <input name="name" type="text" maxLength={120} />
      </label>
      <label>
        Email
        <input name="email" type="email" required />
      </label>
      <label>
        Password
        <input name="password" type="password" minLength={10} required />
      </label>
      <label>
        Desired door slug
        <input name="desiredSlug" type="text" placeholder="john" />
      </label>
      <label>
        Door plan
        <select name="plan" defaultValue="FREE">
          <option value="FREE">Free — capped inbox volume</option>
          <option value="PAID">Paid — unlimited paid reaches</option>
        </select>
      </label>
      <button type="submit" disabled={loading}>
        {loading ? 'Creating…' : 'Create account'}
      </button>
      {error ? <p className="knock-form__error">{error}</p> : null}
    </form>
  );
}
