import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { TwoFactorPanel } from './two-factor-panel';

describe('TwoFactorPanel', () => {
  it('renders the disabled setup state until email verification is complete', () => {
    const html = renderToStaticMarkup(
      React.createElement(TwoFactorPanel, {
        email: 'john@example.com',
        emailVerified: false,
        twoFactorEnabled: false,
      })
    );

    expect(html).toContain('Account security');
    expect(html).toContain('john@example.com');
    expect(html).toContain('not verified');
    expect(html).toContain('2FA status: <strong>disabled</strong>');
    expect(html).toContain('Start 2FA setup');
    expect(html).toContain('disabled=""');
    expect(html).toContain('Verify your email before enabling 2FA.');
    expect(html).not.toContain('Disable 2FA');
  });

  it('renders the enabled-management state when 2FA is already on', () => {
    const html = renderToStaticMarkup(
      React.createElement(TwoFactorPanel, {
        email: 'john@example.com',
        emailVerified: true,
        twoFactorEnabled: true,
      })
    );

    expect(html).toContain('verified');
    expect(html).toContain('2FA status: <strong>enabled</strong>');
    expect(html).toContain('Disable 2FA');
    expect(html).not.toContain('Start 2FA setup');
  });
});
