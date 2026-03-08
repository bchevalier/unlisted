'use client';

import { FormEvent, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { PublicDoorCategory } from '../../../features/direct/types';

type CompletionFormProps = {
  completionToken: string;
  categories: PublicDoorCategory[];
  turnstileSiteKey?: string | null;
};

type SubmitState =
  | { kind: 'idle' }
  | { kind: 'submitting' }
  | { kind: 'error'; message: string }
  | { kind: 'success'; requestToken: string };

// ---------------------------------------------------------------------------
// Turnstile widget hook (shared logic)
// ---------------------------------------------------------------------------

function useTurnstile(siteKey: string | null | undefined) {
  const containerRef = useRef<HTMLDivElement>(null);
  const tokenRef = useRef<string | null>(null);
  const widgetIdRef = useRef<string | null>(null);

  const getToken = useCallback(() => tokenRef.current, []);

  const reset = useCallback(() => {
    tokenRef.current = null;
    const w = window as unknown as { turnstile?: { reset: (id: string) => void } };
    const wid = widgetIdRef.current;
    if (wid && w.turnstile) {
      w.turnstile.reset(wid);
    }
  }, []);

  useEffect(() => {
    if (!siteKey) return;
    const key = siteKey; // narrow for closure

    function renderWidget() {
      if (!containerRef.current) return;
      const w = window as unknown as {
        turnstile?: {
          render: (
            el: HTMLElement,
            opts: { sitekey: string; callback: (t: string) => void; 'expired-callback': () => void; theme: string }
          ) => string;
        };
      };
      if (!w.turnstile) return;

      widgetIdRef.current = w.turnstile.render(containerRef.current, {
        sitekey: key,
        callback: (t: string) => { tokenRef.current = t; },
        'expired-callback': () => { tokenRef.current = null; },
        theme: 'light'
      });
    }

    const existingScript = document.querySelector('script[src*="turnstile"]');
    if (existingScript) {
      renderWidget();
      return;
    }

    const script = document.createElement('script');
    script.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';
    script.async = true;
    script.onload = renderWidget;
    document.head.appendChild(script);
  }, [siteKey]);

  return { containerRef, getToken, reset };
}

export function CompletionForm({ completionToken, categories, turnstileSiteKey }: CompletionFormProps) {
  const [categoryKey, setCategoryKey] = useState(categories[0]?.key ?? '');
  const [submitState, setSubmitState] = useState<SubmitState>({ kind: 'idle' });
  const turnstile = useTurnstile(turnstileSiteKey);

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

    // Honeypot value
    const honeypot = String(data.get('_hp_website') ?? '');

    // Turnstile token
    const cfToken = turnstile.getToken();

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
          fields,
          _hp_website: honeypot,
          'cf-turnstile-response': cfToken
        })
      });

      const payload = (await response.json()) as {
        ok: boolean;
        error?: string;
        request?: { requestToken: string };
      };

      if (!response.ok || !payload.ok || !payload.request) {
        turnstile.reset();
        setSubmitState({ kind: 'error', message: payload.error ?? 'Unable to complete request.' });
        return;
      }

      setSubmitState({ kind: 'success', requestToken: payload.request.requestToken });
    } catch {
      turnstile.reset();
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
      {/* Honeypot field — hidden from real users, filled by bots */}
      <div aria-hidden="true" style={{ position: 'absolute', left: '-9999px', top: '-9999px', opacity: 0, height: 0, overflow: 'hidden' }}>
        <label htmlFor="_hp_website">Website</label>
        <input type="text" id="_hp_website" name="_hp_website" tabIndex={-1} autoComplete="off" />
      </div>

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

      {/* Cloudflare Turnstile widget */}
      {turnstileSiteKey ? (
        <div ref={turnstile.containerRef} className="knock-form__turnstile" />
      ) : null}

      <button type="submit" disabled={submitState.kind === 'submitting'}>
        {submitState.kind === 'submitting' ? 'Submitting…' : 'Complete request'}
      </button>

      {submitState.kind === 'error' ? <p className="knock-form__error">{submitState.message}</p> : null}
    </form>
  );
}
