import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ZodError, z } from 'zod';

const { verifyTwoFactorLoginMock, createKeeperSessionTokenMock } = vi.hoisted(() => ({
  verifyTwoFactorLoginMock: vi.fn(),
  createKeeperSessionTokenMock: vi.fn(() => 'session-token'),
}));

vi.mock('../../../../../../features/direct/server/auth', () => ({
  AuthValidationError: class AuthValidationError extends Error {},
  verifyTwoFactorLogin: verifyTwoFactorLoginMock,
}));

vi.mock('../../../../../../lib/keeper-auth', () => ({
  createKeeperSessionToken: createKeeperSessionTokenMock,
  KEEPER_SESSION_COOKIE: 'knokio_keeper_session',
  keeperSessionCookieOptions: { httpOnly: true, path: '/' },
}));

vi.mock('../../../../../../lib/logger', () => ({
  logger: vi.fn(() => ({ error: vi.fn(), info: vi.fn(), warn: vi.fn() })),
}));

vi.mock('../../../../../../lib/error-tracking', () => ({
  captureException: vi.fn(),
}));

import { AuthValidationError } from '../../../../../../features/direct/server/auth';
import { POST } from './route';

describe('POST /api/direct/auth/2fa/verify', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    verifyTwoFactorLoginMock.mockResolvedValue({
      id: 'user_1',
      email: 'john@example.com',
      doorSlug: 'john',
      doorPlan: 'FREE',
    });
  });

  it('sets a keeper session cookie after successful 2FA verification', async () => {
    const payload = { challengeToken: 'challenge_12345', code: '123456' };
    const response = await POST(new Request('http://localhost/api/direct/auth/2fa/verify', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(payload),
    }));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toMatchObject({ ok: true, keeper: { email: 'john@example.com', doorSlug: 'john', doorPlan: 'FREE' } });
    expect(verifyTwoFactorLoginMock).toHaveBeenCalledWith(payload);
    expect(response.headers.get('set-cookie')).toContain('knokio_keeper_session=session-token');
  });

  it('returns 400 for invalid 2FA verification payloads', async () => {
    verifyTwoFactorLoginMock.mockRejectedValue(new ZodError([
      {
        code: z.ZodIssueCode.invalid_type,
        expected: 'string',
        received: 'undefined',
        path: ['challengeToken'],
        message: 'Required',
      },
    ]));

    const response = await POST(new Request('http://localhost/api/direct/auth/2fa/verify', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ code: '123456' }),
    }));
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.ok).toBe(false);
    expect(body.error).toBe('Invalid payload');
    expect(body.issues).toHaveLength(1);
  });

  it('returns 401 for invalid 2FA verification attempts', async () => {
    verifyTwoFactorLoginMock.mockRejectedValue(new AuthValidationError('Invalid challenge token'));

    const response = await POST(new Request('http://localhost/api/direct/auth/2fa/verify', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ challengeToken: 'challenge_12345', code: '123456' }),
    }));
    const body = await response.json();

    expect(response.status).toBe(401);
    expect(body).toMatchObject({ ok: false, error: 'Invalid challenge token' });
  });
});
