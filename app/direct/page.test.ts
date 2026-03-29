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

  it('renders the tighter direct landing structure for signed-out visitors and moves demo content into disclosures', async () => {
    getKeeperSessionFromCookiesMock.mockResolvedValue(null as never);

    const html = await renderPage();

    expect(html).toContain('A public contact page that filters inbound before it hits your real inbox.');
    expect(html).toContain('Direct turns random emails and DMs into structured requests you can accept, route, auto-reply, or');
    expect(html).toContain('Built for creators, advisors, and operators handling constant inbound.');
    expect(html).toContain('You stay reachable. Your private channels stay private until you choose otherwise.');
    expect(html).toContain('See how Direct qualifies a request before it ever hits your private inbox.');
    expect(html).toContain('Create my free Direct page');
    expect(html).toContain('Explore demo inbox first');
    expect(html).toContain('No credit card needed. Launch your page in minutes.');
    expect(html).toContain('Explore demo inbox');
    expect(html).toContain('Stop publishing your personal inbox');
    expect(html).toContain('Stop chasing missing details');
    expect(html).toContain('Stop low-signal noise from becoming work');
    expect(html).toContain('Quick fit check');
    expect(html).toContain('If this sounds like you');
    expect(html).toContain('What changes with Direct');
    expect(html).toContain('Start here (first 10 minutes)');
    expect(html).toContain('Use this quick path to understand Direct before you commit.');
    expect(html).toContain('How Direct works');
    expect(html).toContain('From public contact to a cleaner inbox');
    expect(html).toContain('Who Direct is for');
    expect(html).not.toContain('Why people use Direct');
    expect(html).toContain('What requesters see');
    expect(html).toContain('Not just another contact form');
    expect(html).toContain('Direct is an inbound control layer, not a passive message box.');
    expect(html).not.toContain('Open the demo, then launch your own Direct page when you are ready.');
    expect(html).toContain('Plans at a glance');
    expect(html).toContain('Free plan');
    expect(html).toContain('Paid plan');
    expect(html).toContain('Compare plans in settings');
    expect(html).toContain('Common questions');
    expect(html).toContain('Keep your inbox private. Stay reachable for real opportunities.');
    expect(html).toContain('How Knokio works');
    expect(html).toContain('Explore live demo');
    expect(html).toContain('See demo configuration');
    expect(html.indexOf('Keep your inbox private. Stay reachable for real opportunities.')).toBeLessThan(
      html.indexOf('See demo configuration')
    );
  });

  it('keeps signed-in states while preserving the cleaner landing-first flow', async () => {
    getKeeperSessionFromCookiesMock.mockResolvedValue({
      userId: 'user_123',
      email: 'john@example.com',
    } as never);

    const html = await renderPage();

    expect(html).toContain('john@example.com');
    expect(html).toContain('Protect inbox in settings');
    expect(html).toContain('Explore demo inbox');
    expect(html).toContain('Signed in as');
    expect(html).toContain('/direct/settings?slug=john&amp;fixture=demo');
    expect(html).toContain('/direct/inbox?slug=john&amp;fixture=demo');
    expect(html).toContain('Explore live demo');
    expect(html).toContain('See demo configuration');
  });
});
