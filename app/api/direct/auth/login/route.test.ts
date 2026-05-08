import { beforeEach, describe, expect, it, vi } from 'vitest';

const {
  loginKeeperMock,
  enforceAuthRateLimitMock,
  extractClientIPMock,
  recordAuthAttemptMock,
  createKeeperSessionTokenMock,
} = vi.hoisted(() => ({
  loginKeeperMock: vi.fn(),
  enforceAuthRateLimitMock: vi.fn(),
  extractClientIPMock: vi.fn(() => '127.0.0.1'),
  recordAuthAttemptMock: vi.fn(),
  createKeeperSessionTokenMock: vi.fn(() => 'session-token'),
}));

vi.mock('../../../../../features/direct/server/auth', () => ({
  AuthValidationError: class AuthValidationError extends Error {},
  loginKeeper: loginKeeperMock,
}));

vi.mock('../../../../../features/direct/server/auth-security', () => ({
  enforceAuthRateLimit: enforceAuthRateLimitMock,
  extractClientIP: extractClientIPMock,
  recordAuthAttempt: recordAuthAttemptMock,
}));

vi.mock('../../../../../lib/error-tracking', () => ({
  captureException: vi.fn(),
}));

vi.mock('../../../../../lib/keeper-auth', () => ({
  createKeeperSessionToken: createKeeperSessionTokenMock,
  KEEPER_SESSION_COOKIE: 'knokio_keeper_session',
  keeperSessionCookieOptions: { httpOnly: true, path: '/' },
}));

vi.mock('../../../../../lib/logger', () => ({
  logger: vi.fn(() => ({ error: vi.fn(), info: vi.fn(), warn: vi.fn() })),
}));

import { AuthValidationError } from '../../../../../features/direct/server/auth';
import { POST } from './route';

describe('POST /api/direct/auth/login', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    loginKeeperMock.mockResolvedValue({
      status: 'authenticated',
      keeper: {
        id: 'user_1',
        email: 'john@example.com',
        doorSlug: 'john',
        doorPlan: 'FREE',
      },
    });
  });

  it('sets a keeper session cookie on successful login', async () => {
    const response = await POST(
      new Request('http://localhost/api/direct/auth/login', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ email: 'John@Example.com', password: 'super-secret-password' }),
      })
    );
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload).toMatchObject({
      ok: true,
      requiresTwoFactor: false,
      keeper: { email: 'john@example.com', doorSlug: 'john', doorPlan: 'FREE' },
    });
    expect(loginKeeperMock).toHaveBeenCalledWith({ email: 'John@Example.com', password: 'super-secret-password' });
    expect(recordAuthAttemptMock).toHaveBeenCalledWith(expect.objectContaining({ email: 'john@example.com', success: true }));
    expect(response.headers.get('set-cookie')).toContain('knokio_keeper_session=session-token');
  });

  it('returns a two-factor challenge without setting a session cookie', async () => {
    loginKeeperMock.mockResolvedValue({
      status: 'requires_two_factor',
      challengeToken: 'challenge_123',
      email: 'john@example.com',
    });

    const response = await POST(
      new Request('http://localhost/api/direct/auth/login', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ email: 'john@example.com', password: 'super-secret-password' }),
      })
    );
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload).toMatchObject({ ok: true, requiresTwoFactor: true, challengeToken: 'challenge_123' });
    expect(response.headers.get('set-cookie')).toBeNull();
  });

  it('rejects honeypot login attempts before hitting auth', async () => {
    const response = await POST(
      new Request('http://localhost/api/direct/auth/login', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ email: 'john@example.com', password: 'x', website: 'https://spam.example' }),
      })
    );
    const payload = await response.json();

    expect(response.status).toBe(400);
    expect(payload).toMatchObject({ ok: false, error: 'Invalid login attempt' });
    expect(loginKeeperMock).not.toHaveBeenCalled();
    expect(recordAuthAttemptMock).toHaveBeenCalledWith(expect.objectContaining({ success: false }));
  });

  it('returns 403 when email verification is still required', async () => {
    loginKeeperMock.mockRejectedValue(new AuthValidationError('Email verification required'));

    const response = await POST(
      new Request('http://localhost/api/direct/auth/login', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ email: 'john@example.com', password: 'super-secret-password' }),
      })
    );
    const payload = await response.json();

    expect(response.status).toBe(403);
    expect(payload).toMatchObject({
      ok: false,
      error: 'Email verification required',
      emailVerificationRequired: true,
    });
  });
});
