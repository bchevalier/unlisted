import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { ResetPasswordForm } from './reset-password-form';

describe('ResetPasswordForm', () => {
  it('renders a reset token field seeded from props plus the new-password control', () => {
    const html = renderToStaticMarkup(
      React.createElement(ResetPasswordForm, { token: 'reset_token_12345' })
    );

    expect(html).toContain('Reset token');
    expect(html).toContain('value="reset_token_12345"');
    expect(html).toContain('New password');
    expect(html).toContain('name="newPassword"');
    expect(html).toContain('Reset password');
  });
});
