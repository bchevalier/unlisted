'use client';

import React, { FormEvent, useCallback, useEffect, useState } from 'react';

type BillingStatus = {
  plan: 'FREE' | 'PAID';
  stripeSubscriptionStatus: string | null;
  stripePriceId: string | null;
  currentPeriodEnd: string | null;
  hasStripeCustomer: boolean;
};

function hasActiveBillingEntitlement(status: string | null | undefined) {
  return status === 'ACTIVE' || status === 'TRIALING' || status === 'active' || status === 'trialing';
}

export function BillingAuthorityNotice({
  plan,
  billing,
  loading,
}: {
  plan: 'FREE' | 'PAID';
  billing: BillingStatus | null;
  loading: boolean;
}) {
  if (loading) {
    return <p>Checking whether billing is active before unlocking Paid…</p>;
  }

  const status = billing?.stripeSubscriptionStatus ?? null;
  const hasActiveBilling = hasActiveBillingEntitlement(status);
  const effectivePlan = billing?.plan ?? plan;

  if (effectivePlan === 'PAID' && hasActiveBilling) {
    return (
      <div className="settings-billing-authority" style={{ padding: '12px 16px', background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 8, marginTop: 12 }}>
        <p style={{ margin: 0, fontWeight: 600 }}>Paid is unlocked by active billing.</p>
        <p style={{ margin: '6px 0 0 0', color: '#166534' }}>
          This door is currently using Paid because Stripe reports an active or trialing subscription.
          Paid controls are server-authoritative, not a manual toggle.
        </p>
      </div>
    );
  }

  if (status) {
    return (
      <div className="settings-billing-authority" style={{ padding: '12px 16px', background: '#fffbe6', border: '1px solid #fde68a', borderRadius: 8, marginTop: 12 }}>
        <p style={{ margin: 0, fontWeight: 600 }}>Billing exists, but Paid is still locked.</p>
        <p style={{ margin: '6px 0 0 0', color: '#854d0e' }}>
          Stripe status is <strong>{status.toLowerCase().replaceAll('_', ' ')}</strong>. Until billing becomes active or trialing,
          this door stays on Free protections and Paid-only controls should be treated as unavailable.
        </p>
      </div>
    );
  }

  return (
    <div className="settings-billing-authority" style={{ padding: '12px 16px', background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: 8, marginTop: 12 }}>
      <p style={{ margin: 0, fontWeight: 600 }}>Paid unlocks only after billing is active.</p>
      <p style={{ margin: '6px 0 0 0', color: '#1d4ed8' }}>
        Starting checkout does not flip this door to Paid by itself. The server unlocks Paid only after Stripe confirms an
        active or trialing subscription.
      </p>
    </div>
  );
}

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
          paidQuoteAmountCents: number | null;
          paidQuoteCurrency: string | null;
          paidQuoteNote: string | null;
          quoteVisibleToVerifiedOrgsOnly: boolean;
          openToNonTargetedPaidReach: boolean;
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
    emailAliases: Array<{
      alias: string;
      isEnabled: boolean;
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

  const activeAlias = door.emailAliases.find((a) => a.isEnabled);
  const emailProxyEnabled = Boolean(activeAlias);

  return (
    <section className="settings-panel">
      <BillingCard doorSlug={door.slug} plan={door.plan} />

      {!emailProxyEnabled ? (
        <article className="settings-card" style={{ borderLeft: '4px solid #e5a00d', background: '#fffbe6' }}>
          <h2>⚠️ Email proxy disabled</h2>
          <p>
            This door has no active email alias. Knockers will not be able to reach you via email
            (e.g. <code>{door.slug}@knokio.io</code>). Only the web form entry point is active.
          </p>
          <p style={{ fontSize: '0.9em', color: '#666' }}>
            Email aliases are created automatically when a door is set up. If this warning is
            unexpected, contact support.
          </p>
        </article>
      ) : activeAlias ? (
        <article className="settings-card">
          <h2>Email entry point</h2>
          <p>
            Knockers can email <strong>{activeAlias.alias}@knokio.io</strong> to submit requests
            to this door.
          </p>
          <p style={{ fontSize: '0.9em', color: '#666' }}>
            The alias is public-facing. Your real inbox stays hidden unless your workflow explicitly
            reveals contact later.
          </p>
        </article>
      ) : null}

      <article className="settings-card">
        <h2>Door settings</h2>
        <p style={{ fontSize: '0.9em', color: '#666' }}>
          Direct is solo-only in the current MVP. Team access and shared operator workflows are
          intentionally out of scope for both Free and Paid right now.
        </p>
        <form
          onSubmit={async (event) => {
            event.preventDefault();
            const form = event.currentTarget;
            const data = new FormData(form);

            const rawQuoteAmount = String(data.get('paidQuoteAmount') ?? '').trim();
            const quoteAmountCents =
              isPaid && rawQuoteAmount !== ''
                ? Math.round(parseFloat(rawQuoteAmount) * 100)
                : null;

            await postJson('/api/direct/settings/door', {
              doorSlug: door.slug,
              autoReplyEnabled: data.get('autoReplyEnabled') === 'on',
              autoReplyMessage: String(data.get('autoReplyMessage') ?? '').trim() || null,
              weeklyRequestCap:
                isPaid || !data.get('weeklyRequestCap') ? null : Number(data.get('weeklyRequestCap')),
              revealMethod: String(data.get('revealMethod') ?? 'NONE'),
              revealValue: String(data.get('revealValue') ?? '').trim() || null,
              notifyNewRequest: data.get('notifyNewRequest') === 'on',
              notifyDigest: data.get('notifyDigest') === 'on',
              paidQuoteAmountCents: quoteAmountCents,
              paidQuoteCurrency: quoteAmountCents != null ? 'USD' : null,
              paidQuoteNote: String(data.get('paidQuoteNote') ?? '').trim() || null,
              quoteVisibleToVerifiedOrgsOnly:
                data.get('quoteVisibleToVerifiedOrgsOnly') === 'on',
              openToNonTargetedPaidReach:
                data.get('openToNonTargetedPaidReach') === 'on'
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

          {isPaid ? (
            <fieldset style={{ border: '1px solid #ddd', padding: '12px', margin: '16px 0' }}>
              <legend>Paid quote</legend>
              <p style={{ fontSize: '0.9em', color: '#555', margin: '0 0 12px' }}>
                Set a quote for paid requests. This amount is shown to requesters only after you
                accept their request and they pass your verification policy.
              </p>

              <label>
                Quote amount (USD)
                <input
                  name="paidQuoteAmount"
                  type="number"
                  min={0}
                  step="0.01"
                  defaultValue={
                    door.settings?.paidQuoteAmountCents != null
                      ? (door.settings.paidQuoteAmountCents / 100).toFixed(2)
                      : ''
                  }
                  placeholder="e.g. 250.00"
                />
              </label>

              <label>
                Quote note (optional)
                <textarea
                  name="paidQuoteNote"
                  rows={2}
                  maxLength={1000}
                  defaultValue={door.settings?.paidQuoteNote ?? ''}
                  placeholder="e.g. Rate is per hour, minimum 1h engagement"
                />
              </label>

              <hr style={{ margin: '16px 0', border: 'none', borderTop: '1px solid #eee' }} />

              <label>
                <input
                  type="checkbox"
                  name="quoteVisibleToVerifiedOrgsOnly"
                  defaultChecked={door.settings?.quoteVisibleToVerifiedOrgsOnly ?? false}
                />{' '}
                Restrict quote visibility to verified organizations only
              </label>
              <p style={{ fontSize: '0.85em', color: '#666', margin: '4px 0 0 24px' }}>
                Your quote is only ever shown after you accept a request. This controls <em>who</em>{' '}
                can see it:
              </p>
              <ul style={{ fontSize: '0.85em', color: '#666', margin: '4px 0 0 24px', paddingLeft: '16px' }}>
                <li>
                  <strong>Enabled:</strong> only requesters with a verified organization (company
                  email domain matches their stated company website) will see the quote.
                  Individuals and unverified senders will not.
                </li>
                <li>
                  <strong>Disabled:</strong> any requester who passes basic identity verification
                  (non-free, non-disposable email domain) can see the quote — including individuals
                  without an organization.
                </li>
              </ul>
            </fieldset>
          ) : null}

          <fieldset style={{ border: '1px solid #ddd', padding: '12px', margin: '16px 0' }}>
            <legend>Reach</legend>

            <label>
              <input
                type="checkbox"
                name="openToNonTargetedPaidReach"
                defaultChecked={door.settings?.openToNonTargetedPaidReach ?? false}
              />{' '}
              Open to non-targeted paid Reach offers
            </label>
            <p style={{ fontSize: '0.85em', color: '#666', margin: '4px 0 0 24px' }}>
              Allow verified organizations to discover and contact you through Knokio Reach, even
              if they don&apos;t have your door link. Your quote and identity stay hidden until you
              accept.
            </p>
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

              {!emailProxyEnabled && category.isEnabled ? (
                <p style={{ color: '#b45309', fontSize: '0.85em', margin: '8px 0' }}>
                  ⚠️ Email proxy is disabled — this category only accepts web form submissions.
                </p>
              ) : null}

              {emailProxyEnabled &&
                category.isEnabled &&
                category.fields.some((f) => f.required) ? (
                <p style={{ color: '#6b7280', fontSize: '0.85em', margin: '8px 0' }}>
                  ℹ️ This category has required fields. Email submissions will trigger a
                  form-completion link before the request enters your inbox.
                </p>
              ) : null}

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
// Billing card (Stripe integration)
// ---------------------------------------------------------------------------

function BillingCard({ doorSlug, plan }: { doorSlug: string; plan: 'FREE' | 'PAID' }) {
  const [billing, setBilling] = useState<BillingStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);

  useEffect(() => {
    fetch(`/api/direct/billing/status?slug=${encodeURIComponent(doorSlug)}`)
      .then((r) => r.json())
      .then((data: { ok: boolean; billing?: BillingStatus }) => {
        if (data.ok && data.billing) setBilling(data.billing);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [doorSlug]);

  async function handleUpgrade() {
    setActionLoading(true);
    try {
      const res = await fetch('/api/direct/billing/checkout', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ doorSlug })
      });
      const data = (await res.json()) as { ok: boolean; url?: string; error?: string };
      if (data.ok && data.url) {
        window.location.href = data.url;
      } else {
        alert(data.error ?? 'Failed to start checkout');
      }
    } catch {
      alert('Failed to start checkout');
    } finally {
      setActionLoading(false);
    }
  }

  async function handleManageBilling() {
    setActionLoading(true);
    try {
      const res = await fetch('/api/direct/billing/portal', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ doorSlug })
      });
      const data = (await res.json()) as { ok: boolean; url?: string; error?: string };
      if (data.ok && data.url) {
        window.location.href = data.url;
      } else {
        alert(data.error ?? 'Failed to open billing portal');
      }
    } catch {
      alert('Failed to open billing portal');
    } finally {
      setActionLoading(false);
    }
  }

  const isPaid = plan === 'PAID';
  const subStatus = billing?.stripeSubscriptionStatus;
  const periodEnd = billing?.currentPeriodEnd
    ? new Date(billing.currentPeriodEnd).toLocaleDateString()
    : null;

  return (
    <article className="settings-card">
      <h2>Plan &amp; Billing</h2>

      {loading ? (
        <p>Loading billing status…</p>
      ) : (
        <>
          <p>
            Current plan: <strong>{plan}</strong>{' '}
            {isPaid ? '(unlimited reaches)' : '(caps enabled for inbox protection)'}
          </p>

          {subStatus ? (
            <p>
              Subscription status: <strong>{subStatus.toLowerCase().replace('_', ' ')}</strong>
              {periodEnd ? ` · Renews ${periodEnd}` : ''}
            </p>
          ) : null}

          <BillingAuthorityNotice plan={plan} billing={billing} loading={loading} />

          <div style={{ display: 'flex', gap: '8px', marginTop: '12px' }}>
            {!isPaid ? (
              <button type="button" onClick={handleUpgrade} disabled={actionLoading}>
                {actionLoading ? 'Redirecting…' : 'Start billing checkout'}
              </button>
            ) : null}

            {billing?.hasStripeCustomer ? (
              <button type="button" onClick={handleManageBilling} disabled={actionLoading}>
                {actionLoading ? 'Redirecting…' : 'Manage Billing'}
              </button>
            ) : null}
          </div>

          {!isPaid ? (
            <p style={{ fontSize: '0.9em', color: '#666', marginTop: 8 }}>
              Checkout starts the billing flow. Paid features unlock only after billing becomes active.
            </p>
          ) : null}
        </>
      )}
    </article>
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
