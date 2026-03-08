'use client';

import { useState } from 'react';

type ContractActionsProps = {
  contractId: string;
  status: string;
  isTarget: boolean;
  isInitiator: boolean;
};

type ActionState = 'idle' | 'loading' | 'done' | 'error';

/**
 * Client-side contract actions.
 *
 * Target can: accept (PROPOSED → ACTIVE), reject, override (REJECTED → reopen/accept).
 * Initiator can: cancel (PROPOSED/ACTIVE → CANCELLED).
 * Either can: mark fulfilled (ACTIVE → FULFILLED).
 */
export function ContractActions({
  contractId,
  status,
  isTarget,
  isInitiator,
}: ContractActionsProps) {
  const [state, setState] = useState<ActionState>('idle');
  const [error, setError] = useState<string | null>(null);

  async function transition(newStatus: string) {
    setState('loading');
    setError(null);
    try {
      const response = await fetch(`/api/reach/contracts/${contractId}/transition`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      });

      if (!response.ok) {
        const data = await response.json().catch(() => ({ error: 'Unknown error' }));
        setError(data.error ?? `Failed (HTTP ${response.status})`);
        setState('error');
        return;
      }

      setState('done');
      window.location.reload();
    } catch {
      setError('Network error');
      setState('error');
    }
  }

  async function override(action: 'REOPEN' | 'ACCEPT') {
    setState('loading');
    setError(null);
    try {
      const response = await fetch(`/api/reach/contracts/${contractId}/override`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ action }),
      });

      if (!response.ok) {
        const data = await response.json().catch(() => ({ error: 'Unknown error' }));
        setError(data.error ?? `Failed (HTTP ${response.status})`);
        setState('error');
        return;
      }

      setState('done');
      window.location.reload();
    } catch {
      setError('Network error');
      setState('error');
    }
  }

  const disabled = state === 'loading';

  // Determine available actions based on status and role.
  const actions: JSX.Element[] = [];

  if (status === 'PROPOSED') {
    if (isTarget) {
      actions.push(
        <button key="accept" onClick={() => transition('ACTIVE')} disabled={disabled}>
          Accept
        </button>,
        <button key="reject" onClick={() => transition('REJECTED')} disabled={disabled}>
          Reject
        </button>,
      );
    }
    if (isInitiator) {
      actions.push(
        <button key="cancel" onClick={() => transition('CANCELLED')} disabled={disabled}>
          Cancel
        </button>,
      );
    }
  }

  if (status === 'ACTIVE') {
    actions.push(
      <button key="fulfill" onClick={() => transition('FULFILLED')} disabled={disabled}>
        Mark Fulfilled
      </button>,
    );
    if (isInitiator) {
      actions.push(
        <button key="cancel-active" onClick={() => transition('CANCELLED')} disabled={disabled}>
          Cancel
        </button>,
      );
    }
  }

  if (status === 'REJECTED' && isTarget) {
    actions.push(
      <button key="reopen" onClick={() => override('REOPEN')} disabled={disabled}>
        Reopen (Override)
      </button>,
      <button key="override-accept" onClick={() => override('ACCEPT')} disabled={disabled}>
        Accept (Override)
      </button>,
    );
  }

  if (actions.length === 0) return null;

  return (
    <div className="request-actions" style={{ margin: '16px 0' }}>
      <h3>Actions</h3>
      <p>
        {actions.reduce<JSX.Element[]>((acc, btn, i) => {
          if (i > 0) acc.push(<span key={`sep-${i}`}> </span>);
          acc.push(btn);
          return acc;
        }, [])}
      </p>
      {error && <p style={{ color: '#d32f2f' }}>Error: {error}</p>}
    </div>
  );
}
