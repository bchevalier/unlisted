'use client';

import { FormEvent, useState } from 'react';

export function PasswordRecoveryForm() {
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [resetToken, setResetToken] = useState<string>('');

  async function requestReset(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setLoading(true);

    const formData = new FormData(event.currentTarget);

    try {
      const response = await fetch('/api/direct/auth/password/reset/request', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          email: String(formData.get('resetEmail') ?? '')
        })
      });

      const payload = (await response.json()) as {
        ok: boolean;
        error?: string;
        debug?: { passwordResetToken?: string };
      };

      if (!response.ok || !payload.ok) {
        setError(payload.error ?? 'Could not request reset');
        setLoading(false);
        return;
      }

      if (payload.debug?.passwordResetToken) {
        setResetToken(payload.debug.passwordResetToken);
        setError(`Dev reset token: ${payload.debug.passwordResetToken}`);
      } else {
        setError('If the account exists, a reset email has been sent.');
      }

      setLoading(false);
    } catch {
      setError('Unexpected error while requesting reset');
      setLoading(false);
    }
  }

  async function confirmReset(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setLoading(true);

    const formData = new FormData(event.currentTarget);

    try {
      const response = await fetch('/api/direct/auth/password/reset/confirm', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          token: String(formData.get('token') ?? ''),
          newPassword: String(formData.get('newPassword') ?? '')
        })
      });

      const payload = (await response.json()) as { ok: boolean; error?: string };
      if (!response.ok || !payload.ok) {
        setError(payload.error ?? 'Could not reset password');
        setLoading(false);
        return;
      }

      setError('Password reset complete. Login with the new password.');
      setResetToken('');
      setLoading(false);
    } catch {
      setError('Unexpected error while confirming reset');
      setLoading(false);
    }
  }

  return (
    <section className="auth-form">
      <h3>Password recovery</h3>
      <form onSubmit={requestReset}>
        <label>
          Email
          <input name="resetEmail" type="email" required />
        </label>
        <button type="submit" disabled={loading}>
          {loading ? 'Requesting…' : 'Request reset'}
        </button>
      </form>

      <form onSubmit={confirmReset}>
        <label>
          Reset token
          <input name="token" type="text" required defaultValue={resetToken} />
        </label>
        <label>
          New password
          <input name="newPassword" type="password" minLength={10} required />
        </label>
        <button type="submit" disabled={loading}>
          {loading ? 'Saving…' : 'Confirm reset'}
        </button>
      </form>

      {error ? <p className="knock-form__error">{error}</p> : null}
    </section>
  );
}
