import { beforeEach, describe, expect, it, vi, afterAll } from 'vitest';

const { sendDigestNotificationsMock } = vi.hoisted(() => ({
  sendDigestNotificationsMock: vi.fn(),
}));

vi.mock('../../../../../features/direct/server/digest', () => ({
  sendDigestNotifications: sendDigestNotificationsMock,
}));

vi.mock('../../../../../lib/logger', () => ({
  logger: vi.fn(() => ({ error: vi.fn(), info: vi.fn(), warn: vi.fn() })),
}));

vi.mock('../../../../../lib/error-tracking', () => ({
  captureException: vi.fn(),
}));

import { POST } from './route';

const originalCronSecret = process.env.CRON_SECRET;

describe('POST /api/direct/notifications/digest', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.CRON_SECRET = '1234567890abcdef';
    sendDigestNotificationsMock.mockResolvedValue({ processed: 4, sent: 3 });
  });

  afterAll(() => {
    if (originalCronSecret === undefined) {
      delete process.env.CRON_SECRET;
    } else {
      process.env.CRON_SECRET = originalCronSecret;
    }
  });

  it('returns 503 when the digest cron endpoint is not configured', async () => {
    delete process.env.CRON_SECRET;

    const response = await POST(new Request('http://localhost/api/direct/notifications/digest', { method: 'POST' }) as never);
    const payload = await response.json();

    expect(response.status).toBe(503);
    expect(payload).toEqual({ error: 'Cron endpoint not configured' });
    expect(sendDigestNotificationsMock).not.toHaveBeenCalled();
  });

  it('returns 401 when the cron bearer secret is missing or wrong', async () => {
    const response = await POST(new Request('http://localhost/api/direct/notifications/digest', { method: 'POST' }) as never);
    const payload = await response.json();

    expect(response.status).toBe(401);
    expect(payload).toEqual({ error: 'Unauthorized' });
    expect(sendDigestNotificationsMock).not.toHaveBeenCalled();
  });

  it('sends digests when called with the configured cron secret', async () => {
    const response = await POST(new Request('http://localhost/api/direct/notifications/digest', {
      method: 'POST',
      headers: { authorization: 'Bearer 1234567890abcdef' },
    }) as never);
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload).toMatchObject({ ok: true, processed: 4, sent: 3 });
    expect(sendDigestNotificationsMock).toHaveBeenCalledTimes(1);
  });
});
