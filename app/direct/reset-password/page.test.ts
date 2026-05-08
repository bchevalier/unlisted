import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

vi.mock('./reset-password-form', () => ({
  ResetPasswordForm: ({ token }: { token: string }) =>
    React.createElement('div', null, `ResetPasswordForm:${token}`),
}));

import ResetPasswordPage from './page';

describe('ResetPasswordPage', () => {
  it('renders the password-reset surface and empty-token fallback', async () => {
    const html = renderToStaticMarkup(await ResetPasswordPage({}));

    expect(html).toContain('Reset password');
    expect(html).toContain('Set a new password for your Knokio Direct account.');
    expect(html).toContain('ResetPasswordForm:');
  });

  it('passes a reset token from search params into the reset form', async () => {
    const html = renderToStaticMarkup(
      await ResetPasswordPage({ searchParams: Promise.resolve({ token: 'reset_token_12345' }) })
    );

    expect(html).toContain('ResetPasswordForm:reset_token_12345');
  });
});
