import { beforeEach, describe, expect, it, vi } from 'vitest';

const { dbMock } = vi.hoisted(() => ({
  dbMock: {
    user: { findUnique: vi.fn() },
  },
}));

vi.mock('../../../lib/db', () => ({ db: dbMock }));

import { getKeeperSecurityProfile } from './security';

describe('security helpers', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    dbMock.user.findUnique.mockResolvedValue({
      email: 'john@example.com',
      emailVerifiedAt: '2026-03-24T00:00:00.000Z',
      twoFactorEnabled: true,
    });
  });

  it('returns the reduced keeper security profile projection', async () => {
    const result = await getKeeperSecurityProfile('user_1');

    expect(result).toEqual({
      email: 'john@example.com',
      emailVerifiedAt: '2026-03-24T00:00:00.000Z',
      twoFactorEnabled: true,
    });
    expect(dbMock.user.findUnique).toHaveBeenCalledWith({
      where: { id: 'user_1' },
      select: {
        email: true,
        emailVerifiedAt: true,
        twoFactorEnabled: true,
      },
    });
  });
});
