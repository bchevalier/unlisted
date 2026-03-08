'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

type PolicyActionsProps = {
  policyId: string;
  isActive: boolean;
};

type ActionState = 'idle' | 'loading' | 'error';

/**
 * Inline actions for a policy card: toggle active/inactive and delete.
 */
export function PolicyActions({ policyId, isActive }: PolicyActionsProps) {
  const router = useRouter();
  const [state, setState] = useState<ActionState>('idle');
  const [error, setError] = useState<string | null>(null);

  async function toggleActive() {
    setState('loading');
    setError(null);
    try {
      const response = await fetch(`/api/reach/policies/${policyId}`, {
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

  async function deletePolicy() {
    setState('loading');
    setError(null);
    try {
      const response = await fetch(`/api/reach/policies/${policyId}`, {
        method: 'DELETE',
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

  const disabled = state === 'loading';

  return (
    <div className="policy-inline-actions">
      <button onClick={toggleActive} disabled={disabled} className="policy-btn-toggle">
        {state === 'loading' ? '…' : isActive ? 'Deactivate' : 'Activate'}
      </button>
      <button onClick={deletePolicy} disabled={disabled} className="policy-btn-delete">
        {state === 'loading' ? '…' : 'Delete'}
      </button>
      {error && <span style={{ color: '#d32f2f', fontSize: '13px', marginLeft: 8 }}>{error}</span>}
    </div>
  );
}
