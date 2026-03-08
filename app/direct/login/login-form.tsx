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
  const [email, setEmail] = useState('');
  const [challengeToken, setChallengeToken] = useState<string | null>(null);
  const [twoFactorCode, setTwoFactorCode] = useState('');
  const [emailVerificationRequired, setEmailVerificationRequired] = useState(false);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setLoading(true);
    setEmailVerificationRequired(false);

    const form = event.currentTarget;
    const formData = new FormData(form);
    const submittedEmail = String(formData.get('email') ?? '').trim();
    setEmail(submittedEmail);

    try {
      const response = await fetch('/api/direct/auth/login', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          email: submittedEmail,
          password: String(formData.get('password') ?? ''),
          website: String(formData.get('website') ?? '')
        })
      });

      const payload = (await response.json()) as {
        ok: boolean;
        error?: string;
        requiresTwoFactor?: boolean;
        challengeToken?: string;
        emailVerificationRequired?: boolean;
      };

      if (!response.ok || !payload.ok) {
        setEmailVerificationRequired(Boolean(payload.emailVerificationRequired));
        setError(payload.error ?? 'Login failed');
        setLoading(false);
        return;
      }

      if (payload.requiresTwoFactor && payload.challengeToken) {
        setChallengeToken(payload.challengeToken);
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

  async function verifyTwoFactor() {
    if (!challengeToken) {
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/direct/auth/2fa/verify', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          challengeToken,
          code: twoFactorCode
        })
      });

      const payload = (await response.json()) as { ok: boolean; error?: string };
      if (!response.ok || !payload.ok) {
        setError(payload.error ?? '2FA verification failed');
        setLoading(false);
        return;
      }

      router.push(next);
      router.refresh();
    } catch {
      setError('Unexpected error during 2FA verification');
      setLoading(false);
    }
  }

  async function resendVerification() {
    if (!email) {
      setError('Enter your email first');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/direct/auth/email/verify/resend', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ email })
      });

      const payload = (await response.json()) as {
        ok: boolean;
        error?: string;
        debug?: { emailVerificationToken?: string };
      };

      if (!response.ok || !payload.ok) {
        setError(payload.error ?? 'Could not resend verification email');
        setLoading(false);
        return;
      }

      const debugToken = payload.debug?.emailVerificationToken;
      if (debugToken) {
        setError(`Dev token (verify email): ${debugToken}`);
      } else {
        setError('Verification email resent');
      }
      setLoading(false);
    } catch {
      setError('Unexpected error while resending verification email');
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
        Email
        <input name="email" type="email" required disabled={Boolean(challengeToken)} />
      </label>

      {!challengeToken ? (
        <>
          <label>
            Password
            <input name="password" type="password" required />
          </label>
          <button type="submit" disabled={loading}>
            {loading ? 'Signing in…' : 'Sign in'}
          </button>
        </>
      ) : (
        <>
          <label>
            Two-factor code (or recovery code)
            <input
              name="twoFactorCode"
              type="text"
              required
              value={twoFactorCode}
              onChange={(event) => setTwoFactorCode(event.target.value)}
            />
          </label>
          <button type="button" disabled={loading} onClick={verifyTwoFactor}>
            {loading ? 'Verifying…' : 'Verify 2FA'}
          </button>
        </>
      )}

      {emailVerificationRequired ? (
        <button type="button" onClick={resendVerification} disabled={loading}>
          Resend verification email
        </button>
      ) : null}

      {error ? <p className="knock-form__error">{error}</p> : null}
    </form>
  );
}
