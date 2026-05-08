import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../../../../features/direct/server/auth', () => ({
  AuthValidationError: class AuthValidationError extends Error {},
  authenticateKeeperWithExternalIdentity: vi.fn(),
}));

vi.mock('../../../../../features/direct/server/auth-security', () => ({
  enforceAuthRateLimit: vi.fn(),
  extractClientIP: vi.fn(() => '127.0.0.1'),
  recordAuthAttempt: vi.fn(),
}));

vi.mock('../../../../../lib/error-tracking', () => ({
  captureException: vi.fn(),
}));

vi.mock('../../../../../lib/keeper-auth', () => ({
  createKeeperSessionToken: vi.fn(() => 'session-token'),
  KEEPER_SESSION_COOKIE: 'knokio_direct_session',
  keeperSessionCookieOptions: { httpOnly: true, path: '/' },
}));

vi.mock('../../../../../lib/logger', () => ({
  logger: vi.fn(() => ({ error: vi.fn(), info: vi.fn(), warn: vi.fn() })),
}));

vi.mock('../../../../../lib/provider-auth', () => ({
  verifyProviderToken: vi.fn(),
}));

import { authenticateKeeperWithExternalIdentity } from '../../../../../features/direct/server/auth';
import { verifyProviderToken } from '../../../../../lib/provider-auth';
import { POST } from './route';

const authenticateKeeperWithExternalIdentityMock = vi.mocked(authenticateKeeperWithExternalIdentity);
const verifyProviderTokenMock = vi.mocked(verifyProviderToken);

describe('POST /api/direct/auth/provider', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    verifyProviderTokenMock.mockResolvedValue({
      provider: 'GOOGLE',
      providerSubject: 'subject_123',
      email: 'john@example.com',
      emailVerified: true,
      walletAddress: undefined,
      name: 'John',
    } as never);

    authenticateKeeperWithExternalIdentityMock.mockResolvedValue({
      id: 'user_1',
      email: 'john@example.com',
      doorSlug: 'john',
      doorPlan: 'FREE',
    } as never);
  });

  it('forces provider-based public provisioning onto the FREE plan even if PAID is posted', async () => {
    const request = new Request('http://localhost/api/direct/auth/provider', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        provider: 'GOOGLE',
        token: 'provider-token',
        name: 'John',
        desiredSlug: 'john',
        plan: 'PAID',
      }),
    });

    const response = await POST(request);
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.ok).toBe(true);
    expect(authenticateKeeperWithExternalIdentityMock).toHaveBeenCalledWith({
      provider: 'GOOGLE',
      providerSubject: 'subject_123',
      email: 'john@example.com',
      emailVerified: true,
      walletAddress: undefined,
      name: 'John',
      desiredSlug: 'john',
      preset: 'CREATOR',
      plan: 'FREE',
    });
  });

  it('forwards a chosen onboarding preset to provider provisioning', async () => {
    const request = new Request('http://localhost/api/direct/auth/provider', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        provider: 'GOOGLE',
        token: 'provider-token',
        name: 'John',
        desiredSlug: 'john',
        preset: 'ADVISOR',
      }),
    });

    const response = await POST(request);

    expect(response.status).toBe(200);
    expect(authenticateKeeperWithExternalIdentityMock).toHaveBeenCalledWith(
      expect.objectContaining({
        preset: 'ADVISOR',
        plan: 'FREE',
      })
    );
  });

  it('rejects disposable provider emails before provisioning a keeper', async () => {
    verifyProviderTokenMock.mockResolvedValue({
      provider: 'GOOGLE',
      providerSubject: 'subject_456',
      email: 'john@mailinator.com',
      emailVerified: true,
      walletAddress: undefined,
      name: 'John',
    } as never);

    const request = new Request('http://localhost/api/direct/auth/provider', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        provider: 'GOOGLE',
        token: 'provider-token',
        name: 'John',
        desiredSlug: 'john',
      }),
    });

    const response = await POST(request);
    const payload = await response.json();

    expect(response.status).toBe(400);
    expect(payload.ok).toBe(false);
    expect(payload.error).toMatch(/disposable email/i);
    expect(authenticateKeeperWithExternalIdentityMock).not.toHaveBeenCalled();
  });

  it('rejects provider signup attempts that trip the honeypot field', async () => {
    const request = new Request('http://localhost/api/direct/auth/provider', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        provider: 'GOOGLE',
        token: 'provider-token',
        name: 'John',
        desiredSlug: 'john',
        website: 'https://spam.example',
      }),
    });

    const response = await POST(request);
    const payload = await response.json();

    expect(response.status).toBe(400);
    expect(payload.ok).toBe(false);
    expect(payload.error).toMatch(/invalid login attempt/i);
    expect(authenticateKeeperWithExternalIdentityMock).not.toHaveBeenCalled();
    expect(verifyProviderTokenMock).not.toHaveBeenCalled();
  });
});
