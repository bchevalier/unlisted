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
  beforeEach(() => { vi.clearAllMocks(); });

  it('renders a short convince-and-orient landing for signed-out visitors', async () => {
    mock.mockResolvedValue(null as never);
    const html = await render();

    expect(html).toContain('Stop letting strangers decide');
    expect(html).toContain('what lands in your inbox.');
    expect(html).toContain('Private until you approve.');
    // Hero pain line removed in pass v2-15 (redundant with headline)
    // Objection-handling microcopy (pass v2-10)
    expect(html).toContain('Your existing email keeps working');
    expect(html).toContain('No contacts lost');
    // Hero subtitle references access layer
    expect(html).toContain('access layer');
    expect(html).toContain('One link replaces your public email');
    // Hero tagline (pass v2-11)
    expect(html).toContain('Private until approved');
    // Featured quote — early trust signal (pass v2-11)
    expect(html).toContain('I replaced my public email with a Direct page');
    // Industry trust bar removed in pass v2-17 — generic categories without real logos hurt credibility
    // Testimonial attribution
    expect(html).toContain('Mia Chen');
    expect(html).toContain('David Okafor');
    expect(html).toContain('Sarah Kim');
    expect(html).toContain('Protect my inbox');
    expect(html).toContain('See what senders see');
    // Hero stats bar removed in pass v2-15 (proof stats in testimonials cover this)
    // Testimonial section still contains early trust quote (was featured, now in testimonials only)
    expect(html).toContain('I replaced my public email with a Direct page');
    // Comparison verdict (pass v2-12)
    expect(html).toContain('a different category');
    expect(html).toContain('Structured from the start');
    expect(html).toContain('Noise never reaches you');
    expect(html).toContain('Who Direct is for');
    expect(html).toContain('Small businesses');
    expect(html).toContain('Public figures');
    expect(html).toContain('See more use cases');
    // Sender view section (pass v2-04)
    expect(html).toContain('What people see when they reach you');
    expect(html).toContain('Send a request');
    expect(html).toContain('Structure before access');
    expect(html).toContain('Your email stays hidden');
    expect(html).toContain('Low-effort outreach self-filters');
    // Comparison section (key differentiator — kicker changed pass 15)
    expect(html).toContain('The difference');
    expect(html).toContain('Contact form');
    expect(html).toContain('access layer');
    // Privacy by design — integrated into pricing trust row
    expect(html).toContain('Privacy by design');
    // Inline before/after on audience cards
    expect(html).toContain('qualified pitches with budget attached');
    // Hero mockup elements
    expect(html).toContain('knokio.io/u/you');
    expect(html).toContain('Nike Brand Team');
    expect(html).toContain('filtered');
    // Security claims (merged into pricing trust row)
    expect(html).toContain('GDPR');
    expect(html).toContain('Open source maintainers');
    expect(html).toContain('KNOKIO DIRECT');
    expect(html).toContain('Simple by design');
    expect(html).toContain('No surprises');
    expect(html).toContain('FAQ');
    // Trust strip removed in pass 15 (redundant with hero meta + pricing trust)
    // Proof stats integrated into testimonials section (pass 15)
    expect(html).toContain('noise blocked before inbox');
    expect(html).toContain('saved per week on triage');
    expect(html).toContain('close rate on deals');
    // Cost of inaction section removed in pass 12 for page length
    // CTAs — fewer but varied (pass v2-15 removed inline + post-testimonial CTAs)
    expect(html).toContain('Protect my inbox');
    expect(html).toContain('Get started');
    expect(html).toContain('Create your access layer');
    expect(html).toContain('Set up in 2 minutes');
    // Hero social proof row (pass v2-09)
    expect(html).toContain('2,400+');
    expect(html).toContain('professionals protecting their inbox');
    // Micro-proof near CTAs (pass v2-09)
    expect(html).toContain('protect their inbox with Direct');
    // Post-testimonial CTA removed in pass v2-15
    // Footer (pass v2-15)
    expect(html).toContain('Privacy-first by design');
  });

  it('preserves signed-in states', async () => {
    mock.mockResolvedValue({ userId: 'u1', email: 'j@example.com' } as never);
    const html = await render();

    expect(html).toContain('j@example.com');
    expect(html).toContain('Protect my inbox');
    expect(html).toContain('See what senders see');
    // Sender view section (pass v2-04)
    expect(html).toContain('Send a request');
    expect(html).toContain('Structure before access');
    // Verify GDPR security claim is present
    expect(html).toContain('GDPR');
    expect(html).toContain('CCPA compliant');
  });
});
