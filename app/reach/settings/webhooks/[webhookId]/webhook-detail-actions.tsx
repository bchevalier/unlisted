'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

type WebhookDetailActionsProps = {
  webhookId: string;
  actorHandle: string;
  isActive: boolean;
  /** When set, renders only a retry button for this specific delivery. */
  retryDeliveryId?: string;
};

type ActionState = 'idle' | 'loading' | 'error';

export function WebhookDetailActions({
  webhookId,
  actorHandle,
  isActive,
  retryDeliveryId,
}: WebhookDetailActionsProps) {
  const router = useRouter();
  const [state, setState] = useState<ActionState>('idle');
  const [error, setError] = useState<string | null>(null);
  const [rotatedSecret, setRotatedSecret] = useState<string | null>(null);
  const [pingResult, setPingResult] = useState<string | null>(null);
  const [retryResult, setRetryResult] = useState<string | null>(null);

  const baseUrl = `/api/reach/actors/${actorHandle}/webhooks/${webhookId}`;

  async function retryDelivery() {
    if (!retryDeliveryId) return;
    setState('loading');
    setError(null);
    setRetryResult(null);
    try {
      const response = await fetch(baseUrl, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ action: 'retry-delivery', deliveryId: retryDeliveryId }),
      });
      const data = await response.json().catch(() => ({ error: 'Unknown error' }));
      if (!response.ok) {
        setError(data.error ?? `Failed (HTTP ${response.status})`);
        setState('error');
        return;
      }
      setRetryResult(
        data.retry?.success
          ? `✓ Retry succeeded (HTTP ${data.retry.httpStatus ?? '?'})`
          : `✗ Retry failed: ${data.retry?.error ?? 'unknown'}`,
      );
      setState('idle');
      router.refresh();
    } catch {
      setError('Network error');
      setState('error');
    }
  }

  // Retry-only mode: render inline retry button for a specific delivery.
  if (retryDeliveryId) {
    const disabled = state === 'loading';
    return (
      <span style={{ display: 'inline-block', marginTop: 4 }}>
        <button
          onClick={retryDelivery}
          disabled={disabled || !isActive}
          className="policy-btn-toggle"
          style={{ fontSize: 12, padding: '2px 8px' }}
        >
          {state === 'loading' ? '…' : '↻ Retry'}
        </button>
        {retryResult && (
          <span style={{ marginLeft: 8, fontSize: 12, color: retryResult.startsWith('✓') ? '#2e7d32' : '#d32f2f' }}>
            {retryResult}
          </span>
        )}
        {error && (
          <span style={{ marginLeft: 8, fontSize: 12, color: '#d32f2f' }}>{error}</span>
        )}
      </span>
    );
  }

  // Full actions mode.
  async function toggleActive() {
    setState('loading');
    setError(null);
    setPingResult(null);
    try {
      const response = await fetch(baseUrl, {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ isActive: !isActive }),
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

  async function rotateSecret() {
    if (!confirm('Rotate signing secret? The old secret will stop working immediately.')) return;
    setState('loading');
    setError(null);
    setRotatedSecret(null);
    setPingResult(null);
    try {
      const response = await fetch(baseUrl, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ action: 'rotate-secret' }),
      });
      const data = await response.json().catch(() => ({ error: 'Unknown error' }));
      if (!response.ok) {
        setError(data.error ?? `Failed (HTTP ${response.status})`);
        setState('error');
        return;
      }
      setRotatedSecret(data.secret);
      setState('idle');
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
      const response = await fetch(baseUrl, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ action: 'ping' }),
      });
      const data = await response.json().catch(() => ({ error: 'Unknown error' }));
      if (!response.ok) {
        setError(data.error ?? `Failed (HTTP ${response.status})`);
        setState('error');
        return;
      }
      setPingResult(
        data.ping?.success
          ? `✓ Ping successful (${data.ping.latencyMs ?? '?'}ms)`
          : `✗ Ping failed: ${data.ping?.error ?? 'unknown'}`,
      );
      setState('idle');
      router.refresh();
    } catch {
      setError('Network error');
      setState('error');
    }
  }

  async function deleteWebhook() {
    if (!confirm('Delete this webhook? This cannot be undone.')) return;
    setState('loading');
    setError(null);
    try {
      const response = await fetch(baseUrl, { method: 'DELETE' });
      if (!response.ok) {
        const data = await response.json().catch(() => ({ error: 'Unknown error' }));
        setError(data.error ?? `Failed (HTTP ${response.status})`);
        setState('error');
        return;
      }
      router.push('/reach/settings/webhooks');
    } catch {
      setError('Network error');
      setState('error');
    }
  }

  const disabled = state === 'loading';

  return (
    <div className="request-actions" style={{ margin: '16px 0' }}>
      <h3>Actions</h3>
      <p>
        <button onClick={toggleActive} disabled={disabled} className="policy-btn-toggle">
          {state === 'loading' ? '…' : isActive ? 'Deactivate' : 'Activate'}
        </button>{' '}
        <button onClick={ping} disabled={disabled || !isActive} className="policy-btn-toggle">
          {state === 'loading' ? '…' : 'Send Ping'}
        </button>{' '}
        <button onClick={rotateSecret} disabled={disabled}>
          {state === 'loading' ? '…' : 'Rotate Secret'}
        </button>{' '}
        <button onClick={deleteWebhook} disabled={disabled} className="policy-btn-delete">
          {state === 'loading' ? '…' : 'Delete'}
        </button>
      </p>

      {pingResult && (
        <p style={{ color: pingResult.startsWith('✓') ? '#2e7d32' : '#d32f2f', fontSize: 13 }}>
          {pingResult}
        </p>
      )}

      {rotatedSecret && (
        <div style={{ margin: '12px 0' }}>
          <p><strong>New signing secret</strong> — copy it now, it will not be shown again:</p>
          <div
            style={{
              background: '#f5f5f5',
              border: '1px solid #ddd',
              borderRadius: 6,
              padding: '12px 16px',
              fontFamily: 'monospace',
              fontSize: 14,
              wordBreak: 'break-all',
            }}
          >
            {rotatedSecret}
          </div>
        </div>
      )}

      {error && <p style={{ color: '#d32f2f', marginTop: 8 }}>Error: {error}</p>}
    </div>
  );
}
