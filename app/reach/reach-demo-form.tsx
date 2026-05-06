'use client';

import { FormEvent, useState } from 'react';

type DemoMatch = {
  id: string;
  name: string;
  role: string | null;
  organization: string | null;
  location: string | null;
  tags: string[];
  content: string;
  score: number;
};

type DemoResponse =
  | {
      ok: true;
      matches: DemoMatch[];
      debug: {
        model: string;
        dimensions: number;
      };
    }
  | {
      ok: false;
      error: string;
    };

export function ReachDemoForm() {
  const [request, setRequest] = useState('');
  const [matches, setMatches] = useState<DemoMatch[]>([]);
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [message, setMessage] = useState('');

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmed = request.trim();
    if (!trimmed) {
      setStatus('error');
      setMessage('Enter a request first.');
      return;
    }

    setStatus('loading');
    setMessage('');
    setMatches([]);

    try {
      const response = await fetch('/api/reach/demo/request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ request: trimmed, topK: 5 }),
      });
      const payload = (await response.json()) as DemoResponse;

      if (!response.ok || !payload.ok) {
        throw new Error(payload.ok ? 'Request failed' : payload.error);
      }

      setMatches(payload.matches);
      setStatus('success');
      setMessage(
        payload.matches.length > 0
          ? `Matched ${payload.matches.length} seeded identity${payload.matches.length === 1 ? '' : 'ies'}.`
          : 'No seeded identities matched yet.'
      );
    } catch (error) {
      setStatus('error');
      setMessage(error instanceof Error ? error.message : 'Request failed');
    }
  }

  return (
    <section
      id="reach-demo"
      className="lane-panel reach-demo-panel"
      aria-labelledby="reach-demo-title"
    >
      <div className="reach-demo-copy">
        <p className="lane-kicker">Reach Demo</p>
        <h2 id="reach-demo-title">Send a request into seeded identities.</h2>
      </div>

      <form className="reach-demo-form" onSubmit={onSubmit} noValidate>
        <label htmlFor="reach-demo-request">Request</label>
        <textarea
          id="reach-demo-request"
          name="request"
          value={request}
          onChange={(event) => setRequest(event.target.value)}
          rows={5}
          maxLength={2000}
          placeholder="Find a product security lead who can advise on OAuth abuse prevention."
          required
        />
        <div className="reach-demo-actions">
          <button className="button primary" type="submit" disabled={status === 'loading'}>
            {status === 'loading' ? 'Sending...' : 'Send'}
          </button>
          {message && (
            <p
              className={`reach-demo-status reach-demo-status-${status}`}
              role={status === 'error' ? 'alert' : undefined}
              aria-live="polite"
            >
              {message}
            </p>
          )}
        </div>
      </form>

      {matches.length > 0 && (
        <div className="reach-demo-results" aria-label="Reach demo matches">
          {matches.map((match) => (
            <article className="reach-demo-result" key={match.id}>
              <div>
                <h3>{match.name}</h3>
                <p>
                  {[match.role, match.organization, match.location].filter(Boolean).join(' · ')}
                </p>
              </div>
              <span className="reach-demo-score">{Math.round(match.score * 100)}%</span>
              <p className="reach-demo-content">{match.content}</p>
              {match.tags.length > 0 && (
                <p className="reach-demo-tags">
                  {match.tags.map((tag) => (
                    <span key={tag}>{tag}</span>
                  ))}
                </p>
              )}
            </article>
          ))}
        </div>
      )}
    </section>
  );
}
