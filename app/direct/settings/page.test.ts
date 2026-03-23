import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('next/link', () => ({
  default: ({ href, children, ...props }: { href: string; children: React.ReactNode }) =>
    React.createElement('a', { href, ...props }, children),
}));

vi.mock('../../../features/direct/server/session', () => ({
  requireKeeperSession: vi.fn(),
}));

vi.mock('../../../features/direct/server/requests', () => ({
  listDoorsForKeeper: vi.fn(),
  listRequestsByDoorSlugForKeeper: vi.fn(),
}));

vi.mock('../../../features/direct/server/security', () => ({
  getKeeperSecurityProfile: vi.fn(),
}));

vi.mock('./settings-panel', () => ({
  SettingsPanel: () => React.createElement('section', { className: 'settings-panel' }, 'SettingsPanel'),
}));

vi.mock('./two-factor-panel', () => ({
  TwoFactorPanel: () => React.createElement('section', { className: 'settings-card' }, 'TwoFactorPanel'),
}));

import { listDoorsForKeeper, listRequestsByDoorSlugForKeeper } from '../../../features/direct/server/requests';
import { getKeeperSecurityProfile } from '../../../features/direct/server/security';
import { requireKeeperSession } from '../../../features/direct/server/session';
import DirectSettingsPage from './page';

const requireKeeperSessionMock = vi.mocked(requireKeeperSession);
const listDoorsForKeeperMock = vi.mocked(listDoorsForKeeper);
const listRequestsByDoorSlugForKeeperMock = vi.mocked(listRequestsByDoorSlugForKeeper);
const getKeeperSecurityProfileMock = vi.mocked(getKeeperSecurityProfile);

describe('DirectSettingsPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    requireKeeperSessionMock.mockResolvedValue({ userId: 'user_1', email: 'john@example.com' } as never);
    listDoorsForKeeperMock.mockResolvedValue([
      { slug: 'john', displayName: 'John', plan: 'FREE' },
    ] as never);
    listRequestsByDoorSlugForKeeperMock.mockResolvedValue({
      slug: 'john',
      displayName: 'John',
      plan: 'FREE',
      settings: {},
      categories: [],
      emailAliases: [],
    } as never);
    getKeeperSecurityProfileMock.mockResolvedValue({
      email: 'john@example.com',
      emailVerifiedAt: new Date().toISOString(),
      twoFactorEnabled: false,
    } as never);
  });

  it('renders the shared Direct surface shell and toolbar around settings', async () => {
    const html = renderToStaticMarkup(
      await DirectSettingsPage({ searchParams: Promise.resolve({ slug: 'john' }) })
    );

    expect(html).toContain('class="direct-surface-shell direct-settings-shell"');
    expect(html).toContain('direct-surface-card direct-surface-card-header');
    expect(html).toContain('direct-surface-card direct-surface-card-toolbar');
    expect(html).toContain('Active door plan:');
    expect(html).toContain('Open public door');
    expect(html).toContain('SettingsPanel');
  });

  it('renders demo fixture settings without depending on live request rows', async () => {
    listDoorsForKeeperMock.mockResolvedValue([{ slug: 'alice', displayName: 'Alice', plan: 'FREE' }] as never);

    const html = renderToStaticMarkup(
      await DirectSettingsPage({ searchParams: Promise.resolve({ slug: 'john', fixture: 'demo' }) })
    );

    expect(listRequestsByDoorSlugForKeeperMock).not.toHaveBeenCalled();
    expect(html).toContain('John demo (FREE)');
    expect(html).toContain('/direct/inbox?slug=john&amp;fixture=demo');
    expect(html).toContain('SettingsPanel');
  });
});
