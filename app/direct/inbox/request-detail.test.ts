import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { requireKeeperSessionMock, getRequestDetailForKeeperMock } = vi.hoisted(() => ({
  requireKeeperSessionMock: vi.fn(),
  getRequestDetailForKeeperMock: vi.fn(),
}));

vi.mock('next/link', () => ({
  default: ({ href, children, ...props }: { href: string; children: React.ReactNode }) =>
    React.createElement('a', { href, ...props }, children),
}));

vi.mock('../../../features/direct/server/session', () => ({
  requireKeeperSession: requireKeeperSessionMock,
}));

vi.mock('../../../features/direct/server/requests', () => ({
  getRequestDetailForKeeper: getRequestDetailForKeeperMock,
}));

vi.mock('./request-actions', () => ({
  RequestActions: () => React.createElement('div', null, 'RequestActions'),
}));

import RequestDetailPage from './[requestId]/page';

describe('RequestDetailPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    requireKeeperSessionMock.mockResolvedValue({ userId: 'user_1', email: 'john@example.com' });
    getRequestDetailForKeeperMock.mockResolvedValue(null);
  });

  it('renders the demo-fixture request detail without depending on auth or live request rows', async () => {
    requireKeeperSessionMock.mockRejectedValue(new Error('should not be called'));

    const html = renderToStaticMarkup(
      await RequestDetailPage({
        params: Promise.resolve({ requestId: 'demo-paid-intent' }),
        searchParams: Promise.resolve({ slug: 'john', fixture: 'demo' }),
      })
    );

    expect(requireKeeperSessionMock).not.toHaveBeenCalled();
    expect(getRequestDetailForKeeperMock).not.toHaveBeenCalled();
    expect(html).toContain('Paid advisory request with verified org intent');
    expect(html).toContain('Accepted into inbox');
    expect(html).toContain('Direct let this through because it had enough signal to earn inbox space.');
    expect(html).toContain('Quote Snapshot');
    expect(html).toContain('Verified orgs only');
    expect(html).toContain('/direct/inbox?slug=john&amp;fixture=demo');
    expect(html).toContain('RequestActions');
  });

  it('renders live request detail states with stable routing narrative coverage', async () => {
    getRequestDetailForKeeperMock.mockResolvedValue({
      id: 'req_live_1',
      source: 'FORM',
      status: 'AWAITING_COMPLETION',
      senderName: 'Sam Rivera',
      senderEmail: 'sam@signalops.example',
      title: 'Advisory request awaiting completion',
      message: 'Need help with growth advisory and positioning.',
      structuredData: { topic: 'Growth advisory', budget: '$5000' },
      requestToken: 'req_token_live',
      completionExpiresAt: '2026-03-23T11:00:00.000Z',
      createdAt: '2026-03-20T11:00:00.000Z',
      updatedAt: '2026-03-20T11:05:00.000Z',
      requesterType: 'ORGANIZATION',
      requesterOrgName: 'SignalOps',
      requesterOrgWebsite: 'https://signalops.example',
      requesterRoleTitle: 'Founder',
      requesterVerificationStatus: 'BASIC_VERIFIED',
      requesterVerificationReason: 'Completion link sent to verified sender email',
      keeperQuoteAmountCents: null,
      keeperQuoteCurrency: null,
      keeperQuoteNote: null,
      category: { label: 'Advisory' },
      door: {
        slug: 'john',
        settings: {
          revealMethod: 'EMAIL',
          revealValue: 'john@knokio.example',
          quoteVisibleToVerifiedOrgsOnly: true,
        },
      },
      events: [
        {
          id: 'evt_1',
          type: 'COMPLETION_REQUESTED',
          actor: 'SYSTEM',
          note: 'Waiting on budget and decision timeline.',
          createdAt: '2026-03-20T11:05:00.000Z',
        },
      ],
    });

    const html = renderToStaticMarkup(
      await RequestDetailPage({
        params: Promise.resolve({ requestId: 'req_live_1' }),
        searchParams: Promise.resolve({ slug: 'john' }),
      })
    );

    expect(requireKeeperSessionMock).toHaveBeenCalledWith('/direct/inbox');
    expect(getRequestDetailForKeeperMock).toHaveBeenCalledWith('user_1', 'req_live_1');
    expect(html).toContain('Waiting on more detail');
    expect(html).toContain('Direct asked for the missing context before this reaches your inbox.');
    expect(html).toContain('Awaiting form completion');
    expect(html).toContain('SignalOps');
    expect(html).toContain('Growth advisory');
    expect(html).toContain('Event History');
    expect(html).toContain('RequestActions');
  });
});
