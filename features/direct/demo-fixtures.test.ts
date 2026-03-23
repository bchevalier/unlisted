import { RequestStatus } from '@prisma/client';
import { describe, expect, it } from 'vitest';
import {
  DIRECT_DEMO_SLUG,
  getDirectDemoInboxFixture,
  getDirectDemoRequestFixture,
  isDirectDemoFixture,
} from './demo-fixtures';

describe('direct demo fixtures', () => {
  it('builds a deterministic inbox fixture with accepted, auto-replied, awaiting-completion, and paid-intent states', () => {
    const fixture = getDirectDemoInboxFixture();

    expect(fixture.slug).toBe(DIRECT_DEMO_SLUG);
    expect(fixture.requests).toHaveLength(4);
    expect(fixture.requests.map((request) => request.status)).toEqual([
      'ACCEPTED',
      'AUTO_REPLIED',
      'AWAITING_COMPLETION',
      'ACCEPTED',
    ]);
    expect(fixture.requests.filter((request) => (request.paidAmountCents ?? 0) > 0)).toHaveLength(1);
    expect(fixture.statusCounts).toMatchObject({
      ACCEPTED: 2,
      AUTO_REPLIED: 1,
      AWAITING_COMPLETION: 1,
    });
  });

  it('supports filtered inbox views and detailed request fixtures', () => {
    const filtered = getDirectDemoInboxFixture({ status: RequestStatus.AWAITING_COMPLETION });
    const detail = getDirectDemoRequestFixture('demo-paid-intent');

    expect(filtered.requests).toHaveLength(1);
    expect(filtered.requests[0]?.id).toBe('demo-awaiting-completion');
    expect(filtered.pagination.totalCount).toBe(1);

    expect(detail).toMatchObject({
      id: 'demo-paid-intent',
      status: 'ACCEPTED',
      keeperQuoteAmountCents: 15000,
      requesterVerificationStatus: 'ORG_VERIFIED',
      door: {
        slug: DIRECT_DEMO_SLUG,
      },
    });
  });

  it('recognizes the explicit demo fixture query flag', () => {
    expect(isDirectDemoFixture('demo')).toBe(true);
    expect(isDirectDemoFixture('anything-else')).toBe(false);
    expect(isDirectDemoFixture(undefined)).toBe(false);
  });
});
