'use client';

import { FormEvent, useMemo, useState } from 'react';
import type { PublicDoorCategory } from '../../../features/direct/types';

type CompletionFormProps = {
  completionToken: string;
  categories: PublicDoorCategory[];
};

type SubmitState =
  | { kind: 'idle' }
  | { kind: 'submitting' }
  | { kind: 'error'; message: string }
  | { kind: 'success'; requestToken: string };

export function CompletionForm({ completionToken, categories }: CompletionFormProps) {
  const [categoryKey, setCategoryKey] = useState(categories[0]?.key ?? '');
  const [submitState, setSubmitState] = useState<SubmitState>({ kind: 'idle' });

  const category = useMemo(
    () => categories.find((item) => item.key === categoryKey) ?? categories[0],
    [categoryKey, categories]
  );

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!category) {
      setSubmitState({ kind: 'error', message: 'No category available.' });
      return;
    }

    const form = event.currentTarget;
    const data = new FormData(form);

    const fields: Record<string, string> = {};
    for (const field of category.fields) {
      fields[field.key] = String(data.get(`field_${field.key}`) ?? '').trim();
    }

    setSubmitState({ kind: 'submitting' });

    try {
      const response = await fetch('/api/direct/email/complete', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          completionToken,
          categoryKey: category.key,
          fields
        })
      });

      const payload = (await response.json()) as {
        ok: boolean;
        error?: string;
        request?: { requestToken: string };
      };

      if (!response.ok || !payload.ok || !payload.request) {
        setSubmitState({ kind: 'error', message: payload.error ?? 'Unable to complete request.' });
        return;
      }

      setSubmitState({ kind: 'success', requestToken: payload.request.requestToken });
    } catch {
      setSubmitState({ kind: 'error', message: 'Unexpected error. Please try again.' });
    }
  }

  if (!category) {
    return <p>No request categories are currently available.</p>;
  }

  if (submitState.kind === 'success') {
    return (
      <div className="knock-form__success">
        <p>
          Request completed successfully. Track it at{' '}
          <a href={`/r/${submitState.requestToken}`} target="_blank" rel="noreferrer">
            /r/{submitState.requestToken}
          </a>
          .
        </p>
      </div>
    );
  }

  return (
    <form className="knock-form" onSubmit={onSubmit}>
      <div className="knock-form__row">
        <label htmlFor="category">Category</label>
        <select
          id="category"
          name="category"
          value={category.key}
          onChange={(event) => setCategoryKey(event.target.value)}
        >
          {categories.map((item) => (
            <option key={item.key} value={item.key}>
              {item.label}
            </option>
          ))}
        </select>
        {category.description ? <p className="knock-form__hint">{category.description}</p> : null}
      </div>

      {category.fields.length > 0 ? (
        <fieldset>
          <legend>Required information</legend>
          <div className="knock-form__grid">
            {category.fields.map((field) => (
              <label key={field.key}>
                {field.label}
                {field.required ? ' *' : ''}
                {field.type === 'TEXTAREA' ? (
                  <textarea
                    name={`field_${field.key}`}
                    required={field.required}
                    placeholder={field.placeholder ?? undefined}
                    rows={4}
                  />
                ) : (
                  <input
                    name={`field_${field.key}`}
                    type={
                      field.type === 'NUMBER'
                        ? 'number'
                        : field.type === 'URL'
                          ? 'url'
                          : field.type === 'EMAIL'
                            ? 'email'
                            : 'text'
                    }
                    required={field.required}
                    placeholder={field.placeholder ?? undefined}
                  />
                )}
              </label>
            ))}
          </div>
        </fieldset>
      ) : null}

      <button type="submit" disabled={submitState.kind === 'submitting'}>
        {submitState.kind === 'submitting' ? 'Submitting…' : 'Complete request'}
      </button>

      {submitState.kind === 'error' ? <p className="knock-form__error">{submitState.message}</p> : null}
    </form>
  );
}
