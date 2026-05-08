import { beforeEach, describe, expect, it, vi } from 'vitest';

const { getKeeperSessionFromRequestMock, startTwoFactorSetupMock } = vi.hoisted(() => ({
  getKeeperSessionFromRequestMock: vi.fn(),
  startTwoFactorSetupMock: vi.fn(),
}));

vi.mock('../../../../../../../features/direct/server/auth', () => ({
  AuthValidationError: class AuthValidationError extends Error {},
  startTwoFactorSetup: startTwoFactorSetupMock,
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

describe('POST /api/direct/auth/2fa/setup/start', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getKeeperSessionFromRequestMock.mockReturnValue({ userId: 'user_1', email: 'john@example.com' });
    startTwoFactorSetupMock.mockResolvedValue({
      secret: 'SECRET123',
      otpauthUrl: 'otpauth://totp/Knokio:john@example.com?secret=SECRET123',
    });
  });

  it('returns 401 without a keeper session', async () => {
    getKeeperSessionFromRequestMock.mockReturnValue(null);

    const response = await POST(new Request('http://localhost/api/direct/auth/2fa/setup/start', { method: 'POST' }));
    const payload = await response.json();

    expect(response.status).toBe(401);
    expect(payload).toMatchObject({ ok: false, error: 'Unauthorized' });
    expect(startTwoFactorSetupMock).not.toHaveBeenCalled();
  });

  it('returns the setup secret and otpauth URL for the authenticated keeper', async () => {
    const response = await POST(new Request('http://localhost/api/direct/auth/2fa/setup/start', { method: 'POST' }));
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload).toMatchObject({
      ok: true,
      setup: {
        secret: 'SECRET123',
        otpauthUrl: 'otpauth://totp/Knokio:john@example.com?secret=SECRET123',
      },
    });
    expect(startTwoFactorSetupMock).toHaveBeenCalledWith('user_1');
  });

  it('surfaces 2FA setup validation failures as 400', async () => {
    startTwoFactorSetupMock.mockRejectedValue(new AuthValidationError('2FA already enabled'));

    const response = await POST(new Request('http://localhost/api/direct/auth/2fa/setup/start', { method: 'POST' }));
    const payload = await response.json();

    expect(response.status).toBe(400);
    expect(payload).toMatchObject({ ok: false, error: '2FA already enabled' });
  });
});
