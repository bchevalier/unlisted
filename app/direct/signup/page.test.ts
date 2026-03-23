import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

vi.mock('next/link', () => ({
  default: ({ href, children, ...props }: { href: string; children: React.ReactNode }) =>
    React.createElement('a', { href, ...props }, children),
}));

vi.mock('../external-provider-auth-form', () => ({
  ExternalProviderAuthForm: () => React.createElement('div', null, 'ExternalProviderAuthForm'),
}));

vi.mock('./signup-form', () => ({
  SignupForm: () =>
    React.createElement(
      'div',
      null,
      'Choose your starting setup Creator / influencer Advisor / expert Public-facing professional'
    ),
  SignupLaunchPanel: () =>
    React.createElement(
      'div',
      null,
      'Your first Direct door is ready to launch First-run checklist Open public door Review settings @john'
    ),
}));

import SignupPage from './page';

describe('SignupPage', () => {
  it('explains the privacy and control promise of Direct during signup', async () => {
    const html = renderToStaticMarkup(await SignupPage({}));

    expect(html).toContain('Create Keeper account');
    expect(html).toContain('Choose your starting setup');
    expect(html).toContain('Creator / influencer');
    expect(html).toContain('Advisor / expert');
    expect(html).toContain('Public-facing professional');
    expect(html).toContain('keep your private inbox private');
    expect(html).toContain('structured, controlled door');
    expect(html).toContain('Start on Free');
    expect(html).toContain('Signup → public door → inbox → settings');
    expect(html).toContain('You are here');
    expect(html).toContain('/u/john');
    expect(html).toContain('/direct/inbox?slug=john&amp;fixture=demo');
    expect(html).toContain('/direct/settings?slug=john&amp;fixture=demo');
  });

  it('renders a canonical launch-state fixture for screenshot capture', async () => {
    const html = renderToStaticMarkup(
      await SignupPage({ searchParams: Promise.resolve({ fixture: 'launch' }) })
    );

    expect(html).toContain('Your first Direct door is ready to launch');
    expect(html).toContain('First-run checklist');
    expect(html).toContain('@john');
    expect(html).toContain('Open public door');
    expect(html).toContain('Review settings');
  });
});
