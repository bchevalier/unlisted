'use client';

import React, { FormEvent, useState } from 'react';
import { DIRECT_PRESET_METADATA } from '../../features/direct/preset-metadata';

type ExternalProviderAuthFormProps = {
  mode?: 'signup' | 'login';
  next?: string;
};

export function ExternalProviderAuthForm({ mode = 'signup', next }: ExternalProviderAuthFormProps) {
  const [provider, setProvider] = useState<'GOOGLE' | 'APPLE' | 'LINKEDIN' | 'PRIVY'>('GOOGLE');
  const [token, setToken] = useState('dev-token');
  const [preset, setPreset] = useState<(typeof DIRECT_PRESET_METADATA)[number]['value']>('CREATOR');
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setSuccess(null);
    setLoading(true);

    const form = event.currentTarget;
    const formData = new FormData(form);

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
          preset: String(formData.get('preset') ?? 'CREATOR'),
          mode,
          next,
        })
      });

      const payload = (await response.json()) as { ok: boolean; error?: string; keeper?: { email: string } };
      if (!response.ok || !payload.ok) {
        setError(payload.error ?? 'Could not continue with provider');
        setLoading(false);
        return;
      }

      setSuccess(`Provider account linked for ${payload.keeper?.email ?? 'keeper'}.`);
      setLoading(false);
    } catch {
      setError('Unexpected error while starting provider auth');
      setLoading(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="auth-form auth-form--compact">
      <label style={{ display: 'none' }}>
        Website
        <input name="website" type="text" autoComplete="off" tabIndex={-1} />
      </label>

      <fieldset>
        <legend>Choose your starting setup</legend>
        <div className="auth-form__preset-grid">
          {DIRECT_PRESET_METADATA.map((option) => (
            <label key={option.value} className="auth-form__preset-option">
              <input
                type="radio"
                name="preset"
                value={option.value}
                checked={preset === option.value}
                onChange={() => setPreset(option.value)}
              />
              <strong>{option.label}</strong>
              <span>{option.copy}</span>
            </label>
          ))}
        </div>
      </fieldset>

      <label>
        Provider
        <select value={provider} onChange={(event) => setProvider(event.target.value as typeof provider)}>
          <option value="GOOGLE">Google</option>
          <option value="APPLE">Apple</option>
          <option value="LINKEDIN">LinkedIn</option>
          <option value="PRIVY">Privy</option>
        </select>
      </label>

      <label>
        Provider token (dev only)
        <input value={token} onChange={(event) => setToken(event.target.value)} />
      </label>

      <label>
        Name
        <input name="name" type="text" maxLength={120} />
      </label>

      <label>
        Desired door slug
        <input name="desiredSlug" type="text" placeholder="john" />
      </label>

      <p className="auth-form__hint">
        Provider signups also start with a preset, so your first door already matches the kind of inbound you want.
      </p>

      <button type="submit" disabled={loading}>
        {loading ? 'Continuing…' : 'Continue with provider'}
      </button>

      {error ? <p className="knock-form__error">{error}</p> : null}
      {success ? <p className="knock-form__success">{success}</p> : null}
    </form>
  );
}
