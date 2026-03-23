import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
}));

import { LoginForm } from './login-form';

describe('LoginForm', () => {
  it('renders the initial password-login state with honeypot protection and no 2FA prompt yet', () => {
    const html = renderToStaticMarkup(React.createElement(LoginForm, { next: '/direct/inbox' }));

    expect(html).toContain('Email');
    expect(html).toContain('type="email"');
    expect(html).toContain('Password');
    expect(html).toContain('type="password"');
    expect(html).toContain('Website');
    expect(html).toContain('name="website"');
    expect(html).toContain('Sign in');
    expect(html).not.toContain('Verify 2FA');
    expect(html).not.toContain('Resend verification email');
  });
});
