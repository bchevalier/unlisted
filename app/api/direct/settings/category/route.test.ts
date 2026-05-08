import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ZodError, z } from 'zod';

const { getKeeperSessionFromRequestMock, updateCategoryForKeeperMock } = vi.hoisted(() => ({
  getKeeperSessionFromRequestMock: vi.fn(),
  updateCategoryForKeeperMock: vi.fn(),
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
  updateCategoryForKeeper: updateCategoryForKeeperMock,
}));

vi.mock('../../../../../lib/logger', () => ({
  logger: vi.fn(() => ({ error: vi.fn(), info: vi.fn(), warn: vi.fn() })),
}));

vi.mock('../../../../../lib/error-tracking', () => ({
  captureException: vi.fn(),
}));

import { DirectValidationError } from '../../../../../features/direct/server/requests';
import { POST } from './route';

describe('POST /api/direct/settings/category', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getKeeperSessionFromRequestMock.mockReturnValue({ userId: 'user_1', email: 'john@example.com' });
    updateCategoryForKeeperMock.mockResolvedValue(undefined);
  });

  it('returns 401 without a keeper session', async () => {
    getKeeperSessionFromRequestMock.mockReturnValue(null);

    const response = await POST(new Request('http://localhost/api/direct/settings/category', { method: 'POST' }));
    const payload = await response.json();

    expect(response.status).toBe(401);
    expect(payload).toMatchObject({ ok: false, error: 'Unauthorized' });
    expect(updateCategoryForKeeperMock).not.toHaveBeenCalled();
  });

  it('updates category settings for the authenticated keeper', async () => {
    const payload = { doorSlug: 'john', categoryKey: 'brand-deals', isEnabled: true };
    const response = await POST(new Request('http://localhost/api/direct/settings/category', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(payload),
    }));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toEqual({ ok: true });
    expect(updateCategoryForKeeperMock).toHaveBeenCalledWith('user_1', payload);
  });

  it('returns 400 for invalid payloads', async () => {
    updateCategoryForKeeperMock.mockRejectedValue(new ZodError([
      {
        code: z.ZodIssueCode.invalid_type,
        expected: 'string',
        received: 'undefined',
        path: ['doorSlug'],
        message: 'Required',
      },
    ]));

    const response = await POST(new Request('http://localhost/api/direct/settings/category', {
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
    updateCategoryForKeeperMock.mockRejectedValue(new DirectValidationError('Category not found', 404));

    const response = await POST(new Request('http://localhost/api/direct/settings/category', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ doorSlug: 'john', categoryKey: 'missing' }),
    }));
    const payload = await response.json();

    expect(response.status).toBe(404);
    expect(payload).toMatchObject({ ok: false, error: 'Category not found' });
  });
});
