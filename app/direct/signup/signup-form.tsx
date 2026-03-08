'use client';

import { FormEvent, useState } from 'react';

export function SignupForm() {
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [verificationToken, setVerificationToken] = useState<string | null>(null);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setLoading(true);
    setVerificationToken(null);

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
          plan: String(formData.get('plan') ?? 'FREE'),
          website: String(formData.get('website') ?? '')
        })
      });

      const payload = (await response.json()) as {
        ok: boolean;
        error?: string;
        emailVerificationRequired?: boolean;
        debug?: { emailVerificationToken?: string };
      };

      if (!response.ok || !payload.ok) {
        setError(payload.error ?? 'Signup failed');
        setLoading(false);
        return;
      }

      setVerificationToken(payload.debug?.emailVerificationToken ?? null);
      setError('Account created. Verify your email before logging in.');
      setLoading(false);
      form.reset();
    } catch {
      setError('Unexpected error during signup');
      setLoading(false);
    }
  }

  async function verifyEmailNow() {
    if (!verificationToken) {
      return;
    }

    setLoading(true);

    try {
      const response = await fetch('/api/direct/auth/email/verify/confirm', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ token: verificationToken })
      });

      const payload = (await response.json()) as { ok: boolean; error?: string };
      if (!response.ok || !payload.ok) {
        setError(payload.error ?? 'Could not verify email');
        setLoading(false);
        return;
      }

      setError('Email verified. You can now login.');
      setVerificationToken(null);
      setLoading(false);
    } catch {
      setError('Unexpected error while verifying email');
      setLoading(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="auth-form">
      <label style={{ display: 'none' }}>
        Website
        <input name="website" type="text" autoComplete="off" tabIndex={-1} />
      </label>

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

      {verificationToken ? (
        <button type="button" onClick={verifyEmailNow} disabled={loading}>
          Dev-only: verify email now
        </button>
      ) : null}

      {error ? <p className="knock-form__error">{error}</p> : null}
    </form>
  );
}
