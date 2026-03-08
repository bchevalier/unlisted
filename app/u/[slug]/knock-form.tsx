'use client';

import { FormEvent, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { PublicDoor } from '../../../features/direct/types';

type KnockFormProps = {
  door: PublicDoor;
  turnstileSiteKey?: string | null;
};

type SubmitState =
  | { kind: 'idle' }
  | { kind: 'submitting' }
  | { kind: 'error'; message: string }
  | { kind: 'success'; requestToken: string };

// ---------------------------------------------------------------------------
// Turnstile widget hook
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

    // Render widget once Turnstile script is loaded
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

    // Load Turnstile script if not already present
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

    return () => {
      // Cleanup is not critical — Turnstile handles its own lifecycle
    };
  }, [siteKey]);

  return { containerRef, getToken, reset };
}

export function KnockForm({ door, turnstileSiteKey }: KnockFormProps) {
  const [categoryKey, setCategoryKey] = useState(door.categories[0]?.key ?? '');
  const [submitState, setSubmitState] = useState<SubmitState>({ kind: 'idle' });
  const turnstile = useTurnstile(turnstileSiteKey);

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

    // Honeypot value (should be empty for real users)
    const honeypot = String(data.get('_hp_website') ?? '');

    // Turnstile token
    const cfToken = turnstile.getToken();

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
        // Reset Turnstile on failure so user can retry
        turnstile.reset();
        setSubmitState({ kind: 'error', message: payload.error ?? 'Unable to submit request.' });
        return;
      }

      form.reset();
      setSubmitState({ kind: 'success', requestToken: payload.request.requestToken });
    } catch {
      turnstile.reset();
      setSubmitState({ kind: 'error', message: 'Unexpected error. Please try again.' });
    }
  }

  if (!category) {
    return <p>No request categories are currently available.</p>;
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

      {/* Cloudflare Turnstile widget (renders only when site key is configured) */}
      {turnstileSiteKey ? (
        <div ref={turnstile.containerRef} className="knock-form__turnstile" />
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
