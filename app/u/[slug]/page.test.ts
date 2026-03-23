import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('next/link', () => ({
  default: ({ href, children, ...props }: { href: string; children: React.ReactNode }) =>
    React.createElement('a', { href, ...props }, children),
}));

vi.mock('../../../features/direct/server/door', () => ({
  getPublicDoorBySlug: vi.fn(),
}));

vi.mock('../../../lib/turnstile', () => ({
  getTurnstileSiteKey: vi.fn(() => null),
}));

vi.mock('./knock-form', () => ({
  KnockForm: () => React.createElement('form', null, 'KnockForm'),
}));

import { getPublicDoorBySlug } from '../../../features/direct/server/door';
import DoorPage from './page';

const getPublicDoorBySlugMock = vi.mocked(getPublicDoorBySlug);

describe('DoorPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('explains that the door keeps private contact hidden until the keeper chooses otherwise', async () => {
    getPublicDoorBySlugMock.mockResolvedValue({
      slug: 'john',
      displayName: 'John Mikato',
      headline: 'Brand partnerships and advisory access',
    } as never);

    const html = renderToStaticMarkup(await DoorPage({ params: Promise.resolve({ slug: 'john' }) }));

    expect(html).toContain('class="door-page direct-surface-shell"');
    expect(html).toContain('direct-surface-card direct-surface-card-header');
    expect(html).toContain('Knokio Direct');
    expect(html).toContain('Requests here are structured before they reach a private inbox.');
    expect(html).toContain('Contact details stay hidden unless the keeper chooses to reveal them later.');
    expect(html).toContain('Private by default. Reachable without searchable.');
  });
});
