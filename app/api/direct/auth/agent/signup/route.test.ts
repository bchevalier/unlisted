import { beforeEach, describe, expect, it, vi } from 'vitest';

const {
  signupKeeperMock,
  shouldReturnAuthDebugTokensMock,
  enforceAuthRateLimitMock,
  extractClientIPMock,
  recordAuthAttemptMock,
  sendEmailVerificationMailMock,
} = vi.hoisted(() => ({
  signupKeeperMock: vi.fn(),
  shouldReturnAuthDebugTokensMock: vi.fn(() => true),
  enforceAuthRateLimitMock: vi.fn(),
  extractClientIPMock: vi.fn(() => '127.0.0.1'),
  recordAuthAttemptMock: vi.fn(),
  sendEmailVerificationMailMock: vi.fn(),
}));

vi.mock('../../../../../../features/direct/server/auth', () => ({
  AuthValidationError: class AuthValidationError extends Error {},
  shouldReturnAuthDebugTokens: shouldReturnAuthDebugTokensMock,
  signupKeeper: signupKeeperMock,
}));

vi.mock('../../../../../../features/direct/server/auth-security', () => ({
  enforceAuthRateLimit: enforceAuthRateLimitMock,
  extractClientIP: extractClientIPMock,
  recordAuthAttempt: recordAuthAttemptMock,
}));

vi.mock('../../../../../../lib/auth-mailer', () => ({
  sendEmailVerificationMail: sendEmailVerificationMailMock,
}));

vi.mock('../../../../../../lib/logger', () => ({
  logger: vi.fn(() => ({ error: vi.fn(), info: vi.fn(), warn: vi.fn() })),
}));

vi.mock('../../../../../../lib/error-tracking', () => ({
  captureException: vi.fn(),
}));

import { AuthValidationError } from '../../../../../../features/direct/server/auth';
import { POST } from './route';

const originalSecret = process.env.AGENT_SIGNUP_SECRET;

describe('POST /api/direct/auth/agent/signup', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.AGENT_SIGNUP_SECRET = '12345678901234567890123456789012';
    signupKeeperMock.mockResolvedValue({
      email: 'john@example.com',
      verificationToken: 'verify_12345',
      door: { slug: 'john', plan: 'PAID' },
    });
  });

  afterAll(() => {
    if (originalSecret === undefined) {
      delete process.env.AGENT_SIGNUP_SECRET;
    } else {
      process.env.AGENT_SIGNUP_SECRET = originalSecret;
    }
  });

  it('returns 401 when the agent signup secret is missing or wrong', async () => {
    const response = await POST(new Request('http://localhost/api/direct/auth/agent/signup', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-agent-signup-secret': 'wrong-secret' },
      body: JSON.stringify({ email: 'john@example.com', password: 'super-secret-password' }),
    }));
    const payload = await response.json();

    expect(response.status).toBe(401);
    expect(payload).toMatchObject({ ok: false, error: 'Unauthorized agent signup' });
    expect(signupKeeperMock).not.toHaveBeenCalled();
    expect(recordAuthAttemptMock).toHaveBeenCalledWith(expect.objectContaining({ success: false }));
  });

  it('creates an agent signup and returns the verification debug token when enabled', async () => {
    const response = await POST(new Request('http://localhost/api/direct/auth/agent/signup', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-agent-signup-secret': '12345678901234567890123456789012',
      },
      body: JSON.stringify({
        email: 'john@example.com',
        password: 'super-secret-password',
        desiredSlug: 'john',
        plan: 'PAID',
      }),
    }));
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload).toMatchObject({
      ok: true,
      mode: 'agent',
      emailVerificationRequired: true,
      keeper: { email: 'john@example.com', doorSlug: 'john', doorPlan: 'PAID' },
      debug: { emailVerificationToken: 'verify_12345' },
    });
    expect(signupKeeperMock).toHaveBeenCalledWith({
      email: 'john@example.com',
      password: 'super-secret-password',
      desiredSlug: 'john',
      plan: 'PAID',
    });
    expect(sendEmailVerificationMailMock).toHaveBeenCalledWith('john@example.com', 'verify_12345');
    expect(recordAuthAttemptMock).toHaveBeenCalledWith(expect.objectContaining({ email: 'john@example.com', success: true }));
  });

  it('returns 400 for invalid agent-signup payloads', async () => {
    const response = await POST(new Request('http://localhost/api/direct/auth/agent/signup', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-agent-signup-secret': '12345678901234567890123456789012',
      },
      body: JSON.stringify({ email: 'not-an-email', password: 'short' }),
    }));
    const payload = await response.json();

    expect(response.status).toBe(400);
    expect(payload.ok).toBe(false);
    expect(payload.error).toBe('Invalid payload');
  });

  it('surfaces auth validation errors as 400', async () => {
    signupKeeperMock.mockRejectedValue(new AuthValidationError('Slug is already taken'));

    const response = await POST(new Request('http://localhost/api/direct/auth/agent/signup', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-agent-signup-secret': '12345678901234567890123456789012',
      },
      body: JSON.stringify({ email: 'john@example.com', password: 'super-secret-password' }),
    }));
    const payload = await response.json();

    expect(response.status).toBe(400);
    expect(payload).toMatchObject({ ok: false, error: 'Slug is already taken' });
  });
});
