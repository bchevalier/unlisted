import { beforeEach, describe, expect, it, vi } from 'vitest';

const {
  resendEmailVerificationMock,
  shouldReturnAuthDebugTokensMock,
  enforceAuthRateLimitMock,
  extractClientIPMock,
  recordAuthAttemptMock,
  sendEmailVerificationMailMock,
} = vi.hoisted(() => ({
  resendEmailVerificationMock: vi.fn(),
  shouldReturnAuthDebugTokensMock: vi.fn(() => true),
  enforceAuthRateLimitMock: vi.fn(),
  extractClientIPMock: vi.fn(() => '127.0.0.1'),
  recordAuthAttemptMock: vi.fn(),
  sendEmailVerificationMailMock: vi.fn(),
}));

vi.mock('../../../../../../../features/direct/server/auth', () => ({
  resendEmailVerification: resendEmailVerificationMock,
  shouldReturnAuthDebugTokens: shouldReturnAuthDebugTokensMock,
}));

vi.mock('../../../../../../../features/direct/server/auth-security', () => ({
  enforceAuthRateLimit: enforceAuthRateLimitMock,
  extractClientIP: extractClientIPMock,
  recordAuthAttempt: recordAuthAttemptMock,
}));

vi.mock('../../../../../../../lib/auth-mailer', () => ({
  sendEmailVerificationMail: sendEmailVerificationMailMock,
}));

vi.mock('../../../../../../../lib/error-tracking', () => ({
  captureException: vi.fn(),
}));

vi.mock('../../../../../../../lib/logger', () => ({
  logger: vi.fn(() => ({ error: vi.fn(), info: vi.fn(), warn: vi.fn() })),
}));

import { POST } from './route';

describe('POST /api/direct/auth/email/verify/resend', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resendEmailVerificationMock.mockResolvedValue('verify_token_12345');
  });

  it('resends verification mail and returns the debug token when enabled', async () => {
    const response = await POST(new Request('http://localhost/api/direct/auth/email/verify/resend', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ email: 'john@example.com' }),
    }));
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload).toMatchObject({ ok: true, debug: { emailVerificationToken: 'verify_token_12345' } });
    expect(sendEmailVerificationMailMock).toHaveBeenCalledWith('john@example.com', 'verify_token_12345');
    expect(recordAuthAttemptMock).toHaveBeenCalledWith(expect.objectContaining({ email: 'john@example.com', success: true }));
  });

  it('returns 400 for invalid resend payloads', async () => {
    const response = await POST(new Request('http://localhost/api/direct/auth/email/verify/resend', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ email: 'not-an-email' }),
    }));
    const payload = await response.json();

    expect(response.status).toBe(400);
    expect(payload.ok).toBe(false);
    expect(payload.error).toBe('Invalid payload');
  });

  it('returns ok even when no verification token is produced', async () => {
    resendEmailVerificationMock.mockResolvedValue(null);

    const response = await POST(new Request('http://localhost/api/direct/auth/email/verify/resend', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ email: 'john@example.com' }),
    }));
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload).toEqual({ ok: true });
    expect(sendEmailVerificationMailMock).not.toHaveBeenCalled();
  });
});
