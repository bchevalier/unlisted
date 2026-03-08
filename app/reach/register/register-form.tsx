'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

type RegisterFormProps = {
  email: string;
};

export function RegisterForm({ email }: RegisterFormProps) {
  const router = useRouter();
  const [handle, setHandle] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [state, setState] = useState<'idle' | 'loading' | 'error'>('idle');
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setState('loading');
    setError(null);

    try {
      const response = await fetch('/api/reach/actors', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          type: 'HUMAN',
          handle: handle.trim(),
          displayName: displayName.trim(),
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error ?? `Registration failed (HTTP ${response.status})`);
        setState('error');
        return;
      }

      // Success — redirect to Reach dashboard.
      router.push('/reach');
    } catch {
      setError('Network error');
      setState('error');
    }
  }

  const disabled = state === 'loading';

  return (
    <form onSubmit={handleSubmit} style={{ maxWidth: 400 }}>
      <p>
        Registering as: <strong>{email}</strong>
      </p>

      <div style={{ marginBottom: 12 }}>
        <label htmlFor="handle">
          <strong>Handle</strong> (2–64 chars, alphanumeric/dots/hyphens)
        </label>
        <br />
        <input
          id="handle"
          type="text"
          value={handle}
          onChange={(e) => setHandle(e.target.value)}
          pattern="^[a-zA-Z0-9][a-zA-Z0-9._-]*$"
          minLength={2}
          maxLength={64}
          required
          disabled={disabled}
          placeholder="your-handle"
          style={{ width: '100%', padding: '6px 8px', marginTop: 4 }}
        />
      </div>

      <div style={{ marginBottom: 12 }}>
        <label htmlFor="displayName">
          <strong>Display Name</strong>
        </label>
        <br />
        <input
          id="displayName"
          type="text"
          value={displayName}
          onChange={(e) => setDisplayName(e.target.value)}
          minLength={1}
          maxLength={200}
          required
          disabled={disabled}
          placeholder="Your Name"
          style={{ width: '100%', padding: '6px 8px', marginTop: 4 }}
        />
      </div>

      <button type="submit" disabled={disabled}>
        {state === 'loading' ? 'Registering…' : 'Register'}
      </button>

      {error && (
        <p style={{ color: '#d32f2f', marginTop: 8 }}>Error: {error}</p>
      )}
    </form>
  );
}
