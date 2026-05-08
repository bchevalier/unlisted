import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ZodError, z } from 'zod';

const { getKeeperSessionFromRequestMock, confirmTwoFactorSetupMock } = vi.hoisted(() => ({
  getKeeperSessionFromRequestMock: vi.fn(),
  confirmTwoFactorSetupMock: vi.fn(),
}));

vi.mock('../../../../../../../features/direct/server/auth', () => ({
  AuthValidationError: class AuthValidationError extends Error {},
  confirmTwoFactorSetup: confirmTwoFactorSetupMock,
}));

vi.mock('../../../../../../../lib/keeper-auth', () => ({
  getKeeperSessionFromRequest: getKeeperSessionFromRequestMock,
}));

vi.mock('../../../../../../../lib/logger', () => ({
  logger: vi.fn(() => ({ error: vi.fn(), info: vi.fn(), warn: vi.fn() })),
}));

vi.mock('../../../../../../../lib/error-tracking', () => ({
  captureException: vi.fn(),
}));

import { AuthValidationError } from '../../../../../../../features/direct/server/auth';
import { POST } from './route';

describe('POST /api/direct/auth/2fa/setup/confirm', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getKeeperSessionFromRequestMock.mockReturnValue({ userId: 'user_1', email: 'john@example.com' });
    confirmTwoFactorSetupMock.mockResolvedValue({ recoveryCodes: ['code-1', 'code-2'] });
  });

  it('returns 401 without a keeper session', async () => {
    getKeeperSessionFromRequestMock.mockReturnValue(null);

    const response = await POST(new Request('http://localhost/api/direct/auth/2fa/setup/confirm', { method: 'POST' }));
    const payload = await response.json();

    expect(response.status).toBe(401);
    expect(payload).toMatchObject({ ok: false, error: 'Unauthorized' });
    expect(confirmTwoFactorSetupMock).not.toHaveBeenCalled();
  });

  it('returns recovery codes when 2FA setup is confirmed', async () => {
    const response = await POST(new Request('http://localhost/api/direct/auth/2fa/setup/confirm', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ code: '123456' }),
    }));
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload).toMatchObject({ ok: true, recoveryCodes: ['code-1', 'code-2'] });
    expect(confirmTwoFactorSetupMock).toHaveBeenCalledWith('user_1', { code: '123456' });
  });

  it('returns 400 for invalid payloads from the server validator', async () => {
    confirmTwoFactorSetupMock.mockRejectedValue(new ZodError([
      {
        code: z.ZodIssueCode.invalid_type,
        expected: 'string',
        received: 'undefined',
        path: ['code'],
        message: 'Required',
      },
    ]));

    const response = await POST(new Request('http://localhost/api/direct/auth/2fa/setup/confirm', {
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

  it('surfaces auth validation failures as 400', async () => {
    confirmTwoFactorSetupMock.mockRejectedValue(new AuthValidationError('Invalid 2FA code'));

    const response = await POST(new Request('http://localhost/api/direct/auth/2fa/setup/confirm', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ code: '123456' }),
    }));
    const payload = await response.json();

    expect(response.status).toBe(400);
    expect(payload).toMatchObject({ ok: false, error: 'Invalid 2FA code' });
  });
});
