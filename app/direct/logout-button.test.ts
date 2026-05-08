import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
}));

import { LogoutButton } from './logout-button';

describe('LogoutButton', () => {
  it('renders a button that exposes the logout action', () => {
    const html = renderToStaticMarkup(React.createElement(LogoutButton));

    expect(html).toContain('Logout');
    expect(html).toContain('type="button"');
  });
});
