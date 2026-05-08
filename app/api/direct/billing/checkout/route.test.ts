import { beforeEach, describe, expect, it, vi } from 'vitest';

const { createCheckoutSessionMock, getKeeperSessionFromRequestMock } = vi.hoisted(() => ({
  createCheckoutSessionMock: vi.fn(),
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
  createCheckoutSession: createCheckoutSessionMock,
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
import { POST } from './route';

describe('POST /api/direct/billing/checkout', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getKeeperSessionFromRequestMock.mockReturnValue({ userId: 'user_1' });
    createCheckoutSessionMock.mockResolvedValue('https://stripe.test/checkout');
  });

  it('returns 401 without a keeper session', async () => {
    getKeeperSessionFromRequestMock.mockReturnValue(null);

    const response = await POST(new Request('http://localhost/api/direct/billing/checkout', { method: 'POST' }));
    const payload = await response.json();

    expect(response.status).toBe(401);
    expect(payload).toMatchObject({ ok: false, error: 'Unauthorized' });
    expect(createCheckoutSessionMock).not.toHaveBeenCalled();
  });

  it('returns 400 for an invalid checkout payload', async () => {
    const response = await POST(new Request('http://localhost/api/direct/billing/checkout', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ doorSlug: '' }),
    }));
    const payload = await response.json();

    expect(response.status).toBe(400);
    expect(payload.error).toBe('Invalid payload');
    expect(createCheckoutSessionMock).not.toHaveBeenCalled();
  });

  it('returns the checkout URL for the authenticated keeper', async () => {
    const response = await POST(new Request('http://localhost/api/direct/billing/checkout', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ doorSlug: 'john' }),
    }));
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload).toMatchObject({ ok: true, url: 'https://stripe.test/checkout' });
    expect(createCheckoutSessionMock).toHaveBeenCalledWith('user_1', 'john');
  });

  it('preserves billing-authoritative checkout failures at the HTTP layer', async () => {
    createCheckoutSessionMock.mockRejectedValue(new BillingError('Door already has an active subscription', 400));

    const response = await POST(new Request('http://localhost/api/direct/billing/checkout', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ doorSlug: 'john' }),
    }));
    const payload = await response.json();

    expect(response.status).toBe(400);
    expect(payload).toMatchObject({ ok: false, error: 'Door already has an active subscription' });
  });
});
