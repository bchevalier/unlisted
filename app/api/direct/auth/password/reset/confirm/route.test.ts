import { beforeEach, describe, expect, it, vi } from 'vitest';

const { resetPasswordWithTokenMock } = vi.hoisted(() => ({
  resetPasswordWithTokenMock: vi.fn(),
}));

vi.mock('../../../../../../../features/direct/server/auth', () => ({
  AuthValidationError: class AuthValidationError extends Error {},
  resetPasswordWithToken: resetPasswordWithTokenMock,
}));

vi.mock('../../../../../../../lib/error-tracking', () => ({
  captureException: vi.fn(),
}));

vi.mock('../../../../../../../lib/logger', () => ({
  logger: vi.fn(() => ({ error: vi.fn(), info: vi.fn(), warn: vi.fn() })),
}));

import { AuthValidationError } from '../../../../../../../features/direct/server/auth';
import { POST } from './route';

describe('POST /api/direct/auth/password/reset/confirm', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetPasswordWithTokenMock.mockResolvedValue(undefined);
  });

  it('confirms a password reset with a valid payload', async () => {
    const payload = { token: 'reset_token_12345', newPassword: 'super-secret-password' };
    const response = await POST(new Request('http://localhost/api/direct/auth/password/reset/confirm', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(payload),
    }));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toEqual({ ok: true });
    expect(resetPasswordWithTokenMock).toHaveBeenCalledWith(payload);
  });

  it('returns 400 for auth validation failures', async () => {
    resetPasswordWithTokenMock.mockRejectedValue(new AuthValidationError('Invalid or expired reset token'));

    const response = await POST(new Request('http://localhost/api/direct/auth/password/reset/confirm', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ token: 'reset_token_12345', newPassword: 'super-secret-password' }),
    }));
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body).toMatchObject({ ok: false, error: 'Invalid or expired reset token' });
  });
});
