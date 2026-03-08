'use client';

import { FormEvent, useMemo, useState } from 'react';
import type { PublicDoor } from '../../../features/direct/types';

type KnockFormProps = {
  door: PublicDoor;
};

type SubmitState =
  | { kind: 'idle' }
  | { kind: 'submitting' }
  | { kind: 'error'; message: string }
  | { kind: 'success'; requestToken: string };

export function KnockForm({ door }: KnockFormProps) {
  const [categoryKey, setCategoryKey] = useState(door.categories[0]?.key ?? '');
  const [submitState, setSubmitState] = useState<SubmitState>({ kind: 'idle' });

  const category = useMemo(
    () => door.categories.find((item) => item.key === categoryKey) ?? door.categories[0],
    [categoryKey, door.categories]
  );

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!category) {
      setSubmitState({ kind: 'error', message: 'No category available for this door.' });
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
      const response = await fetch('/api/direct/requests', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          doorSlug: door.slug,
          categoryKey: category.key,
          senderName: String(data.get('senderName') ?? '').trim(),
          senderEmail: String(data.get('senderEmail') ?? '').trim(),
          title: String(data.get('title') ?? '').trim(),
          message: String(data.get('message') ?? '').trim(),
          fields
        })
      });

      const payload = (await response.json()) as {
        ok: boolean;
        error?: string;
        request?: { requestToken: string };
      };

      if (!response.ok || !payload.ok || !payload.request) {
        setSubmitState({ kind: 'error', message: payload.error ?? 'Unable to submit request.' });
        return;
      }

      form.reset();
      setSubmitState({ kind: 'success', requestToken: payload.request.requestToken });
    } catch {
      setSubmitState({ kind: 'error', message: 'Unexpected error. Please try again.' });
    }
  }

  if (!category) {
    return <p>No request categories are currently available.</p>;
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
          {door.categories.map((item) => (
            <option key={item.key} value={item.key}>
              {item.label}
            </option>
          ))}
        </select>
        {category.description ? <p className="knock-form__hint">{category.description}</p> : null}
      </div>

      <div className="knock-form__grid">
        <label>
          Your name
          <input name="senderName" type="text" maxLength={120} />
        </label>

        <label>
          Your email
          <input name="senderEmail" type="email" maxLength={160} />
        </label>
      </div>

      <label>
        Title
        <input name="title" type="text" maxLength={180} />
      </label>

      <label>
        Message *
        <textarea name="message" required rows={6} maxLength={4000} />
      </label>

      {category.fields.length > 0 ? (
        <fieldset>
          <legend>Additional details</legend>
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
                    type={field.type === 'NUMBER' ? 'number' : field.type === 'URL' ? 'url' : field.type === 'EMAIL' ? 'email' : 'text'}
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
        {submitState.kind === 'submitting' ? 'Sending…' : 'Send request'}
      </button>

      {submitState.kind === 'error' ? <p className="knock-form__error">{submitState.message}</p> : null}
      {submitState.kind === 'success' ? (
        <p className="knock-form__success">
          Request submitted. Track it at{' '}
          <a href={`/r/${submitState.requestToken}`} target="_blank" rel="noreferrer">
            /r/{submitState.requestToken}
          </a>
          .
        </p>
      ) : null}
    </form>
  );
}
