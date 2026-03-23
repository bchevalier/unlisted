import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

vi.mock('./verify-email-form', () => ({
  VerifyEmailForm: ({ token }: { token: string }) =>
    React.createElement('div', null, `VerifyEmailForm:${token}`),
}));

import VerifyEmailPage from './page';

describe('VerifyEmailPage', () => {
  it('renders the email-verification surface and empty-token fallback', async () => {
    const html = renderToStaticMarkup(await VerifyEmailPage({}));

    expect(html).toContain('Verify email');
    expect(html).toContain('Confirm your email to activate password login for Knokio Direct.');
    expect(html).toContain('VerifyEmailForm:');
  });

  it('passes a verification token from search params into the verification form', async () => {
    const html = renderToStaticMarkup(
      await VerifyEmailPage({ searchParams: Promise.resolve({ token: 'verify_token_12345' }) })
    );

    expect(html).toContain('VerifyEmailForm:verify_token_12345');
  });
});
