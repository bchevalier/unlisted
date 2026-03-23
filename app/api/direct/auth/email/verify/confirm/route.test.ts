import { beforeEach, describe, expect, it, vi } from 'vitest';

const {
  verifyEmailTokenMock,
  enforceAuthRateLimitMock,
  extractClientIPMock,
  recordAuthAttemptMock,
} = vi.hoisted(() => ({
  verifyEmailTokenMock: vi.fn(),
  enforceAuthRateLimitMock: vi.fn(),
  extractClientIPMock: vi.fn(() => '127.0.0.1'),
  recordAuthAttemptMock: vi.fn(),
}));

vi.mock('../../../../../../../features/direct/server/auth', () => ({
  AuthValidationError: class AuthValidationError extends Error {},
  verifyEmailToken: verifyEmailTokenMock,
}));

vi.mock('../../../../../../../features/direct/server/auth-security', () => ({
  enforceAuthRateLimit: enforceAuthRateLimitMock,
  extractClientIP: extractClientIPMock,
  recordAuthAttempt: recordAuthAttemptMock,
}));

vi.mock('../../../../../../../lib/error-tracking', () => ({
  captureException: vi.fn(),
}));

vi.mock('../../../../../../../lib/logger', () => ({
  logger: vi.fn(() => ({ error: vi.fn(), info: vi.fn(), warn: vi.fn() })),
}));

import { AuthValidationError } from '../../../../../../../features/direct/server/auth';
import { POST } from './route';

describe('POST /api/direct/auth/email/verify/confirm', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    verifyEmailTokenMock.mockResolvedValue(undefined);
  });

  it('verifies a valid email token', async () => {
    const response = await POST(new Request('http://localhost/api/direct/auth/email/verify/confirm', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ token: 'verify_token_12345' }),
    }));
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload).toEqual({ ok: true });
    expect(verifyEmailTokenMock).toHaveBeenCalledWith('verify_token_12345');
    expect(recordAuthAttemptMock).toHaveBeenCalledWith(expect.objectContaining({ success: true }));
  });

  it('returns 400 for invalid payloads', async () => {
    const response = await POST(new Request('http://localhost/api/direct/auth/email/verify/confirm', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ token: 'short' }),
    }));
    const payload = await response.json();

    expect(response.status).toBe(400);
    expect(payload.ok).toBe(false);
    expect(payload.error).toBe('Invalid payload');
  });

  it('surfaces auth validation errors as 400', async () => {
    verifyEmailTokenMock.mockRejectedValue(new AuthValidationError('Invalid verification token'));

    const response = await POST(new Request('http://localhost/api/direct/auth/email/verify/confirm', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ token: 'verify_token_12345' }),
    }));
    const payload = await response.json();

    expect(response.status).toBe(400);
    expect(payload).toMatchObject({ ok: false, error: 'Invalid verification token' });
    expect(recordAuthAttemptMock).toHaveBeenCalledWith(expect.objectContaining({ success: false }));
  });
});
