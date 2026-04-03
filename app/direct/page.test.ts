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

const mock = vi.mocked(getKeeperSessionFromCookies);

async function render() {
  return renderToStaticMarkup(await DirectClientPage());
}

describe('DirectClientPage', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('renders a short convince-and-orient landing for signed-out visitors', async () => {
    mock.mockResolvedValue(null as never);
    const html = await render();

    expect(html).toContain('Stop letting strangers decide');
    expect(html).toContain('what lands in your inbox.');
    expect(html).toContain('private until you approve');
    // Hero subtitle references access layer
    expect(html).toContain('access layer');
    expect(html).toContain('One link replaces your public email');
    // Testimonial attribution
    expect(html).toContain('Mia Chen');
    expect(html).toContain('David Okafor');
    expect(html).toContain('Sarah Kim');
    expect(html).toContain('Protect my inbox');
    expect(html).toContain('See a live example');
    expect(html).toContain('Structured from the start');
    expect(html).toContain('Noise never reaches you');
    expect(html).toContain('Who Direct is for');
    expect(html).toContain('Small businesses');
    expect(html).toContain('Public figures');
    expect(html).toContain('See more use cases');
    // "Not a contact form" comparison (key differentiator)
    expect(html).toContain('Not a contact form');
    expect(html).toContain('access layer');
    // Trust architecture section
    expect(html).toContain('Privacy by design');
    expect(html).toContain('Encrypted everywhere');
    expect(html).toContain('Zero tracking, zero ads');
    expect(html).toContain('You own your data');
    // Inline before/after on audience cards
    expect(html).toContain('qualified pitches with budget attached');
    // Hero mockup elements
    expect(html).toContain('knokio.io/u/you');
    expect(html).toContain('Nike Brand Team');
    expect(html).toContain('filtered');
    // Security claims (merged into pricing trust row)
    expect(html).toContain('GDPR compliant');
    expect(html).toContain('Open source maintainers');
    expect(html).toContain('KNOKIO DIRECT');
    expect(html).toContain('How it works');
    expect(html).toContain('Simple pricing');
    expect(html).toContain('FAQ');
    // Trust strip
    expect(html).toContain('Free tier is permanent');
    expect(html).toContain('Your data stays yours');
    // Social proof (outcome-focused metrics)
    expect(html).toContain('of spam stopped before inbox');
    expect(html).toContain('saved per week on inbox triage');
    expect(html).toContain('close rate on qualified leads');
    // CTAs should use varied labels across the page
    const protectMatches = html.match(/Protect my inbox/g);
    expect(protectMatches && protectMatches.length).toBeGreaterThanOrEqual(2);
    expect(html).toContain('Set up in 2 minutes');
  });

  it('preserves signed-in states', async () => {
    mock.mockResolvedValue({ userId: 'u1', email: 'j@example.com' } as never);
    const html = await render();

    expect(html).toContain('j@example.com');
    expect(html).toContain('Protect my inbox');
    expect(html).toContain('See a live example');
    // Verify GDPR security claim is present
    expect(html).toContain('GDPR compliant');
  });
});
