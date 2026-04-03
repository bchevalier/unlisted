import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

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

vi.mock('../../lib/keeper-auth', () => ({
  getKeeperSessionFromCookies: vi.fn(),
}));

vi.mock('./logout-button', () => ({
  LogoutButton: () => React.createElement('button', { type: 'button' }, 'Log out'),
}));

import { getKeeperSessionFromCookies } from '../../lib/keeper-auth';
import DirectClientPage from './page';

const mock = vi.mocked(getKeeperSessionFromCookies);

async function render() {
  return renderToStaticMarkup(await DirectClientPage());
}

describe('DirectClientPage', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('renders a short convince-and-orient landing for signed-out visitors', async () => {
    mock.mockResolvedValue(null as never);
    const html = await render();

    expect(html).toContain('Stay reachable without losing control of your inbox.');
    expect(html).toContain('Protect my inbox');
    expect(html).toContain('See a live example');
    expect(html).toContain('Private until you approve');
    expect(html).toContain('Every request arrives with context');
    expect(html).toContain('Noise never reaches you');
    expect(html).toContain('access layer');
    expect(html).toContain('Who Direct is for');
    expect(html).toContain('Online services and small businesses');
    expect(html).toContain('Public figures');
    expect(html).toContain('Freelancers and agencies');
    expect(html).toContain('See more use cases');
    expect(html).toContain('Open source maintainers');
    expect(html).toContain('How Direct works');
    expect(html).toContain('See Direct in action');
    expect(html).toContain('Plans');
    expect(html).toContain('FAQ');
    expect(html).toContain('Your inbox is yours. Keep it that way.');
  });

  it('preserves signed-in states', async () => {
    mock.mockResolvedValue({ userId: 'u1', email: 'j@example.com' } as never);
    const html = await render();

    expect(html).toContain('j@example.com');
    expect(html).toContain('Protect my inbox');
    expect(html).toContain('See a live example');
  });
});
