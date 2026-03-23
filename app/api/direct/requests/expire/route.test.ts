import { beforeEach, describe, expect, it, vi } from 'vitest';

const { expireStaleRequestsMock, incrementMock } = vi.hoisted(() => ({
  expireStaleRequestsMock: vi.fn(),
  incrementMock: vi.fn(),
}));

vi.mock('../../../../../features/direct/server/requests', () => ({
  expireStaleRequests: expireStaleRequestsMock,
}));

vi.mock('../../../../../lib/logger', () => ({
  logger: vi.fn(() => ({ error: vi.fn(), info: vi.fn(), warn: vi.fn() })),
}));

vi.mock('../../../../../lib/error-tracking', () => ({
  captureException: vi.fn(),
}));

vi.mock('../../../../../lib/metrics', () => ({
  increment: incrementMock,
  METRIC: { REQUEST_EXPIRED: 'REQUEST_EXPIRED' },
}));

import { POST } from './route';

const originalCronSecret = process.env.CRON_SECRET;
const originalExpiryDays = process.env.REQUEST_EXPIRY_DAYS;

describe('POST /api/direct/requests/expire', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.CRON_SECRET = '1234567890abcdef';
    process.env.REQUEST_EXPIRY_DAYS = '14';
    expireStaleRequestsMock.mockResolvedValue({ scanned: 12, expired: 3 });
  });

  afterAll(() => {
    if (originalCronSecret === undefined) delete process.env.CRON_SECRET; else process.env.CRON_SECRET = originalCronSecret;
    if (originalExpiryDays === undefined) delete process.env.REQUEST_EXPIRY_DAYS; else process.env.REQUEST_EXPIRY_DAYS = originalExpiryDays;
  });

  it('returns 503 when the cron endpoint is not configured', async () => {
    delete process.env.CRON_SECRET;

    const response = await POST(new Request('http://localhost/api/direct/requests/expire', { method: 'POST' }));
    const payload = await response.json();

    expect(response.status).toBe(503);
    expect(payload).toEqual({ error: 'Cron endpoint not configured' });
    expect(expireStaleRequestsMock).not.toHaveBeenCalled();
  });

  it('returns 401 when the cron bearer secret is missing or wrong', async () => {
    const response = await POST(new Request('http://localhost/api/direct/requests/expire', { method: 'POST' }));
    const payload = await response.json();

    expect(response.status).toBe(401);
    expect(payload).toEqual({ error: 'Unauthorized' });
    expect(expireStaleRequestsMock).not.toHaveBeenCalled();
  });

  it('expires stale requests with configured expiry days', async () => {
    const response = await POST(new Request('http://localhost/api/direct/requests/expire', {
      method: 'POST',
      headers: { authorization: 'Bearer 1234567890abcdef' },
    }));
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload).toMatchObject({ ok: true, scanned: 12, expired: 3 });
    expect(expireStaleRequestsMock).toHaveBeenCalledWith({ expiryDays: 14 });
    expect(incrementMock).toHaveBeenCalledWith('REQUEST_EXPIRED', 3);
  });

  it('falls back to 30 days when REQUEST_EXPIRY_DAYS is invalid', async () => {
    process.env.REQUEST_EXPIRY_DAYS = '0';

    await POST(new Request('http://localhost/api/direct/requests/expire', {
      method: 'POST',
      headers: { authorization: 'Bearer 1234567890abcdef' },
    }));

    expect(expireStaleRequestsMock).toHaveBeenCalledWith({ expiryDays: 30 });
  });
});
