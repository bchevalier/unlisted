'use client';

import { FormEvent, useState } from 'react';
import { useRouter } from 'next/navigation';

type ExternalProviderAuthFormProps = {
  mode: 'login' | 'signup';
  next?: string;
};

type ProviderName = 'GOOGLE' | 'APPLE' | 'LINKEDIN' | 'PRIVY';

export function ExternalProviderAuthForm({ mode, next }: ExternalProviderAuthFormProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError(null);

    const form = event.currentTarget;
    const formData = new FormData(form);

    const provider = String(formData.get('provider') ?? 'GOOGLE') as ProviderName;
    const token = String(formData.get('token') ?? '').trim();

    try {
      const response = await fetch('/api/direct/auth/provider', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          provider,
          token,
          website: String(formData.get('website') ?? ''),
          name: String(formData.get('name') ?? '').trim() || undefined,
          desiredSlug: String(formData.get('desiredSlug') ?? '').trim() || undefined,
          plan: String(formData.get('plan') ?? 'FREE')
        })
      });

      const payload = (await response.json()) as {
        ok: boolean;
        error?: string;
        keeper?: { doorSlug?: string };
      };

      if (!response.ok || !payload.ok) {
        setError(payload.error ?? 'Provider authentication failed');
        setLoading(false);
        return;
      }

      const fallback = payload.keeper?.doorSlug
        ? `/direct/inbox?slug=${encodeURIComponent(payload.keeper.doorSlug)}`
        : '/direct/inbox';

      router.push(next ?? fallback);
      router.refresh();
    } catch {
      setError('Unexpected error during provider authentication');
      setLoading(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="auth-form">
      <h3>{mode === 'signup' ? 'Or create with provider token' : 'Or sign in with provider token'}</h3>
      <p>
        Use a verified ID token (Google/Apple/LinkedIn) or a Privy access token from your auth client.
      </p>

      <label style={{ display: 'none' }}>
        Website
        <input name="website" type="text" autoComplete="off" tabIndex={-1} />
      </label>

      <label>
        Provider
        <select name="provider" defaultValue="GOOGLE">
          <option value="GOOGLE">Google</option>
          <option value="APPLE">Apple</option>
          <option value="LINKEDIN">LinkedIn</option>
          <option value="PRIVY">Privy</option>
        </select>
      </label>

      <label>
        Token
        <textarea name="token" rows={4} required placeholder="Paste provider token" />
      </label>

      {mode === 'signup' ? (
        <>
          <label>
            Optional display name override
            <input name="name" type="text" maxLength={120} />
          </label>
          <label>
            Optional desired door slug
            <input name="desiredSlug" type="text" placeholder="john" />
          </label>
          <label>
            Door plan
            <select name="plan" defaultValue="FREE">
              <option value="FREE">Free — capped inbox volume</option>
              <option value="PAID">Paid — unlimited paid reaches</option>
            </select>
          </label>
        </>
      ) : null}

      <button type="submit" disabled={loading}>
        {loading ? 'Working…' : mode === 'signup' ? 'Create account with provider' : 'Sign in with provider'}
      </button>

      {error ? <p className="knock-form__error">{error}</p> : null}
    </form>
  );
}
