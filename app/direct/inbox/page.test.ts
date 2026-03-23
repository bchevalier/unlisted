import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('next/link', () => ({
  default: ({ href, children, ...props }: { href: string; children: React.ReactNode }) =>
    React.createElement('a', { href, ...props }, children),
}));

vi.mock('../../../features/direct/server/session', () => ({
  requireKeeperSession: vi.fn(),
}));

vi.mock('../../../features/direct/server/requests', () => ({
  listDoorsForKeeper: vi.fn(),
  listRequestsByDoorSlugForKeeper: vi.fn(),
}));

vi.mock('./request-actions', () => ({
  RequestActions: () => React.createElement('div', null, 'RequestActions'),
}));

import { listDoorsForKeeper, listRequestsByDoorSlugForKeeper } from '../../../features/direct/server/requests';
import { requireKeeperSession } from '../../../features/direct/server/session';
import DirectInboxPage from './page';

const requireKeeperSessionMock = vi.mocked(requireKeeperSession);
const listDoorsForKeeperMock = vi.mocked(listDoorsForKeeper);
const listRequestsByDoorSlugForKeeperMock = vi.mocked(listRequestsByDoorSlugForKeeper);

describe('DirectInboxPage demo fixture', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    requireKeeperSessionMock.mockResolvedValue({ userId: 'user_1', email: 'john@example.com' } as never);
    listDoorsForKeeperMock.mockResolvedValue([{ slug: 'alice', displayName: 'Alice', plan: 'FREE' }] as never);
    listRequestsByDoorSlugForKeeperMock.mockResolvedValue(null as never);
  });

  it('renders deterministic demo requests without depending on live inbox rows', async () => {
    const html = renderToStaticMarkup(
      await DirectInboxPage({
        searchParams: Promise.resolve({ slug: 'john', fixture: 'demo' }),
      })
    );

    expect(listRequestsByDoorSlugForKeeperMock).not.toHaveBeenCalled();
    expect(html).toContain('Inbox outcome summary');
    expect(html).toContain('Brand partnership with launch budget');
    expect(html).toContain('Campaign idea missing budget');
    expect(html).toContain('Advisory request awaiting completion');
    expect(html).toContain('Paid advisory request with verified org intent');
    expect(html).toContain('/direct/inbox/demo-awaiting-completion?slug=john&amp;fixture=demo');
    expect(html).toContain('Paid-intent filtered');
    expect(html).toContain('Signup → public door → inbox → settings');
    expect(html).toContain('You are here');
    expect(html).toContain('/direct/settings?slug=john&amp;fixture=demo');
  });
});
