import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

vi.mock('next/link', () => ({
  default: ({ href, children, ...props }: { href: string; children: React.ReactNode }) =>
    React.createElement('a', { href, ...props }, children),
}));

vi.mock('../external-provider-auth-form', () => ({
  ExternalProviderAuthForm: ({ mode, next }: { mode?: string; next?: string }) =>
    React.createElement('div', null, `ExternalProviderAuthForm:${mode}:${next}`),
}));

vi.mock('./login-form', () => ({
  LoginForm: ({ next }: { next: string }) => React.createElement('div', null, `LoginForm:${next}`),
}));

vi.mock('./password-recovery-form', () => ({
  PasswordRecoveryForm: () => React.createElement('div', null, 'PasswordRecoveryForm'),
}));

import LoginPage from './page';

describe('LoginPage', () => {
  it('renders the keeper login surface with direct auth and recovery entry points', async () => {
    const html = renderToStaticMarkup(await LoginPage({}));

    expect(html).toContain('Keeper login');
    expect(html).toContain('Sign in to manage your door, inbox, and Direct settings.');
    expect(html).toContain('LoginForm:/direct/inbox');
    expect(html).toContain('ExternalProviderAuthForm:login:/direct/inbox');
    expect(html).toContain('PasswordRecoveryForm');
    expect(html).toContain('/direct/signup');
    expect(html).toContain('/direct/verify-email');
  });

  it('passes through the requested next path for post-login redirect behavior', async () => {
    const html = renderToStaticMarkup(
      await LoginPage({ searchParams: Promise.resolve({ next: '/direct/settings?slug=john' }) })
    );

    expect(html).toContain('LoginForm:/direct/settings?slug=john');
    expect(html).toContain('ExternalProviderAuthForm:login:/direct/settings?slug=john');
  });
});
