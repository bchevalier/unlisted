'use client';

import { useState } from 'react';
import Link from 'next/link';

const EVENT_TYPES = [
  'CREATED',
  'ROUTED',
  'ACCEPTED',
  'REJECTED',
  'FULFILLED',
  'ESCALATED',
  'EXPIRED',
  'CANCELLED',
  'OVERRIDDEN',
] as const;

type WebhookFormProps = {
  actorHandle: string;
};

export function WebhookForm({ actorHandle }: WebhookFormProps) {
  const [state, setState] = useState<'idle' | 'loading' | 'error' | 'done'>('idle');
  const [error, setError] = useState<string | null>(null);
  const [createdSecret, setCreatedSecret] = useState<string | null>(null);

  const [url, setUrl] = useState('');
  const [description, setDescription] = useState('');
  const [selectedEvents, setSelectedEvents] = useState<string[]>([]);

  function toggleEvent(event: string) {
    setSelectedEvents((prev) =>
      prev.includes(event) ? prev.filter((e) => e !== event) : [...prev, event],
    );
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setState('loading');
    setError(null);

    const payload: Record<string, unknown> = {
      url: url.trim(),
    };

    if (description.trim()) {
      payload.description = description.trim();
    }

    if (selectedEvents.length > 0) {
      payload.events = selectedEvents;
    }

    try {
      const response = await fetch(`/api/reach/actors/${actorHandle}/webhooks`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error ?? `Failed (HTTP ${response.status})`);
        setState('error');
        return;
      }

      // Show the secret — it's only available once.
      setCreatedSecret(data.secret);
      setState('done');
    } catch {
      setError('Network error');
      setState('error');
    }
  }

  if (state === 'done' && createdSecret) {
    return (
      <div>
        <h2>✓ Webhook Created</h2>
        <p>
          Your webhook has been registered. <strong>Copy the signing secret below</strong> — it
          will not be shown again.
        </p>

        <div
          style={{
            background: '#f5f5f5',
            border: '1px solid #ddd',
            borderRadius: 6,
            padding: '12px 16px',
            fontFamily: 'monospace',
            fontSize: 14,
            wordBreak: 'break-all',
            margin: '16px 0',
          }}
        >
          {createdSecret}
        </div>

        <p style={{ color: '#666', fontSize: 13 }}>
          Use this secret to verify webhook signatures via HMAC-SHA256.
          See the Reach API documentation for verification examples.
        </p>

        <p>
          <Link href="/reach/settings/webhooks">← Back to webhooks</Link>
        </p>
      </div>
    );
  }

  const disabled = state === 'loading';

  return (
    <form onSubmit={handleSubmit} className="policy-form">
      {/* URL */}
      <div className="form-field">
        <label htmlFor="webhook-url">
          <strong>Endpoint URL</strong>
        </label>
        <input
          id="webhook-url"
          type="url"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          required
          disabled={disabled}
          placeholder="https://your-server.com/webhooks/reach"
          maxLength={2048}
        />
      </div>

      {/* Description */}
      <div className="form-field">
        <label htmlFor="webhook-desc">
          <strong>Description</strong>
        </label>
        <span className="form-hint">Optional — helps identify the webhook later</span>
        <input
          id="webhook-desc"
          type="text"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          disabled={disabled}
          placeholder="e.g. Slack notifications for new contracts"
          maxLength={500}
        />
      </div>

      {/* Event filter */}
      <div className="form-field">
        <strong>Events</strong>
        <span className="form-hint">
          Select specific events, or leave all unchecked to receive every event type
        </span>
        <div className="checkbox-group">
          {EVENT_TYPES.map((event) => (
            <label key={event} className="checkbox-label">
              <input
                type="checkbox"
                checked={selectedEvents.includes(event)}
                onChange={() => toggleEvent(event)}
                disabled={disabled}
              />
              {event}
            </label>
          ))}
        </div>
      </div>

      <button type="submit" disabled={disabled}>
        {state === 'loading' ? 'Creating…' : 'Create Webhook'}
      </button>

      {error && <p style={{ color: '#d32f2f', marginTop: 8 }}>Error: {error}</p>}
    </form>
  );
}
