import { renderToStaticMarkup } from 'react-dom/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import React from 'react';

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

vi.mock('./scroll-reveal', () => ({
  ScrollReveal: ({ children }: { children: React.ReactNode }) => React.createElement('div', null, children),
  StaggerReveal: ({ children, className }: { children: React.ReactNode; className?: string }) => React.createElement('div', { className }, children),
}));

import { getKeeperSessionFromCookies } from '../../lib/keeper-auth';
import DirectClientPage from './page';

const mock = vi.mocked(getKeeperSessionFromCookies);

async function render() {
  return renderToStaticMarkup(await DirectClientPage());
}

describe('DirectClientPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders a tighter, concrete landing page for signed-out visitors', async () => {
    mock.mockResolvedValue(null as never);
    const html = await render();

    expect(html).toContain('Stop letting strangers decide');
    expect(html).toContain('what lands in your inbox.');
    expect(html).toContain('Replace your public email with one link.');
    expect(html).toContain('Your real email stays hidden — always');
    expect(html).toContain('Budget, scope, and timeline collected upfront');
    expect(html).toContain('Spam and low-effort asks blocked automatically');
    expect(html).toContain('Watch interactive demo');
    expect(html).toContain('href="/direct/demo"');

    expect(html).toContain('What people see when they reach you');
    expect(html).toContain('Send a request');
    expect(html).toContain('Required context upfront');
    expect(html).toContain('Private and filtered by default');

    expect(html).not.toContain('More than a contact form');
    expect(html).not.toContain('Email stays hidden until approval');
    expect(html).not.toContain('Budget, scope, and timeline required');
    expect(html).not.toContain('Spam filtered before it reaches you');

    expect(html).toContain('If you receive unsolicited inbound, this is your tool');
    expect(html).toContain('See more use cases');
    expect(html).toContain('Founders and public figures');
    expect(html).toContain('Real estate agents');
    expect(html).toContain('Healthcare and legal practices');
    expect(html).toContain('Artists and musicians');
    expect(html).toContain('✕');
    expect(html).toContain('✓');

    expect(html).toContain('Simple billing');
    expect(html).toContain('One plan. One meter.');
    expect(html).toContain('Pay only for real requests.');
    expect(html).toContain('$5 / month');
    expect(html).toContain('50 handled inbound');
    expect(html).toContain('From $0.05 each');
    expect(html).toContain('What counts');
    expect(html).toContain('What does not count');
    expect(html).toContain('Optional: charge for access');
    expect(html).toContain('pay-to-contact request cost');
    expect(html).toContain('All Direct features included');
    expect(html).toContain('Only handled inbound requests count. Blocked spam, abuse, and retries do not.');
    expect(html).toContain('Includes up to 1 system auto-reply per handled inbound if needed');
    expect(html).toContain('max($0.50, 10% of the request cost)');
    expect(html).not.toContain('Starter');
    expect(html).not.toContain('Enterprise');
    expect(html).not.toContain('Free forever. Upgrade only if you outgrow it.');

    expect(html).toContain('Questions before you start');
    expect(html).toContain('How does billing work?');
    expect(html).toContain('Your inbox, your rules.');
    expect(html).toContain('Protect my inbox');
    expect(html).not.toContain('Try Direct');
    expect(html).not.toContain('Your existing email keeps working');

    // Removed in v3 pass for credibility + page length
    expect(html).not.toContain('Mia Chen');
    expect(html).not.toContain('2× close rate');
    expect(html).not.toContain('96%');
    expect(html).not.toContain('Privacy by design — your data stays yours. Always.');
  });

  it('preserves signed-in states', async () => {
    mock.mockResolvedValue({ userId: 'u1', email: 'j@example.com' } as never);
    const html = await render();

    expect(html).toContain('j@example.com');
    expect(html).toContain('Protect my inbox');
    expect(html).not.toContain('Protect my inbox for free');
    expect(html).not.toContain('Protect my inbox — free forever');
    expect(html).toContain('Send a request');
    expect(html).toContain('How is my data protected?');
    expect(html).toContain('GDPR');
    expect(html).toContain('CCPA compliant');
  });
});
