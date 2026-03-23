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

import { SettingsPanel } from './settings-panel';

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
});
