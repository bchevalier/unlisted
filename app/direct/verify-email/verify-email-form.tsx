'use client';

import React, { FormEvent, useState } from 'react';

type VerifyEmailFormProps = {
  token: string;
};

export function VerifyEmailForm({ token }: VerifyEmailFormProps) {
  const [value, setValue] = useState(token);
  const [message, setMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage(null);
    setLoading(true);

    try {
      const response = await fetch('/api/direct/auth/email/verify/confirm', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ token: value })
      });

      const payload = (await response.json()) as { ok: boolean; error?: string };
      if (!response.ok || !payload.ok) {
        setMessage(payload.error ?? 'Verification failed');
        setLoading(false);
        return;
      }

      setMessage('Email verified. You can now login.');
      setLoading(false);
    } catch {
      setMessage('Unexpected error during verification');
      setLoading(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="auth-form">
      <label>
        Verification token
        <input value={value} onChange={(event) => setValue(event.target.value)} required />
      </label>
      <button type="submit" disabled={loading}>
        {loading ? 'Verifying…' : 'Verify email'}
      </button>
      {message ? <p className="knock-form__error">{message}</p> : null}
    </form>
  );
}
