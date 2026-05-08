import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ZodError, z } from 'zod';

const { getKeeperSessionFromRequestMock, updateDoorPlanForKeeperMock } = vi.hoisted(() => ({
  getKeeperSessionFromRequestMock: vi.fn(),
  updateDoorPlanForKeeperMock: vi.fn(),
}));

vi.mock('../../../../../features/direct/server/requests', () => ({
  DirectValidationError: class DirectValidationError extends Error {
    statusCode: number;
    constructor(message: string, statusCode = 400) {
      super(message);
      this.statusCode = statusCode;
    }
  },
  updateDoorPlanForKeeper: updateDoorPlanForKeeperMock,
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

import { DirectValidationError } from '../../../../../features/direct/server/requests';
import { POST } from './route';

describe('POST /api/direct/settings/plan', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getKeeperSessionFromRequestMock.mockReturnValue({ userId: 'user_1' });
    updateDoorPlanForKeeperMock.mockResolvedValue({ plan: 'PAID' });
  });

  it('returns 401 without a keeper session', async () => {
    getKeeperSessionFromRequestMock.mockReturnValue(null);

    const response = await POST(new Request('http://localhost/api/direct/settings/plan', { method: 'POST' }));
    const payload = await response.json();

    expect(response.status).toBe(401);
    expect(payload).toMatchObject({ ok: false, error: 'Unauthorized' });
    expect(updateDoorPlanForKeeperMock).not.toHaveBeenCalled();
  });

  it('returns the updated plan when the keeper is entitled', async () => {
    const response = await POST(new Request('http://localhost/api/direct/settings/plan', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ doorSlug: 'john', plan: 'PAID' }),
    }));
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload).toMatchObject({ ok: true, plan: 'PAID' });
    expect(updateDoorPlanForKeeperMock).toHaveBeenCalledWith('user_1', { doorSlug: 'john', plan: 'PAID' });
  });

  it('preserves billing-authoritative plan gating errors at the HTTP layer', async () => {
    updateDoorPlanForKeeperMock.mockRejectedValue(new DirectValidationError('Active billing is required before switching to Paid', 403));

    const response = await POST(new Request('http://localhost/api/direct/settings/plan', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ doorSlug: 'john', plan: 'PAID' }),
    }));
    const payload = await response.json();

    expect(response.status).toBe(403);
    expect(payload).toMatchObject({ ok: false, error: 'Active billing is required before switching to Paid' });
  });

  it('returns 400 for invalid payloads surfaced from the server validator', async () => {
    updateDoorPlanForKeeperMock.mockRejectedValue(new ZodError([
      {
        code: z.ZodIssueCode.invalid_type,
        expected: 'string',
        received: 'undefined',
        path: ['doorSlug'],
        message: 'Required',
      },
    ]));

    const response = await POST(new Request('http://localhost/api/direct/settings/plan', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ plan: 'PAID' }),
    }));
    const payload = await response.json();

    expect(response.status).toBe(400);
    expect(payload.ok).toBe(false);
    expect(payload.error).toBe('Invalid payload');
    expect(payload.issues).toHaveLength(1);
  });
});
