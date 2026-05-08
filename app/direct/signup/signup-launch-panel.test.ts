import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { SignupLaunchPanel } from './signup-form';

describe('SignupLaunchPanel', () => {
  it('shows the created door, seeded categories, and immediate next actions', () => {
    const html = renderToStaticMarkup(
      React.createElement(SignupLaunchPanel, {
        email: 'john@example.com',
        doorSlug: 'john',
        doorPlan: 'FREE',
        verificationToken: 'verify_123',
        preset: {
          value: 'CREATOR',
          label: 'Creator / influencer',
          copy: 'Start with brand deals, collabs, and serious inbound already structured.',
          launch: [
            'A private-by-default door for brand deals, collabs, and other serious inbound',
            'Structured categories with required context before requests touch your inbox',
          ],
          categories: ['Brand / Product Placement', 'Collaboration', 'Other'],
        },
      })
    );

    expect(html).toContain('Your first Direct door is ready to launch');
    expect(html).toContain('@john');
    expect(html).toContain('Brand / Product Placement');
    expect(html).toContain('Collaboration');
    expect(html).toContain('Open public door');
    expect(html).toContain('Log in to inbox');
    expect(html).toContain('Review settings');
    expect(html).toContain('First-run checklist');
    expect(html).toContain('confirm the right categories are visible');
    expect(html).toContain('confirm inbox + settings access');
    expect(html).toContain('caps, routing, and private-contact protection');
    expect(html).toContain('Verify your email now');
  });
});
