import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ZodError, z } from 'zod';

const { getKeeperSessionFromRequestMock, updateCategoryFieldForKeeperMock } = vi.hoisted(() => ({
  getKeeperSessionFromRequestMock: vi.fn(),
  updateCategoryFieldForKeeperMock: vi.fn(),
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
  updateCategoryFieldForKeeper: updateCategoryFieldForKeeperMock,
}));

vi.mock('../../../../../lib/logger', () => ({
  logger: vi.fn(() => ({ error: vi.fn(), info: vi.fn(), warn: vi.fn() })),
}));

vi.mock('../../../../../lib/error-tracking', () => ({
  captureException: vi.fn(),
}));

import { DirectValidationError } from '../../../../../features/direct/server/requests';
import { POST } from './route';

describe('POST /api/direct/settings/field', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getKeeperSessionFromRequestMock.mockReturnValue({ userId: 'user_1', email: 'john@example.com' });
    updateCategoryFieldForKeeperMock.mockResolvedValue(undefined);
  });

  it('returns 401 without a keeper session', async () => {
    getKeeperSessionFromRequestMock.mockReturnValue(null);

    const response = await POST(new Request('http://localhost/api/direct/settings/field', { method: 'POST' }));
    const payload = await response.json();

    expect(response.status).toBe(401);
    expect(payload).toMatchObject({ ok: false, error: 'Unauthorized' });
    expect(updateCategoryFieldForKeeperMock).not.toHaveBeenCalled();
  });

  it('updates category field requirements for the authenticated keeper', async () => {
    const payload = {
      doorSlug: 'john',
      categoryKey: 'brand-deals',
      fieldKey: 'budget',
      required: true,
    };
    const response = await POST(new Request('http://localhost/api/direct/settings/field', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(payload),
    }));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toEqual({ ok: true });
    expect(updateCategoryFieldForKeeperMock).toHaveBeenCalledWith('user_1', payload);
  });

  it('returns 400 for invalid payloads', async () => {
    updateCategoryFieldForKeeperMock.mockRejectedValue(new ZodError([
      {
        code: z.ZodIssueCode.invalid_type,
        expected: 'string',
        received: 'undefined',
        path: ['fieldKey'],
        message: 'Required',
      },
    ]));

    const response = await POST(new Request('http://localhost/api/direct/settings/field', {
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

  it('preserves DirectValidationError status codes at the HTTP layer', async () => {
    updateCategoryFieldForKeeperMock.mockRejectedValue(new DirectValidationError('Field not found', 404));

    const response = await POST(new Request('http://localhost/api/direct/settings/field', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ doorSlug: 'john', categoryKey: 'brand-deals', fieldKey: 'missing', required: true }),
    }));
    const payload = await response.json();

    expect(response.status).toBe(404);
    expect(payload).toMatchObject({ ok: false, error: 'Field not found' });
  });
});
