'use client';

import React, { useState } from 'react';

type TwoFactorPanelProps = {
  email: string;
  emailVerified: boolean;
  twoFactorEnabled: boolean;
};

export function TwoFactorPanel({ email, emailVerified, twoFactorEnabled }: TwoFactorPanelProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [otpauthUrl, setOtpauthUrl] = useState<string | null>(null);
  const [secret, setSecret] = useState<string | null>(null);
  const [setupCode, setSetupCode] = useState('');
  const [recoveryCodes, setRecoveryCodes] = useState<string[] | null>(null);

  async function startSetup() {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/direct/auth/2fa/setup/start', { method: 'POST' });
      const payload = (await response.json()) as {
        ok: boolean;
        error?: string;
        setup?: { secret: string; otpauthUrl: string };
      };

      if (!response.ok || !payload.ok || !payload.setup) {
        setError(payload.error ?? 'Could not start 2FA setup');
        setLoading(false);
        return;
      }

      setSecret(payload.setup.secret);
      setOtpauthUrl(payload.setup.otpauthUrl);
      setRecoveryCodes(null);
      setLoading(false);
    } catch {
      setError('Unexpected error while starting 2FA setup');
      setLoading(false);
    }
  }

  async function confirmSetup() {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/direct/auth/2fa/setup/confirm', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ code: setupCode })
      });

      const payload = (await response.json()) as { ok: boolean; error?: string; recoveryCodes?: string[] };
      if (!response.ok || !payload.ok) {
        setError(payload.error ?? 'Could not confirm 2FA setup');
        setLoading(false);
        return;
      }

      setRecoveryCodes(payload.recoveryCodes ?? []);
      setError('2FA enabled successfully. Save recovery codes now.');
      setLoading(false);
      window.location.reload();
    } catch {
      setError('Unexpected error while confirming 2FA setup');
      setLoading(false);
    }
  }

  async function disable() {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/direct/auth/2fa/disable', { method: 'POST' });
      const payload = (await response.json()) as { ok: boolean; error?: string };
      if (!response.ok || !payload.ok) {
        setError(payload.error ?? 'Could not disable 2FA');
        setLoading(false);
        return;
      }

      setError('2FA disabled');
      setLoading(false);
      window.location.reload();
    } catch {
      setError('Unexpected error while disabling 2FA');
      setLoading(false);
    }
  }

  return (
    <article className="settings-card">
      <h2>Account security</h2>
      <p>
        Email: <strong>{email}</strong> ({emailVerified ? 'verified' : 'not verified'})
      </p>
      <p>
        2FA status: <strong>{twoFactorEnabled ? 'enabled' : 'disabled'}</strong>
      </p>

      {!twoFactorEnabled ? (
        <>
          <button type="button" onClick={startSetup} disabled={loading || !emailVerified}>
            Start 2FA setup
          </button>
          {!emailVerified ? <p>Verify your email before enabling 2FA.</p> : null}
        </>
      ) : (
        <button type="button" onClick={disable} disabled={loading}>
          Disable 2FA
        </button>
      )}

      {otpauthUrl ? (
        <div>
          <p>Scan this in your authenticator app:</p>
          <code>{otpauthUrl}</code>
          <p>Manual secret: {secret}</p>
          <label>
            Setup code
            <input value={setupCode} onChange={(event) => setSetupCode(event.target.value)} />
          </label>
          <button type="button" onClick={confirmSetup} disabled={loading || setupCode.trim().length === 0}>
            Confirm 2FA setup
          </button>
        </div>
      ) : null}

      {recoveryCodes?.length ? (
        <div>
          <h3>Recovery codes</h3>
          <ul>
            {recoveryCodes.map((code) => (
              <li key={code}>
                <code>{code}</code>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {error ? <p className="knock-form__error">{error}</p> : null}
    </article>
  );
}
