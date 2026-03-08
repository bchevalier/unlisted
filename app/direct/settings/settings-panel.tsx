'use client';

import { FormEvent, useCallback, useEffect, useState } from 'react';

type SettingsPanelProps = {
  door: {
    slug: string;
    displayName: string;
    plan: 'FREE' | 'PAID';
    settings:
      | {
          autoReplyEnabled: boolean;
          autoReplyMessage: string | null;
          weeklyRequestCap: number | null;
          revealMethod: 'NONE' | 'EMAIL' | 'URL';
          revealValue: string | null;
          notifyNewRequest: boolean;
          notifyDigest: boolean;
        }
      | null;
    categories: Array<{
      key: string;
      label: string;
      isEnabled: boolean;
      weeklyCap: number | null;
      fields: Array<{
        key: string;
        label: string;
        required: boolean;
      }>;
    }>;
  };
};

async function postJson(url: string, body: unknown) {
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body)
  });

  if (!response.ok) {
    const payload = (await response.json().catch(() => ({}))) as { error?: string };
    throw new Error(payload.error ?? 'Request failed');
  }
}

export function SettingsPanel({ door }: SettingsPanelProps) {
  const isPaid = door.plan === 'PAID';

  return (
    <section className="settings-panel">
      <article className="settings-card">
        <h2>Plan</h2>
        <p>
          Current plan: <strong>{door.plan}</strong>{' '}
          {isPaid ? '(unlimited paid reaches)' : '(caps enabled for inbox protection)'}
        </p>
        <form
          onSubmit={async (event) => {
            event.preventDefault();
            const form = event.currentTarget;
            const data = new FormData(form);
            const nextPlan = String(data.get('plan') ?? door.plan) as 'FREE' | 'PAID';

            if (nextPlan === door.plan) {
              alert('Plan unchanged');
              return;
            }

            if (
              nextPlan === 'FREE' &&
              !confirm('Downgrading to FREE will re-enable caps on this door. Continue?')
            ) {
              return;
            }

            await postJson('/api/direct/settings/plan', {
              doorSlug: door.slug,
              plan: nextPlan
            });

            alert(`Plan updated to ${nextPlan}`);
            window.location.reload();
          }}
        >
          <label>
            Door plan
            <select name="plan" defaultValue={door.plan}>
              <option value="FREE">Free</option>
              <option value="PAID">Paid</option>
            </select>
          </label>
          <button type="submit">Update plan</button>
        </form>
        <p>
          Billing is not connected yet. This is a manual plan switch for internal testing until Stripe is wired.
        </p>
      </article>

      <article className="settings-card">
        <h2>Door settings</h2>
        <form
          onSubmit={async (event) => {
            event.preventDefault();
            const form = event.currentTarget;
            const data = new FormData(form);

            await postJson('/api/direct/settings/door', {
              doorSlug: door.slug,
              autoReplyEnabled: data.get('autoReplyEnabled') === 'on',
              autoReplyMessage: String(data.get('autoReplyMessage') ?? '').trim() || null,
              weeklyRequestCap:
                isPaid || !data.get('weeklyRequestCap') ? null : Number(data.get('weeklyRequestCap')),
              revealMethod: String(data.get('revealMethod') ?? 'NONE'),
              revealValue: String(data.get('revealValue') ?? '').trim() || null,
              notifyNewRequest: data.get('notifyNewRequest') === 'on',
              notifyDigest: data.get('notifyDigest') === 'on'
            });

            alert('Door settings saved');
          }}
        >
          <label>
            <input
              type="checkbox"
              name="autoReplyEnabled"
              defaultChecked={door.settings?.autoReplyEnabled ?? false}
            />{' '}
            Auto-reply enabled
          </label>

          <label>
            Auto-reply message
            <textarea
              name="autoReplyMessage"
              rows={3}
              defaultValue={door.settings?.autoReplyMessage ?? ''}
            />
          </label>

          <label>
            Weekly request cap (global)
            <input
              name="weeklyRequestCap"
              type="number"
              min={1}
              defaultValue={door.settings?.weeklyRequestCap ?? ''}
              disabled={isPaid}
            />
          </label>
          {isPaid ? <p>Paid doors are uncapped by design.</p> : null}

          <label>
            Contact reveal method
            <select name="revealMethod" defaultValue={door.settings?.revealMethod ?? 'NONE'}>
              <option value="NONE">None</option>
              <option value="EMAIL">Email</option>
              <option value="URL">URL</option>
            </select>
          </label>

          <label>
            Contact reveal value
            <input name="revealValue" type="text" defaultValue={door.settings?.revealValue ?? ''} />
          </label>

          <fieldset style={{ border: '1px solid #ddd', padding: '12px', margin: '16px 0' }}>
            <legend>Notification preferences</legend>
            <label>
              <input
                type="checkbox"
                name="notifyNewRequest"
                defaultChecked={door.settings?.notifyNewRequest ?? true}
              />{' '}
              Email me on each new request
            </label>
            <label>
              <input
                type="checkbox"
                name="notifyDigest"
                defaultChecked={door.settings?.notifyDigest ?? false}
              />{' '}
              Send periodic digest summary
            </label>
          </fieldset>

          <button type="submit">Save door settings</button>
        </form>
      </article>

      <article className="settings-card">
        <h2>Categories</h2>
        <div className="settings-categories">
          {door.categories.map((category) => (
            <section key={category.key} className="settings-category">
              <h3>{category.label}</h3>
              <form
                onSubmit={async (event) => {
                  event.preventDefault();
                  const form = event.currentTarget;
                  const data = new FormData(form);

                  await postJson('/api/direct/settings/category', {
                    doorSlug: door.slug,
                    categoryKey: category.key,
                    isEnabled: data.get('isEnabled') === 'on',
                    weeklyCap: isPaid || !data.get('weeklyCap') ? null : Number(data.get('weeklyCap'))
                  });

                  alert(`Saved category: ${category.label}`);
                }}
              >
                <label>
                  <input type="checkbox" name="isEnabled" defaultChecked={category.isEnabled} /> Enabled
                </label>

                <label>
                  Weekly cap
                  <input
                    name="weeklyCap"
                    type="number"
                    min={1}
                    defaultValue={category.weeklyCap ?? ''}
                    disabled={isPaid}
                  />
                </label>

                <button type="submit">Save category</button>
              </form>
              {isPaid ? <p>Paid plan ignores category caps.</p> : null}

              {category.fields.length > 0 ? (
                <div className="settings-fields">
                  <h4>Required fields</h4>
                  {category.fields.map((field) => (
                    <form
                      key={field.key}
                      onSubmit={async (event) => {
                        event.preventDefault();
                        const form = event.currentTarget;
                        const data = new FormData(form);

                        await postJson('/api/direct/settings/field', {
                          doorSlug: door.slug,
                          categoryKey: category.key,
                          fieldKey: field.key,
                          required: data.get('required') === 'on'
                        });

                        alert(`Saved field: ${field.label}`);
                      }}
                    >
                      <label>
                        <input type="checkbox" name="required" defaultChecked={field.required} /> {field.label}
                      </label>
                      <button type="submit">Save field</button>
                    </form>
                  ))}
                </div>
              ) : null}
            </section>
          ))}
        </div>
      </article>

      <BlocklistPanel doorSlug={door.slug} />
    </section>
  );
}

