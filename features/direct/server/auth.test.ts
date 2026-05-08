import { beforeEach, describe, expect, it, vi } from 'vitest';

const { dbMock, consumeEmailVerificationTokenMock } = vi.hoisted(() => ({
  dbMock: {
    user: {
      update: vi.fn(),
    },
  },
  consumeEmailVerificationTokenMock: vi.fn(),
}));

vi.mock('../../../lib/db', () => ({ db: dbMock }));
vi.mock('./auth-security', async () => {
  const actual = await vi.importActual<typeof import('./auth-security')>('./auth-security');
  return {
    ...actual,
    consumeEmailVerificationToken: consumeEmailVerificationTokenMock,
  };
});

import { AuthValidationError, verifyEmailToken } from './auth';

describe('auth helpers', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    dbMock.user.update.mockResolvedValue({ id: 'user_1' });
    consumeEmailVerificationTokenMock.mockResolvedValue('user_1');
  });

  it('verifies email tokens by consuming the token and marking the user verified', async () => {
    const result = await verifyEmailToken('verify_token_12345');

    expect(result).toBe('user_1');
    expect(consumeEmailVerificationTokenMock).toHaveBeenCalledWith('verify_token_12345');
  });

  it('rejects email verification when the token has already been consumed', async () => {
    consumeEmailVerificationTokenMock.mockResolvedValueOnce(null);

    await expect(verifyEmailToken('verify_token_12345')).rejects.toThrow(AuthValidationError);
  });
});
