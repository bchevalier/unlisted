import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { PasswordRecoveryForm } from './password-recovery-form';

describe('PasswordRecoveryForm', () => {
  it('renders both request-reset and confirm-reset flows in one recovery surface', () => {
    const html = renderToStaticMarkup(React.createElement(PasswordRecoveryForm));

    expect(html).toContain('Password recovery');
    expect(html).toContain('name="resetEmail"');
    expect(html).toContain('Request reset');
    expect(html).toContain('name="token"');
    expect(html).toContain('name="newPassword"');
    expect(html).toContain('Confirm reset');
  });
});
