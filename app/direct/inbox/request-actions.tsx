'use client';

import React, { useState } from 'react';

type RequestActionsProps = {
  requestId: string;
  status: 'PENDING' | 'ACCEPTED' | 'DECLINED' | 'EXPIRED' | 'AWAITING_COMPLETION';
};

export function RequestActions({ requestId, status }: RequestActionsProps) {
  const [state, setState] = useState<'idle' | 'loading' | 'done' | 'error'>('idle');

  const canAct = status === 'PENDING' || status === 'AWAITING_COMPLETION';
  if (!canAct) {
    return null;
  }

  async function update(nextStatus: 'ACCEPTED' | 'DECLINED') {
    setState('loading');
    try {
      const response = await fetch(`/api/direct/requests/${requestId}/status`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ status: nextStatus })
      });

      if (!response.ok) {
        setState('error');
        return;
      }

      setState('done');
      window.location.reload();
    } catch {
      setState('error');
    }
  }

  return (
    <p className="request-actions">
      {status === 'PENDING' && (
        <button onClick={() => update('ACCEPTED')} disabled={state === 'loading'}>
          Accept
        </button>
      )}{' '}
      <button onClick={() => update('DECLINED')} disabled={state === 'loading'}>
        Decline
      </button>
      {state === 'error' ? <span> · Failed to update</span> : null}
    </p>
  );
}
