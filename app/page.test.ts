import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

vi.mock('next/image', () => ({
  default: (props: Record<string, unknown>) => {
    const safeProps = { ...props };
    delete safeProps.priority;
    return React.createElement('img', safeProps);
  },
}));

vi.mock('next/link', () => ({
  default: ({ href, children, ...props }: { href: string; children: React.ReactNode }) =>
    React.createElement('a', { href, ...props }, children),
}));

import HomePage from './page';

describe('HomePage', () => {
  it('uses accessible-without-vulnerable framing plus one brutally concrete line', () => {
    const html = renderToStaticMarkup(React.createElement(HomePage));

    expect(html).toContain('Be accessible without being vulnerable.');
    expect(html).toContain('Knokio is the access layer between you and the outside world.');
    expect(html).toContain('More signal. Less noise. Private until');
    expect(html).toContain('approved.');
    expect(html).toContain('Filter inbound requests before they reach your email, DMs, or private channels');
    expect(html).toContain('private identity people can reach before you choose to respond.');
    expect(html).toContain('Not a social network. Not a public directory. A private interface for controlled access.');
  });

  it('makes the Direct vs Reach split explicit with clearer card wording', () => {
    const html = renderToStaticMarkup(React.createElement(HomePage));

    expect(html).toContain('Choose the access problem you want Knokio to solve.');
    expect(html).toContain('Knokio Direct');
    expect(html).toContain('Protect your inbox');
    expect(html).toContain('Protect my inbox');
    expect(html).toContain('Inbound control');
    expect(html).toContain('Direct filters and structures inbound before it reaches your private channels.');
    expect(html).toContain('Knokio Reach');
    expect(html).toContain('Be reachable without a public profile');
    expect(html).toContain('Create a private identity people can reach without disclosing who you are before you accept.');
    expect(html).toContain('Set up Reach');
    expect(html).toContain('Private contact path');
    expect(html).toContain('People do not browse you. Reach gives the right requests a private path to you.');
    expect(html).toContain('home-lane-proof');
    expect(html).toContain('home-proof-card-featured');
  });
});
