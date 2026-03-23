import { beforeEach, describe, expect, it, vi } from 'vitest';

const {
  requestPasswordResetMock,
  shouldReturnAuthDebugTokensMock,
  enforceAuthRateLimitMock,
  extractClientIPMock,
  recordAuthAttemptMock,
  sendPasswordResetMailMock,
} = vi.hoisted(() => ({
  requestPasswordResetMock: vi.fn(),
  shouldReturnAuthDebugTokensMock: vi.fn(() => true),
  enforceAuthRateLimitMock: vi.fn(),
  extractClientIPMock: vi.fn(() => '127.0.0.1'),
  recordAuthAttemptMock: vi.fn(),
  sendPasswordResetMailMock: vi.fn(),
}));

vi.mock('../../../../../../../features/direct/server/auth', () => ({
  requestPasswordReset: requestPasswordResetMock,
  shouldReturnAuthDebugTokens: shouldReturnAuthDebugTokensMock,
}));

vi.mock('../../../../../../../features/direct/server/auth-security', () => ({
  enforceAuthRateLimit: enforceAuthRateLimitMock,
  extractClientIP: extractClientIPMock,
  recordAuthAttempt: recordAuthAttemptMock,
}));

vi.mock('../../../../../../../lib/auth-mailer', () => ({
  sendPasswordResetMail: sendPasswordResetMailMock,
}));

vi.mock('../../../../../../../lib/error-tracking', () => ({
  captureException: vi.fn(),
}));

vi.mock('../../../../../../../lib/logger', () => ({
  logger: vi.fn(() => ({ error: vi.fn(), info: vi.fn(), warn: vi.fn() })),
}));

import { POST } from './route';

describe('POST /api/direct/auth/password/reset/request', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    requestPasswordResetMock.mockResolvedValue('reset_token_12345');
  });

  it('requests a password reset and returns the debug token when enabled', async () => {
    const response = await POST(new Request('http://localhost/api/direct/auth/password/reset/request', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ email: 'john@example.com' }),
    }));
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload).toMatchObject({ ok: true, debug: { passwordResetToken: 'reset_token_12345' } });
    expect(sendPasswordResetMailMock).toHaveBeenCalledWith('john@example.com', 'reset_token_12345');
    expect(recordAuthAttemptMock).toHaveBeenCalledWith(expect.objectContaining({ email: 'john@example.com', success: true }));
  });

  it('returns 400 for invalid reset-request payloads', async () => {
    const response = await POST(new Request('http://localhost/api/direct/auth/password/reset/request', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ email: 'not-an-email' }),
    }));
    const payload = await response.json();

    expect(response.status).toBe(400);
    expect(payload.ok).toBe(false);
    expect(payload.error).toBe('Invalid payload');
  });

  it('returns ok even when no password-reset token is produced', async () => {
    requestPasswordResetMock.mockResolvedValue(null);

    const response = await POST(new Request('http://localhost/api/direct/auth/password/reset/request', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ email: 'john@example.com' }),
    }));
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload).toEqual({ ok: true });
    expect(sendPasswordResetMailMock).not.toHaveBeenCalled();
  });
});
