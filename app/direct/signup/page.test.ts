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
}));

import SignupPage from './page';

describe('SignupPage', () => {
  it('explains the privacy and control promise of Direct during signup', () => {
    const html = renderToStaticMarkup(React.createElement(SignupPage));

    expect(html).toContain('Create Keeper account');
    expect(html).toContain('Choose your starting setup');
    expect(html).toContain('Creator / influencer');
    expect(html).toContain('Advisor / expert');
    expect(html).toContain('Public-facing professional');
    expect(html).toContain('keep your private inbox private');
    expect(html).toContain('structured, controlled door');
    expect(html).toContain('Start on Free');
  });
});
