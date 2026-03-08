'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

type WebhookActionsProps = {
  webhookId: string;
  actorHandle: string;
  isActive: boolean;
};

type ActionState = 'idle' | 'loading' | 'error';

/**
 * Inline actions for a webhook card: toggle active/inactive, ping, and delete.
 */
export function WebhookActions({ webhookId, actorHandle, isActive }: WebhookActionsProps) {
  const router = useRouter();
  const [state, setState] = useState<ActionState>('idle');
  const [error, setError] = useState<string | null>(null);
  const [pingResult, setPingResult] = useState<string | null>(null);

  async function toggleActive() {
    setState('loading');
    setError(null);
    setPingResult(null);
    try {
      const response = await fetch(
        `/api/reach/actors/${actorHandle}/webhooks/${webhookId}`,
        {
          method: 'PATCH',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ isActive: !isActive }),
        },
      );
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

  async function ping() {
    setState('loading');
    setError(null);
    setPingResult(null);
    try {
      const response = await fetch(
        `/api/reach/actors/${actorHandle}/webhooks/${webhookId}`,
        {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ action: 'ping' }),
        },
      );
      const data = await response.json().catch(() => ({ error: 'Unknown error' }));
      if (!response.ok) {
        setError(data.error ?? `Failed (HTTP ${response.status})`);
        setState('error');
        return;
      }
      setPingResult(data.ping?.status === 'ok' ? '✓ Ping successful' : `Ping returned: ${JSON.stringify(data.ping)}`);
      setState('idle');
    } catch {
      setError('Network error');
      setState('error');
    }
  }

  async function deleteWebhook() {
    if (!confirm('Delete this webhook? This cannot be undone.')) return;
    setState('loading');
    setError(null);
    setPingResult(null);
    try {
      const response = await fetch(
        `/api/reach/actors/${actorHandle}/webhooks/${webhookId}`,
        { method: 'DELETE' },
      );
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

  const disabled = state === 'loading';

  return (
    <div className="policy-inline-actions">
      <button onClick={toggleActive} disabled={disabled} className="policy-btn-toggle">
        {state === 'loading' ? '…' : isActive ? 'Deactivate' : 'Activate'}
      </button>
      <button onClick={ping} disabled={disabled || !isActive} className="policy-btn-toggle">
        {state === 'loading' ? '…' : 'Ping'}
      </button>
      <button onClick={deleteWebhook} disabled={disabled} className="policy-btn-delete">
        {state === 'loading' ? '…' : 'Delete'}
      </button>
      {pingResult && (
        <span style={{ color: '#2e7d32', fontSize: '13px', marginLeft: 8 }}>{pingResult}</span>
      )}
      {error && (
        <span style={{ color: '#d32f2f', fontSize: '13px', marginLeft: 8 }}>{error}</span>
      )}
    </div>
  );
}
