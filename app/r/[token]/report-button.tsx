'use client';

import { FormEvent, useState } from 'react';

type ReportButtonProps = {
  requestToken: string;
};

type ReportState =
  | { kind: 'idle' }
  | { kind: 'form' }
  | { kind: 'submitting' }
  | { kind: 'success' }
  | { kind: 'error'; message: string };

const REASONS = [
  { value: 'SPAM', label: 'Spam or unwanted contact' },
  { value: 'HARASSMENT', label: 'Harassment or threatening behavior' },
  { value: 'IMPERSONATION', label: 'Impersonation' },
  { value: 'PHISHING', label: 'Phishing or scam attempt' },
  { value: 'OTHER', label: 'Other' }
] as const;

export function ReportButton({ requestToken }: ReportButtonProps) {
  const [state, setState] = useState<ReportState>({ kind: 'idle' });

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    const reason = String(data.get('reason') ?? '');
    const description = String(data.get('description') ?? '').trim();

    if (!reason) {
      setState({ kind: 'error', message: 'Please select a reason.' });
      return;
    }

    setState({ kind: 'submitting' });

    try {
      const response = await fetch('/api/direct/abuse-reports', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          requestToken,
          reason,
          ...(description ? { description } : {})
        })
      });

      const payload = (await response.json()) as { ok: boolean; error?: string };

      if (!response.ok || !payload.ok) {
        setState({ kind: 'error', message: payload.error ?? 'Unable to submit report.' });
        return;
      }

      setState({ kind: 'success' });
    } catch {
      setState({ kind: 'error', message: 'Unexpected error. Please try again.' });
    }
  }

  if (state.kind === 'success') {
    return (
      <p className="report-success">
        Thank you. Your report has been submitted and will be reviewed.
      </p>
    );
  }

  if (state.kind === 'idle') {
    return (
      <button
        type="button"
        className="report-trigger"
        onClick={() => setState({ kind: 'form' })}
      >
        Report abuse
      </button>
    );
  }

  return (
    <form className="report-form" onSubmit={onSubmit}>
      <fieldset disabled={state.kind === 'submitting'}>
        <legend>Report this request</legend>

        <label htmlFor="report-reason">Reason *</label>
        <select id="report-reason" name="reason" required>
          <option value="">Select a reason…</option>
          {REASONS.map((r) => (
            <option key={r.value} value={r.value}>
              {r.label}
            </option>
          ))}
        </select>

        <label htmlFor="report-description">Additional details (optional)</label>
        <textarea
          id="report-description"
          name="description"
          rows={3}
          maxLength={1000}
          placeholder="Provide any extra context…"
        />

        <div className="report-form__actions">
          <button type="submit">
            {state.kind === 'submitting' ? 'Submitting…' : 'Submit report'}
          </button>
          <button
            type="button"
            onClick={() => setState({ kind: 'idle' })}
          >
            Cancel
          </button>
        </div>

        {state.kind === 'error' ? (
          <p className="report-form__error">{state.message}</p>
        ) : null}
      </fieldset>
    </form>
  );
}
