import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ZodError, z } from 'zod';

const { updateRequestStatusForKeeperMock, getKeeperSessionFromRequestMock } = vi.hoisted(() => ({
  updateRequestStatusForKeeperMock: vi.fn(),
  getKeeperSessionFromRequestMock: vi.fn(),
}));

vi.mock('../../../../../../features/direct/server/requests', () => ({
  DirectValidationError: class DirectValidationError extends Error {
    statusCode: number;
    constructor(message: string, statusCode = 400) {
      super(message);
      this.statusCode = statusCode;
    }
  },
  updateRequestStatusForKeeper: updateRequestStatusForKeeperMock,
}));

vi.mock('../../../../../../lib/keeper-auth', () => ({
  getKeeperSessionFromRequest: getKeeperSessionFromRequestMock,
}));

vi.mock('../../../../../../lib/logger', () => ({
  logger: vi.fn(() => ({ error: vi.fn(), info: vi.fn(), warn: vi.fn() })),
}));

vi.mock('../../../../../../lib/error-tracking', () => ({
  captureException: vi.fn(),
}));

import { DirectValidationError } from '../../../../../../features/direct/server/requests';
import { POST } from './route';

describe('POST /api/direct/requests/[requestId]/status', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getKeeperSessionFromRequestMock.mockReturnValue({ userId: 'user_1', email: 'john@example.com' });
    updateRequestStatusForKeeperMock.mockResolvedValue({ id: 'req_1', status: 'ACCEPTED' });
  });

  it('returns 401 without a keeper session', async () => {
    getKeeperSessionFromRequestMock.mockReturnValue(null);

    const response = await POST(new Request('http://localhost/api/direct/requests/req_1/status', { method: 'POST' }));
    const payload = await response.json();

    expect(response.status).toBe(401);
    expect(payload).toMatchObject({ ok: false, error: 'Unauthorized' });
    expect(updateRequestStatusForKeeperMock).not.toHaveBeenCalled();
  });

  it('updates request status for the authenticated keeper', async () => {
    const response = await POST(new Request('http://localhost/api/direct/requests/req_1/status', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ status: 'ACCEPTED' }),
    }));
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload).toMatchObject({ ok: true, request: { id: 'req_1', status: 'ACCEPTED' } });
    expect(updateRequestStatusForKeeperMock).toHaveBeenCalledWith('user_1', 'req_1', { status: 'ACCEPTED' });
  });

  it('returns 400 for invalid payloads', async () => {
    updateRequestStatusForKeeperMock.mockRejectedValue(new ZodError([
      {
        code: z.ZodIssueCode.invalid_type,
        expected: 'string',
        received: 'undefined',
        path: ['status'],
        message: 'Required',
      },
    ]));

    const response = await POST(new Request('http://localhost/api/direct/requests/req_1/status', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({}),
    }));
    const payload = await response.json();

    expect(response.status).toBe(400);
    expect(payload.ok).toBe(false);
    expect(payload.error).toBe('Invalid payload');
    expect(payload.issues).toHaveLength(1);
  });

  it('preserves DirectValidationError status codes at the HTTP layer', async () => {
    updateRequestStatusForKeeperMock.mockRejectedValue(new DirectValidationError('Request not found', 404));

    const response = await POST(new Request('http://localhost/api/direct/requests/req_missing/status', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ status: 'ACCEPTED' }),
    }));
    const payload = await response.json();

    expect(response.status).toBe(404);
    expect(payload).toMatchObject({ ok: false, error: 'Request not found' });
  });
});
