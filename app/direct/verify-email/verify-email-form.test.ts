import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { VerifyEmailForm } from './verify-email-form';

describe('VerifyEmailForm', () => {
  it('renders the verification token field seeded from props', () => {
    const html = renderToStaticMarkup(
      React.createElement(VerifyEmailForm, { token: 'verify_token_12345' })
    );

    expect(html).toContain('Verification token');
    expect(html).toContain('value="verify_token_12345"');
    expect(html).toContain('Verify email');
  });
});
