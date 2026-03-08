'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

// ---------------------------------------------------------------------------
// Block actor form (add to blocklist)
// ---------------------------------------------------------------------------

export function BlockActorForm() {
  const router = useRouter();
  const [handle, setHandle] = useState('');
  const [reason, setReason] = useState('');
  const [state, setState] = useState<'idle' | 'loading' | 'error'>('idle');
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!handle.trim()) return;

    setState('loading');
    setError(null);

    try {
      const payload: Record<string, string> = { blockedHandle: handle.trim() };
      if (reason.trim()) payload.reason = reason.trim();

      const response = await fetch('/api/reach/blocklist', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await response.json().catch(() => ({ error: 'Unknown error' }));

      if (!response.ok) {
        setError(data.error ?? `Failed (HTTP ${response.status})`);
        setState('error');
        return;
      }

      setHandle('');
      setReason('');
      setState('idle');
      router.refresh();
    } catch {
      setError('Network error');
      setState('error');
    }
  }

  const disabled = state === 'loading';

  return (
    <form onSubmit={handleSubmit} style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'flex-end' }}>
      <div>
        <label htmlFor="block-handle" style={{ display: 'block', fontSize: 13, marginBottom: 4 }}>
          <strong>Handle</strong>
        </label>
        <input
          id="block-handle"
          type="text"
          value={handle}
          onChange={(e) => setHandle(e.target.value)}
          placeholder="actor-handle"
          minLength={2}
          maxLength={64}
          required
          disabled={disabled}
          style={{ padding: '6px 8px' }}
        />
      </div>
      <div>
        <label htmlFor="block-reason" style={{ display: 'block', fontSize: 13, marginBottom: 4 }}>
          <strong>Reason</strong> <span style={{ color: '#999' }}>(optional)</span>
        </label>
        <input
          id="block-reason"
          type="text"
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder="Spam, harassment, etc."
          maxLength={500}
          disabled={disabled}
          style={{ padding: '6px 8px' }}
        />
      </div>
      <button type="submit" disabled={disabled}>
        {state === 'loading' ? 'Blocking…' : 'Block'}
      </button>
      {error && <span style={{ color: '#d32f2f', fontSize: 13 }}>{error}</span>}
    </form>
  );
}

// ---------------------------------------------------------------------------
// Unblock action (per-entry)
// ---------------------------------------------------------------------------

type BlocklistActionsProps = {
  blockedHandle: string;
};

export function BlocklistActions({ blockedHandle }: BlocklistActionsProps) {
  const router = useRouter();
  const [state, setState] = useState<'idle' | 'loading' | 'error'>('idle');
  const [error, setError] = useState<string | null>(null);

  async function unblock() {
    if (!confirm(`Unblock @${blockedHandle}?`)) return;
    setState('loading');
    setError(null);

    try {
      const response = await fetch('/api/reach/blocklist', {
        method: 'DELETE',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ blockedHandle }),
      });

      if (!response.ok) {
        const data = await response.json().catch(() => ({ error: 'Unknown error' }));
        setError(data.error ?? `Failed (HTTP ${response.status})`);
        setState('error');
        return;
      }

      setState('idle');
      router.refresh();
    } catch {
      setError('Network error');
      setState('error');
    }
  }

  return (
    <div className="policy-inline-actions">
      <button
        onClick={unblock}
        disabled={state === 'loading'}
        className="policy-btn-toggle"
      >
        {state === 'loading' ? '…' : 'Unblock'}
      </button>
      {error && <span style={{ color: '#d32f2f', fontSize: 13, marginLeft: 8 }}>{error}</span>}
    </div>
  );
}
