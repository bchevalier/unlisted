import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('next/image', () => ({
  default: (props: Record<string, unknown>) => {
    const safeProps = { ...props };
    delete safeProps.priority;
    return React.createElement('img', safeProps);
  },
}));

vi.mock('next/link', () => ({
  default: ({ href, children, ...props }: { href: string; children: React.ReactNode }) =>
    React.createElement('a', { href, ...props }, children),
}));

vi.mock('../../lib/keeper-auth', () => ({
  getKeeperSessionFromCookies: vi.fn(),
}));

vi.mock('../../features/direct/server/session', () => ({
  requireKeeperSession: vi.fn(),
}));

vi.mock('../../features/direct/server/requests', () => ({
  listDoorsForKeeper: vi.fn(),
  listRequestsByDoorSlugForKeeper: vi.fn(),
}));

vi.mock('../../features/direct/server/security', () => ({
  getKeeperSecurityProfile: vi.fn(),
}));

vi.mock('./logout-button', () => ({
  LogoutButton: () => React.createElement('button', { type: 'button' }, 'Log out'),
}));

vi.mock('./settings/settings-panel', () => ({
  SettingsPanel: () => React.createElement('section', { className: 'settings-panel' }, 'SettingsPanel'),
}));

vi.mock('./settings/two-factor-panel', () => ({
  TwoFactorPanel: () => React.createElement('section', { className: 'settings-card' }, 'TwoFactorPanel'),
}));

vi.mock('./inbox/request-actions', () => ({
  RequestActions: () => React.createElement('div', null, 'RequestActions'),
}));

vi.mock('./external-provider-auth-form', () => ({
  ExternalProviderAuthForm: () =>
    React.createElement(
      'div',
      null,
      'Choose your starting setup Creator / influencer Advisor / expert Public-facing professional Continue with provider'
    ),
}));

vi.mock('./signup/signup-form', () => ({
  SignupForm: () =>
    React.createElement(
      'div',
      null,
      'Choose your starting setup Creator / influencer Advisor / expert Public-facing professional Your first door launches with'
    ),
  SignupLaunchPanel: () =>
    React.createElement(
      'div',
      null,
      'Your first Direct door is ready to launch First-run checklist Open public door Review settings @john'
    ),
}));

import { getKeeperSessionFromCookies } from '../../lib/keeper-auth';
import { listDoorsForKeeper, listRequestsByDoorSlugForKeeper } from '../../features/direct/server/requests';
import { getKeeperSecurityProfile } from '../../features/direct/server/security';
import { requireKeeperSession } from '../../features/direct/server/session';
import DirectInboxPage from './inbox/page';
import DirectPage from './page';
import DirectSettingsPage from './settings/page';
import SignupPage from './signup/page';

const getKeeperSessionFromCookiesMock = vi.mocked(getKeeperSessionFromCookies);
const requireKeeperSessionMock = vi.mocked(requireKeeperSession);
const listDoorsForKeeperMock = vi.mocked(listDoorsForKeeper);
const listRequestsByDoorSlugForKeeperMock = vi.mocked(listRequestsByDoorSlugForKeeper);
const getKeeperSecurityProfileMock = vi.mocked(getKeeperSecurityProfile);

describe('Direct coherence smoke', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    getKeeperSessionFromCookiesMock.mockResolvedValue(null as never);
    requireKeeperSessionMock.mockResolvedValue({ userId: 'user_1', email: 'john@example.com' } as never);
    listDoorsForKeeperMock.mockResolvedValue([{ slug: 'john', displayName: 'John', plan: 'FREE' }] as never);
    listRequestsByDoorSlugForKeeperMock.mockResolvedValue({
      slug: 'john',
      displayName: 'John',
      plan: 'FREE',
      settings: {},
      categories: [],
      emailAliases: [],
      statusCounts: { ACCEPTED: 2, AUTO_REPLIED: 1, REJECTED: 1 },
      pagination: { page: 1, totalPages: 1, totalCount: 4 },
      requests: [
        {
          id: 'req_1',
          status: 'ACCEPTED',
          senderEmail: 'brand@acme.com',
          senderName: 'Acme Brand',
          subject: 'Brand partnership',
          requesterOrgName: 'Acme',
          type: 'FORM',
          paidAmountCents: null,
          createdAt: new Date().toISOString(),
          message: 'Partnership details', source: 'FORM', title: 'Brand partnership', category: { label: 'Brand' }, events: [],
        },
        {
          id: 'req_2',
          status: 'AUTO_REPLIED',
          senderEmail: 'press@acme.com',
          senderName: 'Acme Press',
          subject: 'Media request',
          requesterOrgName: 'Acme',
          type: 'FORM',
          paidAmountCents: null,
          createdAt: new Date().toISOString(),
          message: 'Media inquiry', source: 'FORM', title: 'Media request', category: { label: 'Media' }, events: [],
        },
        {
          id: 'req_3',
          status: 'REJECTED',
          senderEmail: 'spam@noise.com',
          senderName: 'Noise',
          subject: 'Cold pitch',
          requesterOrgName: 'Noise',
          type: 'FORM',
          paidAmountCents: null,
          createdAt: new Date().toISOString(),
          message: 'Cold email', source: 'FORM', title: 'Cold pitch', category: { label: 'Other' }, events: [],
        },
        {
          id: 'req_4',
          status: 'ACCEPTED',
          senderEmail: 'paid@serious.com',
          senderName: 'Serious Co',
          subject: 'Paid advisory',
          requesterOrgName: 'Serious Co',
          type: 'FORM',
          paidAmountCents: 12000,
          createdAt: new Date().toISOString(),
          message: 'Advisory request', source: 'FORM', title: 'Paid advisory', category: { label: 'Advisory' }, events: [],
        },
      ],
    } as never);
    getKeeperSecurityProfileMock.mockResolvedValue({
      email: 'john@example.com',
      emailVerifiedAt: new Date().toISOString(),
      twoFactorEnabled: false,
    } as never);
  });

  it('renders the main Direct surfaces with coherent proof-of-value cues', async () => {
    const directHtml = renderToStaticMarkup(await DirectPage());
    const signupHtml = renderToStaticMarkup(await SignupPage({}));
    const settingsHtml = renderToStaticMarkup(
      await DirectSettingsPage({ searchParams: Promise.resolve({ slug: 'john' }) })
    );
    const inboxHtml = renderToStaticMarkup(
      await DirectInboxPage({ searchParams: Promise.resolve({ slug: 'john' }) })
    );

    expect(directHtml).toContain('direct-system-showcase');
    expect(directHtml).toContain('Creator / influencer');
    expect(directHtml).toContain('Intent filter');

    expect(signupHtml).toContain('Choose your starting setup');
    expect(signupHtml).toContain('Your first door launches with');

    expect(settingsHtml).toContain('direct-surface-shell direct-settings-shell');
    expect(settingsHtml).toContain('direct-surface-card direct-surface-card-toolbar');
    expect(settingsHtml).toContain('SettingsPanel');
    expect(settingsHtml).toContain('You are here');

    expect(inboxHtml).toContain('Inbox outcome summary');
    expect(inboxHtml).toContain('Paid-intent filtered');
    expect(inboxHtml).toContain('RequestActions');
    expect(inboxHtml).toContain('You are here');
  });
});
