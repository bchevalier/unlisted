import { beforeEach, describe, expect, it, vi } from 'vitest';

const { getBillingStatusMock, getKeeperSessionFromRequestMock } = vi.hoisted(() => ({
  getBillingStatusMock: vi.fn(),
  getKeeperSessionFromRequestMock: vi.fn(),
}));

vi.mock('../../../../../features/direct/server/billing', () => ({
  BillingError: class BillingError extends Error {
    statusCode: number;
    constructor(message: string, statusCode: number) {
      super(message);
      this.statusCode = statusCode;
    }
  },
  getBillingStatus: getBillingStatusMock,
}));

vi.mock('../../../../../lib/keeper-auth', () => ({
  getKeeperSessionFromRequest: getKeeperSessionFromRequestMock,
}));

vi.mock('../../../../../lib/error-tracking', () => ({
  captureException: vi.fn(),
}));

vi.mock('../../../../../lib/logger', () => ({
  logger: vi.fn(() => ({ error: vi.fn(), info: vi.fn(), warn: vi.fn() })),
}));

import { BillingError } from '../../../../../features/direct/server/billing';
import { GET } from './route';

describe('GET /api/direct/billing/status', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getKeeperSessionFromRequestMock.mockReturnValue({ userId: 'user_1' });
    getBillingStatusMock.mockResolvedValue({
      plan: 'FREE',
      stripeSubscriptionStatus: null,
      stripePriceId: null,
      currentPeriodEnd: null,
      hasStripeCustomer: false,
    });
  });

  it('returns 401 without a keeper session', async () => {
    getKeeperSessionFromRequestMock.mockReturnValue(null);

    const response = await GET(new Request('http://localhost/api/direct/billing/status?slug=john'));
    const payload = await response.json();

    expect(response.status).toBe(401);
    expect(payload).toMatchObject({ ok: false, error: 'Unauthorized' });
    expect(getBillingStatusMock).not.toHaveBeenCalled();
  });

  it('returns 400 when the slug parameter is missing', async () => {
    const response = await GET(new Request('http://localhost/api/direct/billing/status'));
    const payload = await response.json();

    expect(response.status).toBe(400);
    expect(payload).toMatchObject({ ok: false, error: 'Missing slug parameter' });
    expect(getBillingStatusMock).not.toHaveBeenCalled();
  });

  it('returns the billing status for the authenticated keeper', async () => {
    const response = await GET(new Request('http://localhost/api/direct/billing/status?slug=john'));
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload).toMatchObject({ ok: true, billing: { plan: 'FREE', stripeSubscriptionStatus: null } });
    expect(getBillingStatusMock).toHaveBeenCalledWith('user_1', 'john');
  });

  it('preserves BillingError status codes at the HTTP layer', async () => {
    getBillingStatusMock.mockRejectedValue(new BillingError('Door not found', 404));

    const response = await GET(new Request('http://localhost/api/direct/billing/status?slug=john'));
    const payload = await response.json();

    expect(response.status).toBe(404);
    expect(payload).toMatchObject({ ok: false, error: 'Door not found' });
  });
});
