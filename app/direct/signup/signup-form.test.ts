import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { SignupForm } from './signup-form';

describe('SignupForm', () => {
  it('shows an immediate default setup preview before deep customization', () => {
    const html = renderToStaticMarkup(React.createElement(SignupForm));

    expect(html).toContain('Choose your starting setup');
    expect(html).toContain('Your first door launches with');
    expect(html).toContain('Creator / influencer');
    expect(html).toContain('A private-by-default door for brand deals, collabs, and other serious inbound');
    expect(html).toContain('Structured categories with required context before requests touch your inbox');
    expect(html).toContain('A public @alias plus inbox caps so noise stays out from day one');
  });
});
