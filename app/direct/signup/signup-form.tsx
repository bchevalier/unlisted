'use client';

import React, { FormEvent, useState } from 'react';
import { DIRECT_PRESET_METADATA } from '../../../features/direct/preset-metadata';

type SignupPreset = (typeof DIRECT_PRESET_METADATA)[number];

type SignupSuccessState = {
  email: string;
  doorSlug: string;
  doorPlan: string;
  preset: SignupPreset;
  verificationToken: string | null;
};

export function SignupLaunchPanel({
  email,
  doorSlug,
  doorPlan,
  preset,
  verificationToken,
}: SignupSuccessState) {
  return (
    <section className="auth-form__success-panel" aria-label="Launch your first Direct door">
      <p className="auth-form__launch-eyebrow">Account created</p>
      <h3>Your first Direct door is ready to launch</h3>
      <p>
        <strong>{email}</strong> now has <strong>@{doorSlug}</strong> on the <strong>{doorPlan}</strong> plan.
      </p>

      <div className="auth-form__success-grid">
        <div>
          <p className="auth-form__success-label">Seeded setup</p>
          <ul>
            {preset.launch.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </div>
        <div>
          <p className="auth-form__success-label">Starting categories</p>
          <div className="direct-chip-row">
            {preset.categories.map((category) => (
              <span key={category}>{category}</span>
            ))}
          </div>
        </div>
      </div>

      <div className="auth-form__success-actions inbox-links">
        <a href={`/u/${doorSlug}`} target="_blank" rel="noreferrer">
          Open public door
        </a>
        <a href="/direct/login">Log in to inbox</a>
        <a href={`/direct/settings?slug=${doorSlug}`}>Review settings</a>
      </div>

      <section className="auth-form__checklist" aria-label="First-run checklist">
        <p className="auth-form__success-label">First-run checklist</p>
        <ul>
          <li>Open your public door and confirm the right categories are visible.</li>
          <li>Verify your email, then log in and confirm inbox + settings access.</li>
          <li>Check that caps, routing, and private-contact protection match your expectations.</li>
        </ul>
      </section>

      {verificationToken ? <p className="auth-form__hint">Verify your email now, then log in to use inbox and settings.</p> : null}
    </section>
  );
}

export function SignupForm() {
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [verificationToken, setVerificationToken] = useState<string | null>(null);
  const [launchState, setLaunchState] = useState<SignupSuccessState | null>(null);
  const [preset, setPreset] = useState<(typeof DIRECT_PRESET_METADATA)[number]['value']>('CREATOR');
  const selectedPreset = DIRECT_PRESET_METADATA.find((option) => option.value === preset) ?? DIRECT_PRESET_METADATA[0];

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setLoading(true);
    setVerificationToken(null);
    setLaunchState(null);

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
          preset: String(formData.get('preset') ?? 'CREATOR'),
          website: String(formData.get('website') ?? ''),
        })
      });

      const payload = (await response.json()) as {
        ok: boolean;
        error?: string;
        emailVerificationRequired?: boolean;
        keeper?: { email?: string; doorSlug?: string | null; doorPlan?: string | null };
        debug?: { emailVerificationToken?: string };
      };

      if (!response.ok || !payload.ok) {
        setError(payload.error ?? 'Signup failed');
        setLoading(false);
        return;
      }

      const nextVerificationToken = payload.debug?.emailVerificationToken ?? null;
      setVerificationToken(nextVerificationToken);
      setLaunchState({
        email: payload.keeper?.email ?? String(formData.get('email') ?? ''),
        doorSlug: payload.keeper?.doorSlug ?? String(formData.get('desiredSlug') ?? 'door'),
        doorPlan: payload.keeper?.doorPlan ?? 'FREE',
        preset: selectedPreset,
        verificationToken: nextVerificationToken,
      });
      setError('Account created. Verify your email before logging in.');
      setLoading(false);
      form.reset();
      setPreset('CREATOR');
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

      <section className="auth-form__launch-preview" aria-label="Default setup preview">
        <p className="auth-form__launch-eyebrow">Your first door launches with</p>
        <h3>{selectedPreset.label}</h3>
        <ul>
          {selectedPreset.launch.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      </section>

      <p className="auth-form__hint">
        Start on Free with a preset that already matches your kind of inbound. You can refine categories and rules after
        signup.
      </p>
      <button type="submit" disabled={loading}>
        {loading ? 'Creating…' : 'Create account'}
      </button>

      {launchState ? <SignupLaunchPanel {...launchState} /> : null}

      {verificationToken ? (
        <button type="button" onClick={verifyEmailNow} disabled={loading}>
          Dev-only: verify email now
        </button>
      ) : null}

      {error ? <p className="knock-form__error">{error}</p> : null}
    </form>
  );
}
