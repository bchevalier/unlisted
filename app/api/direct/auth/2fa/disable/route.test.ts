import { beforeEach, describe, expect, it, vi } from 'vitest';

const { getKeeperSessionFromRequestMock, disableTwoFactorMock } = vi.hoisted(() => ({
  getKeeperSessionFromRequestMock: vi.fn(),
  disableTwoFactorMock: vi.fn(),
}));

vi.mock('../../../../../../features/direct/server/auth', () => ({
  disableTwoFactor: disableTwoFactorMock,
}));

vi.mock('../../../../../../lib/keeper-auth', () => ({
  getKeeperSessionFromRequest: getKeeperSessionFromRequestMock,
}));

vi.mock('../../../../../../lib/logger', () => ({
  logger: vi.fn(() => ({ error: vi.fn(), info: vi.fn(), warn: vi.fn() })),
}));

vi.mock('../../../../../../lib/error-tracking', () => ({
  captureException: vi.fn(),
}));

import { POST } from './route';

describe('POST /api/direct/auth/2fa/disable', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getKeeperSessionFromRequestMock.mockReturnValue({ userId: 'user_1', email: 'john@example.com' });
    disableTwoFactorMock.mockResolvedValue(undefined);
  });

  it('returns 401 without a keeper session', async () => {
    getKeeperSessionFromRequestMock.mockReturnValue(null);

    const response = await POST(new Request('http://localhost/api/direct/auth/2fa/disable', { method: 'POST' }));
    const payload = await response.json();

    expect(response.status).toBe(401);
    expect(payload).toMatchObject({ ok: false, error: 'Unauthorized' });
    expect(disableTwoFactorMock).not.toHaveBeenCalled();
  });

  it('disables 2FA for the authenticated keeper', async () => {
    const response = await POST(new Request('http://localhost/api/direct/auth/2fa/disable', { method: 'POST' }));
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload).toMatchObject({ ok: true });
    expect(disableTwoFactorMock).toHaveBeenCalledWith('user_1');
  });
});
