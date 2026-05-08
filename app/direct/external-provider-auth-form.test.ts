import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { ExternalProviderAuthForm } from './external-provider-auth-form';

describe('ExternalProviderAuthForm', () => {
  it('shows the same preset-driven activation setup as password signup', () => {
    const html = renderToStaticMarkup(React.createElement(ExternalProviderAuthForm));

    expect(html).toContain('Choose your starting setup');
    expect(html).toContain('Creator / influencer');
    expect(html).toContain('Advisor / expert');
    expect(html).toContain('Public-facing professional');
    expect(html).toContain('Provider signups also start with a preset');
    expect(html).toContain('Continue with provider');
  });
});
