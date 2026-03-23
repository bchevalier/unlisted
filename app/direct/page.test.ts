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

vi.mock('./logout-button', () => ({
  LogoutButton: () => React.createElement('button', { type: 'button' }, 'Log out'),
}));

import { getKeeperSessionFromCookies } from '../../lib/keeper-auth';
import DirectClientPage from './page';

const getKeeperSessionFromCookiesMock = vi.mocked(getKeeperSessionFromCookies);

async function renderPage() {
  const element = await DirectClientPage();
  return renderToStaticMarkup(element);
}

describe('DirectClientPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders the config-first system walkthrough and shared preset cards for signed-out visitors', async () => {
    getKeeperSessionFromCookiesMock.mockResolvedValue(null as never);

    const html = await renderPage();

    expect(html).toContain('Demo configuration');
    expect(html).toContain('See the door, the rules, and the outcome in one place.');
    expect(html).toContain('Creator / influencer');
    expect(html).toContain('Advisor / expert');
    expect(html).toContain('Public-facing professional');
    expect(html).toContain('Intent filter');
    expect(html).toContain('Create a protected access lane for serious outreach.');
    expect(html).toContain('Paid requests work as an intent filter.');
    expect(html).toContain('Create account');
    expect(html).toContain('View demo door');
    expect(html.indexOf('Demo configuration')).toBeLessThan(html.indexOf('Plans at a glance'));
  });

  it('switches to signed-in actions while preserving the config-first walkthrough', async () => {
    getKeeperSessionFromCookiesMock.mockResolvedValue({
      userId: 'user_123',
      email: 'john@example.com',
    } as never);

    const html = await renderPage();

    expect(html).toContain('john@example.com');
    expect(html).toContain('Open demo inbox');
    expect(html).toContain('Open demo settings');
    expect(html).toContain('Demo configuration');
    expect(html).toContain('What finally reaches you');
  });
});
