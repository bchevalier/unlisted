'use client';

import React, { FormEvent, useState } from 'react';

type ResetPasswordFormProps = {
  token: string;
};

export function ResetPasswordForm({ token }: ResetPasswordFormProps) {
  const [value, setValue] = useState(token);
  const [message, setMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage(null);
    setLoading(true);

    const formData = new FormData(event.currentTarget);

    try {
      const response = await fetch('/api/direct/auth/password/reset/confirm', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          token: value,
          newPassword: String(formData.get('newPassword') ?? '')
        })
      });

      const payload = (await response.json()) as { ok: boolean; error?: string };
      if (!response.ok || !payload.ok) {
        setMessage(payload.error ?? 'Password reset failed');
        setLoading(false);
        return;
      }

      setMessage('Password reset complete. You can now login.');
      setLoading(false);
    } catch {
      setMessage('Unexpected error during password reset');
      setLoading(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="auth-form">
      <label>
        Reset token
        <input value={value} onChange={(event) => setValue(event.target.value)} required />
      </label>
      <label>
        New password
        <input name="newPassword" type="password" minLength={10} required />
      </label>
      <button type="submit" disabled={loading}>
        {loading ? 'Saving…' : 'Reset password'}
      </button>
      {message ? <p className="knock-form__error">{message}</p> : null}
    </form>
  );
}
