import { beforeEach, describe, expect, it, vi } from 'vitest';

const { createBillingPortalSessionMock, getKeeperSessionFromRequestMock } = vi.hoisted(() => ({
  createBillingPortalSessionMock: vi.fn(),
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
  createBillingPortalSession: createBillingPortalSessionMock,
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

describe('POST /api/direct/billing/portal', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getKeeperSessionFromRequestMock.mockReturnValue({ userId: 'user_1' });
    createBillingPortalSessionMock.mockResolvedValue('https://stripe.test/portal');
  });

  it('returns 401 without a keeper session', async () => {
    getKeeperSessionFromRequestMock.mockReturnValue(null);

    const response = await POST(new Request('http://localhost/api/direct/billing/portal', { method: 'POST' }));
    const payload = await response.json();

    expect(response.status).toBe(401);
    expect(payload).toMatchObject({ ok: false, error: 'Unauthorized' });
    expect(createBillingPortalSessionMock).not.toHaveBeenCalled();
  });

  it('returns 400 for an invalid portal payload', async () => {
    const response = await POST(new Request('http://localhost/api/direct/billing/portal', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ doorSlug: '' }),
    }));
    const payload = await response.json();

    expect(response.status).toBe(400);
    expect(payload.error).toBe('Invalid payload');
    expect(createBillingPortalSessionMock).not.toHaveBeenCalled();
  });

  it('returns the portal URL for the authenticated keeper', async () => {
    const response = await POST(new Request('http://localhost/api/direct/billing/portal', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ doorSlug: 'john' }),
    }));
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload).toMatchObject({ ok: true, url: 'https://stripe.test/portal' });
    expect(createBillingPortalSessionMock).toHaveBeenCalledWith('user_1', 'john');
  });

  it('preserves billing portal failures at the HTTP layer', async () => {
    createBillingPortalSessionMock.mockRejectedValue(new BillingError('No billing account found', 400));

    const response = await POST(new Request('http://localhost/api/direct/billing/portal', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ doorSlug: 'john' }),
    }));
    const payload = await response.json();

    expect(response.status).toBe(400);
    expect(payload).toMatchObject({ ok: false, error: 'No billing account found' });
  });
});
