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
  it('speaks to high-inbound creators, advisors, and public-facing professionals without narrowing the product to one ICP', () => {
    const html = renderToStaticMarkup(React.createElement(HomePage));

    expect(html).toContain('Protect your inbox. Stay reachable for serious opportunities.');
    expect(html).toContain('Creators, advisors, and public-facing professionals');
    expect(html).toContain('brand outreach');
    expect(html).toContain('advisory requests');
    expect(html).toContain('business inquiries');
    expect(html).toContain('Private by default');
    expect(html).toContain('High-intent access lanes');
  });

  it('keeps the Direct lane card explicitly aimed at serious inbound for high-visibility users', () => {
    const html = renderToStaticMarkup(React.createElement(HomePage));

    expect(html).toContain('Knokio Direct');
    expect(html).toContain('For creators, advisors, and public-facing people who need serious inbound without inbox chaos.');
    expect(html).toContain('Open Direct');
    expect(html).toContain('Knokio Reach');
    expect(html).toContain('One-hop reachability, even for people who don');
    expect(html).toContain('know you yet.');
  });
});
