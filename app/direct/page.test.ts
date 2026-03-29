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

  it('renders a first-visit sales narrative with stronger proof, qualified CTAs, and objection handling for signed-out visitors', async () => {
    getKeeperSessionFromCookiesMock.mockResolvedValue(null as never);

    const html = await renderPage();

    expect(html).toContain('Filter inbound before it reaches your inbox.');
    expect(html).toContain('Knokio Direct turns public contact into structured requests');
    expect(html).toContain('Create your free door');
    expect(html).toContain('View demo door');
    expect(html).toContain('Prefer to inspect first? Open the demo inbox.');
    expect(html).toContain('Your inbox stays private by default');
    expect(html).toContain('Every request arrives with context');
    expect(html).toContain('Silence is still a valid outcome');
    expect(html).toContain('How Direct works');
    expect(html).toContain('Three steps from public contact to a cleaner inbox.');
    expect(html).toContain('Why people use Direct');
    expect(html).toContain('How one Direct door becomes a clean inbox.');
    expect(html).toContain('I get brand deals and collaboration requests');
    expect(html).toContain('What reaches your inbox');
    expect(html).toContain('Questions first-time Direct visitors usually ask.');
    expect(html).toContain('Will people still be able to reach me easily?');
    expect(html).toContain('Is this just another contact form?');
    expect(html).toContain('/direct/signup');
    expect(html).toContain('/direct/inbox?slug=john&amp;fixture=demo');
    expect(html.indexOf('Why people use Direct')).toBeLessThan(html.indexOf('Demo configuration'));
  });

  it('keeps signed-in demo actions while preserving proof and objection-handling sections', async () => {
    getKeeperSessionFromCookiesMock.mockResolvedValue({
      userId: 'user_123',
      email: 'john@example.com',
    } as never);

    const html = await renderPage();

    expect(html).toContain('john@example.com');
    expect(html).toContain('Open demo inbox');
    expect(html).toContain('Open demo settings');
    expect(html).toContain('Your inbox stays private by default');
    expect(html).toContain('Three steps from public contact to a cleaner inbox.');
    expect(html).toContain('How one Direct door becomes a clean inbox.');
    expect(html).toContain('Questions first-time Direct visitors usually ask.');
    expect(html).toContain('Tune demo settings');
  });
});