// ---------------------------------------------------------------------------
// Blocklist management panel
// ---------------------------------------------------------------------------

type BlockedSender = {
  email: string;
  reason: string | null;
  createdAt: string;
};

function BlocklistPanel({ doorSlug }: { doorSlug: string }) {
  const [entries, setEntries] = useState<BlockedSender[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchBlocklist = useCallback(async () => {
    try {
      const res = await fetch(`/api/direct/settings/blocklist?slug=${encodeURIComponent(doorSlug)}`);
      const data = (await res.json()) as { ok: boolean; blockedSenders?: BlockedSender[]; error?: string };
      if (data.ok && data.blockedSenders) {
        setEntries(data.blockedSenders);
      } else {
        setError(data.error ?? 'Failed to load blocklist');
      }
    } catch {
      setError('Failed to load blocklist');
    } finally {
      setLoading(false);
    }
  }, [doorSlug]);

  useEffect(() => { fetchBlocklist(); }, [fetchBlocklist]);

  async function onAdd(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    const email = String(data.get('email') ?? '').trim();
    const reason = String(data.get('reason') ?? '').trim();

    if (!email) return;

    try {
      const res = await fetch('/api/direct/settings/blocklist', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          doorSlug,
          email,
          ...(reason ? { reason } : {})
        })
      });

      const payload = (await res.json()) as { ok: boolean; error?: string };
      if (!res.ok || !payload.ok) {
        alert(payload.error ?? 'Failed to add blocked sender');
        return;
      }

      form.reset();
      await fetchBlocklist();
    } catch {
      alert('Failed to add blocked sender');
    }
  }

  async function onRemove(email: string) {
    if (!confirm(`Unblock ${email}?`)) return;

    try {
      const res = await fetch('/api/direct/settings/blocklist', {
        method: 'DELETE',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ doorSlug, email })
      });

      const payload = (await res.json()) as { ok: boolean; error?: string };
      if (!res.ok || !payload.ok) {
        alert(payload.error ?? 'Failed to remove blocked sender');
        return;
      }

      await fetchBlocklist();
    } catch {
      alert('Failed to remove blocked sender');
    }
  }

  return (
    <article className="settings-card">
      <h2>Blocked senders</h2>
      <p>Blocked email addresses cannot submit requests to this door.</p>

      <form className="blocklist-add" onSubmit={onAdd}>
        <label>
          Email to block
          <input name="email" type="email" required placeholder="spam@example.com" />
        </label>
        <label>
          Reason (optional)
          <input name="reason" type="text" maxLength={500} placeholder="Spam sender" />
        </label>
        <button type="submit">Block sender</button>
      </form>

      {loading ? <p>Loading…</p> : null}
      {error ? <p className="settings-error">{error}</p> : null}

      {!loading && entries.length === 0 ? (
        <p>No blocked senders.</p>
      ) : null}

      {entries.length > 0 ? (
        <table className="blocklist-table">
          <thead>
            <tr>
              <th>Email</th>
              <th>Reason</th>
              <th>Blocked</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {entries.map((entry) => (
              <tr key={entry.email}>
                <td>{entry.email}</td>
                <td>{entry.reason ?? '—'}</td>
                <td>{new Date(entry.createdAt).toLocaleDateString()}</td>
                <td>
                  <button type="button" onClick={() => onRemove(entry.email)}>
                    Unblock
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : null}
    </article>
  );
}
