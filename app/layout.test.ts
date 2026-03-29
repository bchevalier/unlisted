import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

vi.mock('next/link', () => ({
  default: ({ href, children, ...props }: { href: string; children: React.ReactNode }) =>
    React.createElement('a', { href, ...props }, children),
}));

import RootLayout from './layout';

describe('RootLayout', () => {
  it('frames the shared note as suite-level trust copy', () => {
    const html = renderToStaticMarkup(React.createElement(RootLayout, { children: React.createElement('main', null, 'test') }));

    expect(html).toContain('How Knokio works');
    expect(html).toContain('Knokio is an access layer.');
    expect(html).toContain('Direct protects inbound before it reaches your inbox');
    expect(html).toContain('Reach lets people contact a private identity before your real identity is disclosed.');
    expect(html).toContain('Private channels stay private until the interaction is approved.');
    expect(html).not.toContain('For AI agents');
    expect(html).not.toContain('Agent to agent:');
  });
});
