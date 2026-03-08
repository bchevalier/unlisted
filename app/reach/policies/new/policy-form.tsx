'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

const CONTRACT_TYPES = ['HUMAN_HUMAN', 'HUMAN_AI', 'AI_HUMAN', 'AI_AI'] as const;
const POLICY_ACTIONS = ['ACCEPT', 'REJECT', 'ROUTE', 'ESCALATE'] as const;

type PolicyFormProps = {
  actorHandle: string;
};

export function PolicyForm({ actorHandle }: PolicyFormProps) {
  const router = useRouter();
  const [state, setState] = useState<'idle' | 'loading' | 'error'>('idle');
  const [error, setError] = useState<string | null>(null);

  const [name, setName] = useState('');
  const [contractTypes, setContractTypes] = useState<string[]>(['HUMAN_HUMAN']);
  const [action, setAction] = useState<string>('ACCEPT');
  const [priority, setPriority] = useState(0);
  const [maxWeeklyInbound, setMaxWeeklyInbound] = useState('');
  const [requireVerifiedSender, setRequireVerifiedSender] = useState(false);
  const [autoAcceptMatching, setAutoAcceptMatching] = useState(false);
  const [escalateToHuman, setEscalateToHuman] = useState(false);

  function toggleContractType(type: string) {
    setContractTypes((prev) =>
      prev.includes(type) ? prev.filter((t) => t !== type) : [...prev, type],
    );
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (contractTypes.length === 0) {
      setError('Select at least one contract type.');
      setState('error');
      return;
    }

    setState('loading');
    setError(null);

    const payload: Record<string, unknown> = {
      name: name.trim(),
      contractTypes,
      action,
      priority,
      requireVerifiedSender,
      autoAcceptMatching,
      escalateToHuman,
    };

    const weeklyNum = Number(maxWeeklyInbound);
    if (maxWeeklyInbound.trim() !== '' && weeklyNum > 0) {
      payload.maxWeeklyInbound = weeklyNum;
    }

    try {
      const response = await fetch(`/api/reach/actors/${actorHandle}/policies`, {
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

      router.push('/reach/policies');
    } catch {
      setError('Network error');
      setState('error');
    }
  }

  const disabled = state === 'loading';

  return (
    <form onSubmit={handleSubmit} className="policy-form">
      {/* Name */}
      <div className="form-field">
        <label htmlFor="policy-name"><strong>Policy Name</strong></label>
        <input
          id="policy-name"
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          minLength={1}
          maxLength={200}
          required
          disabled={disabled}
          placeholder="e.g. Accept all human contracts"
        />
      </div>

      {/* Contract Types */}
      <div className="form-field">
        <strong>Contract Types</strong>
        <span className="form-hint">Select at least one</span>
        <div className="checkbox-group">
          {CONTRACT_TYPES.map((type) => (
            <label key={type} className="checkbox-label">
              <input
                type="checkbox"
                checked={contractTypes.includes(type)}
                onChange={() => toggleContractType(type)}
                disabled={disabled}
              />
              {type.replace(/_/g, ' → ').replace(/HUMAN/g, 'Human').replace(/AI/g, 'AI')}
            </label>
          ))}
        </div>
      </div>

      {/* Action */}
      <div className="form-field">
        <label htmlFor="policy-action"><strong>Action</strong></label>
        <select
          id="policy-action"
          value={action}
          onChange={(e) => setAction(e.target.value)}
          disabled={disabled}
        >
          {POLICY_ACTIONS.map((a) => (
            <option key={a} value={a}>{a}</option>
          ))}
        </select>
      </div>

      {/* Priority */}
      <div className="form-field">
        <label htmlFor="policy-priority"><strong>Priority</strong></label>
        <span className="form-hint">Higher priority policies are evaluated first</span>
        <input
          id="policy-priority"
          type="number"
          value={priority}
          onChange={(e) => setPriority(Number(e.target.value))}
          disabled={disabled}
        />
      </div>

      {/* Max weekly inbound */}
      <div className="form-field">
        <label htmlFor="policy-weekly-cap"><strong>Weekly Inbound Cap</strong></label>
        <span className="form-hint">Leave blank for unlimited</span>
        <input
          id="policy-weekly-cap"
          type="number"
          value={maxWeeklyInbound}
          onChange={(e) => setMaxWeeklyInbound(e.target.value)}
          min={1}
          disabled={disabled}
          placeholder="Unlimited"
        />
      </div>

      {/* Boolean toggles */}
      <div className="form-field">
        <strong>Options</strong>
        <div className="checkbox-group">
          <label className="checkbox-label">
            <input
              type="checkbox"
              checked={requireVerifiedSender}
              onChange={(e) => setRequireVerifiedSender(e.target.checked)}
              disabled={disabled}
            />
            Require verified sender
          </label>
          <label className="checkbox-label">
            <input
              type="checkbox"
              checked={autoAcceptMatching}
              onChange={(e) => setAutoAcceptMatching(e.target.checked)}
              disabled={disabled}
            />
            Auto-accept matching contracts
          </label>
          <label className="checkbox-label">
            <input
              type="checkbox"
              checked={escalateToHuman}
              onChange={(e) => setEscalateToHuman(e.target.checked)}
              disabled={disabled}
            />
            Escalate to human review
          </label>
        </div>
      </div>

      <button type="submit" disabled={disabled}>
        {state === 'loading' ? 'Creating…' : 'Create Policy'}
      </button>

      {error && <p style={{ color: '#d32f2f', marginTop: 8 }}>Error: {error}</p>}
    </form>
  );
}
