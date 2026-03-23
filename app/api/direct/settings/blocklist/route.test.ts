import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ZodError, z } from 'zod';

const {
  getKeeperSessionFromRequestMock,
  listBlockedSendersForKeeperMock,
  addBlockedSenderForKeeperMock,
  removeBlockedSenderForKeeperMock,
} = vi.hoisted(() => ({
  getKeeperSessionFromRequestMock: vi.fn(),
  listBlockedSendersForKeeperMock: vi.fn(),
  addBlockedSenderForKeeperMock: vi.fn(),
  removeBlockedSenderForKeeperMock: vi.fn(),
}));

vi.mock('../../../../../lib/keeper-auth', () => ({
  getKeeperSessionFromRequest: getKeeperSessionFromRequestMock,
}));

vi.mock('../../../../../features/direct/server/requests', () => ({
  DirectValidationError: class DirectValidationError extends Error {
    statusCode: number;
    constructor(message: string, statusCode = 400) {
      super(message);
      this.statusCode = statusCode;
    }
  },
  addBlockedSenderForKeeper: addBlockedSenderForKeeperMock,
  listBlockedSendersForKeeper: listBlockedSendersForKeeperMock,
  removeBlockedSenderForKeeper: removeBlockedSenderForKeeperMock,
}));

vi.mock('../../../../../lib/logger', () => ({
  logger: vi.fn(() => ({ error: vi.fn(), info: vi.fn(), warn: vi.fn() })),
}));

vi.mock('../../../../../lib/error-tracking', () => ({
  captureException: vi.fn(),
}));

import { DirectValidationError } from '../../../../../features/direct/server/requests';
import { DELETE, GET, POST } from './route';

describe('/api/direct/settings/blocklist', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getKeeperSessionFromRequestMock.mockReturnValue({ userId: 'user_1', email: 'john@example.com' });
    listBlockedSendersForKeeperMock.mockResolvedValue([{ email: 'spam@example.com' }]);
    addBlockedSenderForKeeperMock.mockResolvedValue({ blockedSender: { email: 'spam@example.com' } });
    removeBlockedSenderForKeeperMock.mockResolvedValue({ removed: true });
  });

  it('GET returns 401 without a keeper session', async () => {
    getKeeperSessionFromRequestMock.mockReturnValue(null);
    const response = await GET(new Request('http://localhost/api/direct/settings/blocklist?slug=john'));
    const payload = await response.json();
    expect(response.status).toBe(401);
    expect(payload).toMatchObject({ ok: false, error: 'Unauthorized' });
  });

  it('GET returns 400 when slug is missing', async () => {
    const response = await GET(new Request('http://localhost/api/direct/settings/blocklist'));
    const payload = await response.json();
    expect(response.status).toBe(400);
    expect(payload).toMatchObject({ ok: false, error: 'Missing slug parameter' });
  });

  it('GET returns the keeper blocklist', async () => {
    const response = await GET(new Request('http://localhost/api/direct/settings/blocklist?slug=john'));
    const payload = await response.json();
    expect(response.status).toBe(200);
    expect(payload).toMatchObject({ ok: true, blockedSenders: [{ email: 'spam@example.com' }] });
    expect(listBlockedSendersForKeeperMock).toHaveBeenCalledWith('user_1', 'john');
  });

  it('POST adds a blocked sender', async () => {
    const response = await POST(new Request('http://localhost/api/direct/settings/blocklist', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ doorSlug: 'john', email: 'spam@example.com' }),
    }));
    const payload = await response.json();
    expect(response.status).toBe(200);
    expect(payload).toMatchObject({ ok: true, blockedSender: { email: 'spam@example.com' } });
    expect(addBlockedSenderForKeeperMock).toHaveBeenCalledWith('user_1', { doorSlug: 'john', email: 'spam@example.com' });
  });

  it('DELETE removes a blocked sender', async () => {
    const response = await DELETE(new Request('http://localhost/api/direct/settings/blocklist', {
      method: 'DELETE',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ doorSlug: 'john', email: 'spam@example.com' }),
    }));
    const payload = await response.json();
    expect(response.status).toBe(200);
    expect(payload).toMatchObject({ ok: true, removed: true });
    expect(removeBlockedSenderForKeeperMock).toHaveBeenCalledWith('user_1', { doorSlug: 'john', email: 'spam@example.com' });
  });

  it('POST returns 400 for invalid payloads', async () => {
    addBlockedSenderForKeeperMock.mockRejectedValue(new ZodError([
      {
        code: z.ZodIssueCode.invalid_type,
        expected: 'string',
        received: 'undefined',
        path: ['email'],
        message: 'Required',
      },
    ]));

    const response = await POST(new Request('http://localhost/api/direct/settings/blocklist', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ doorSlug: 'john' }),
    }));
    const payload = await response.json();
    expect(response.status).toBe(400);
    expect(payload.ok).toBe(false);
    expect(payload.error).toBe('Invalid payload');
    expect(payload.issues).toHaveLength(1);
  });

  it('GET preserves DirectValidationError status codes', async () => {
    listBlockedSendersForKeeperMock.mockRejectedValue(new DirectValidationError('Door not found', 404));
    const response = await GET(new Request('http://localhost/api/direct/settings/blocklist?slug=john'));
    const payload = await response.json();
    expect(response.status).toBe(404);
    expect(payload).toMatchObject({ ok: false, error: 'Door not found' });
  });
});
