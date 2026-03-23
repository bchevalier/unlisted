import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

vi.mock('react', async () => {
  const actual = await vi.importActual<typeof import('react')>('react');
  return {
    ...actual,
    useEffect: vi.fn(),
    useState: vi.fn((initial: unknown) => [initial, vi.fn()]),
    useCallback: vi.fn((fn: unknown) => fn),
  };
});

import { BillingAuthorityNotice, PlanGuardrailCard, SettingsPanel } from './settings-panel';

describe('SettingsPanel', () => {
  it('reinforces that public aliases are separate from the keeper\'s private inbox', () => {
    const html = renderToStaticMarkup(
      React.createElement(SettingsPanel, {
        door: {
          slug: 'john',
          displayName: 'John',
          plan: 'FREE',
          settings: {
            autoReplyEnabled: false,
            autoReplyMessage: null,
            weeklyRequestCap: 25,
            revealMethod: 'NONE',
            revealValue: null,
            notifyNewRequest: true,
            notifyDigest: false,
            paidQuoteAmountCents: null,
            paidQuoteCurrency: null,
            paidQuoteNote: null,
            quoteVisibleToVerifiedOrgsOnly: false,
            openToNonTargetedPaidReach: false,
          },
          categories: [],
          emailAliases: [{ alias: 'john', isEnabled: true }],
        },
      })
    );

    expect(html).toContain('class="settings-panel"');
    expect(html).toContain('class="settings-card"');
    expect(html).toContain('Email entry point');
    expect(html).toContain('john@knokio.io');
    expect(html).toContain('The alias is public-facing.');
    expect(html).toContain('Your real inbox stays hidden');
    expect(html).toContain('Direct is solo-only in the current MVP.');
  });

  it('makes the upgrade path explicitly billing-authoritative before paid unlocks', () => {
    const html = renderToStaticMarkup(
      React.createElement(BillingAuthorityNotice, {
        plan: 'FREE',
        billing: null,
        loading: false,
      })
    );

    expect(html).toContain('Paid unlocks only after billing is active.');
    expect(html).toContain('Starting checkout does not flip this door to Paid by itself.');
  });

  it('shows that non-active Stripe states do not unlock paid controls', () => {
    const html = renderToStaticMarkup(
      React.createElement(BillingAuthorityNotice, {
        plan: 'FREE',
        loading: false,
        billing: {
          plan: 'FREE',
          stripeSubscriptionStatus: 'PAST_DUE',
          stripePriceId: 'price_123',
          currentPeriodEnd: null,
          hasStripeCustomer: true,
        },
      })
    );

    expect(html).toContain('Billing exists, but Paid is still locked.');
    expect(html).toContain('Stripe status is');
    expect(html).toContain('past due');
    expect(html).toContain('Paid-only controls should be treated as unavailable.');
  });

  it('spells out what Free protects and what Paid unlocks', () => {
    const html = renderToStaticMarkup(
      React.createElement(PlanGuardrailCard, {
        plan: 'FREE',
      })
    );

    expect(html).toContain('Plan guardrails');
    expect(html).toContain('What Free protects');
    expect(html).toContain('Inbound caps stay on');
    expect(html).toContain('Paid-intent lanes, quote controls, and non-targeted paid Reach stay unavailable until billing is active.');
    expect(html).toContain('What Paid unlocks');
    expect(html).toContain('Paid quote controls and paid-intent filtering become available once billing is active.');
    expect(html).toContain('Current MVP guardrail: both Free and Paid remain solo-only, single-door, and privacy-first right now.');
    expect(html).toContain('This door is on Free, so the inbox-protection defaults remain the active guardrails until billing unlocks Paid.');
  });
});
