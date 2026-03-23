import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

vi.mock('next/link', () => ({
  default: ({ href, children, ...props }: { href: string; children: React.ReactNode }) =>
    React.createElement('a', { href, ...props }, children),
}));

import { DirectWalkthroughBanner } from './direct-walkthrough-banner';

describe('DirectWalkthroughBanner', () => {
  it('renders the four-step reviewer walkthrough with demo links by default', () => {
    const html = renderToStaticMarkup(React.createElement(DirectWalkthroughBanner));

    expect(html).toContain('Reviewer walkthrough');
    expect(html).toContain('Signup → public door → inbox → settings');
    expect(html).toContain('/direct/signup');
    expect(html).toContain('/u/john');
    expect(html).toContain('/direct/inbox?slug=john&amp;fixture=demo');
    expect(html).toContain('/direct/settings?slug=john&amp;fixture=demo');
  });

  it('marks the current step and supports non-demo links for a custom door slug', () => {
    const html = renderToStaticMarkup(
      React.createElement(DirectWalkthroughBanner, {
        currentStep: 'settings',
        doorSlug: 'alice',
        useDemoFixture: false,
      })
    );

    expect(html).toContain('Settings');
    expect(html).toContain('You are here');
    expect(html).toContain('/u/alice');
    expect(html).toContain('/direct/inbox?slug=alice');
    expect(html).toContain('/direct/settings?slug=alice');
    expect(html).not.toContain('&amp;fixture=demo');
  });
});
