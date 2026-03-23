import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../../../../features/direct/server/auth', () => ({
  AuthValidationError: class AuthValidationError extends Error {},
  shouldReturnAuthDebugTokens: vi.fn(() => true),
  signupKeeper: vi.fn(),
}));

vi.mock('../../../../../features/direct/server/auth-security', () => ({
  enforceAuthRateLimit: vi.fn(),
  extractClientIP: vi.fn(() => '127.0.0.1'),
  recordAuthAttempt: vi.fn(),
}));

vi.mock('../../../../../lib/auth-mailer', () => ({
  sendEmailVerificationMail: vi.fn(),
}));

vi.mock('../../../../../lib/error-tracking', () => ({
  captureException: vi.fn(),
}));

vi.mock('../../../../../lib/logger', () => ({
  logger: vi.fn(() => ({ error: vi.fn(), info: vi.fn(), warn: vi.fn() })),
}));

import { signupKeeper } from '../../../../../features/direct/server/auth';
import { POST } from './route';

const signupKeeperMock = vi.mocked(signupKeeper);

describe('POST /api/direct/auth/signup', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    signupKeeperMock.mockResolvedValue({
      id: 'user_1',
      email: 'john@example.com',
      verificationToken: 'verify_123',
      door: { slug: 'john', plan: 'FREE' },
    } as never);
  });

  it('forces public signups onto the FREE plan even if PAID is posted', async () => {
    const request = new Request('http://localhost/api/direct/auth/signup', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        name: 'John',
        email: 'john@example.com',
        password: 'averysecurepassword',
        desiredSlug: 'john',
        plan: 'PAID',
      }),
    });

    const response = await POST(request);
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.ok).toBe(true);
    expect(signupKeeperMock).toHaveBeenCalledWith({
      name: 'John',
      email: 'john@example.com',
      password: 'averysecurepassword',
      desiredSlug: 'john',
      preset: 'CREATOR',
      plan: 'FREE',
    });
  });

  it('forwards a chosen onboarding preset to keeper signup', async () => {
    const request = new Request('http://localhost/api/direct/auth/signup', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        name: 'John',
        email: 'john@example.com',
        password: 'averysecurepassword',
        desiredSlug: 'john',
        preset: 'ADVISOR',
      }),
    });

    const response = await POST(request);

    expect(response.status).toBe(200);
    expect(signupKeeperMock).toHaveBeenCalledWith({
      name: 'John',
      email: 'john@example.com',
      password: 'averysecurepassword',
      desiredSlug: 'john',
      preset: 'ADVISOR',
      plan: 'FREE',
    });
  });

  it('rejects disposable email domains before creating a keeper', async () => {
    const request = new Request('http://localhost/api/direct/auth/signup', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        name: 'John',
        email: 'john@mailinator.com',
        password: 'averysecurepassword',
        desiredSlug: 'john',
      }),
    });

    const response = await POST(request);
    const payload = await response.json();

    expect(response.status).toBe(400);
    expect(payload.ok).toBe(false);
    expect(payload.error).toMatch(/disposable email/i);
    expect(signupKeeperMock).not.toHaveBeenCalled();
  });

  it('rejects signup attempts that trip the honeypot field', async () => {
    const request = new Request('http://localhost/api/direct/auth/signup', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        name: 'John',
        email: 'john@example.com',
        password: 'averysecurepassword',
        desiredSlug: 'john',
        website: 'https://spam.example',
      }),
    });

    const response = await POST(request);
    const payload = await response.json();

    expect(response.status).toBe(400);
    expect(payload.ok).toBe(false);
    expect(payload.error).toMatch(/invalid signup attempt/i);
    expect(signupKeeperMock).not.toHaveBeenCalled();
  });
});
