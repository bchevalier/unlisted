import { DoorPlan } from '@prisma/client';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { dbMock, hashMock, createEmailVerificationTokenMock } = vi.hoisted(() => {
  const dbMock = {
    user: {
      findUnique: vi.fn(),
      create: vi.fn(),
    },
    door: {
      count: vi.fn(),
      findUnique: vi.fn(),
      create: vi.fn(),
    },
  };

  return {
    dbMock,
    hashMock: vi.fn(),
    createEmailVerificationTokenMock: vi.fn(),
  };
});

vi.mock('../../../lib/db', () => ({
  db: dbMock,
}));

vi.mock('bcryptjs', () => ({
  default: {
    hash: hashMock,
    compare: vi.fn(),
  },
}));

vi.mock('./auth-security', () => ({
  consumeEmailVerificationToken: vi.fn(),
  consumePasswordResetToken: vi.fn(),
  consumeTwoFactorChallengeToken: vi.fn(),
  createEmailVerificationToken: createEmailVerificationTokenMock,
  createPasswordResetToken: vi.fn(),
  createTwoFactorChallengeToken: vi.fn(),
  decryptSecret: vi.fn(),
  encryptSecret: vi.fn(),
  generateRecoveryCodes: vi.fn(),
  generateTotpSetup: vi.fn(),
  hashRecoveryCode: vi.fn(),
  verifyTotpCode: vi.fn(),
}));

import { signupKeeper } from './auth';

describe('signupKeeper preset seeding', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    dbMock.user.findUnique.mockResolvedValue(null);
    dbMock.user.create.mockResolvedValue({
      id: 'user_1',
      email: 'advisor@example.com',
    });
    dbMock.door.count.mockResolvedValue(0);
    dbMock.door.findUnique.mockResolvedValue(null);
    dbMock.door.create.mockResolvedValue({
      slug: 'advisor',
      plan: DoorPlan.FREE,
    });
    hashMock.mockResolvedValue('hashed-password');
    createEmailVerificationTokenMock.mockResolvedValue('verify_123');
  });

  it('creates the first door with preset-specific headline and seeded categories', async () => {
    const result = await signupKeeper({
      name: 'Advisor Jane',
      email: 'advisor@example.com',
      password: 'averysecurepassword',
      desiredSlug: 'advisor',
      preset: 'ADVISOR',
      plan: DoorPlan.FREE,
    });

    expect(result).toEqual({
      id: 'user_1',
      email: 'advisor@example.com',
      emailVerified: false,
      verificationToken: 'verify_123',
      door: {
        slug: 'advisor',
        plan: DoorPlan.FREE,
      },
    });

    expect(dbMock.door.create).toHaveBeenCalledTimes(1);
    expect(dbMock.door.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          slug: 'advisor',
          displayName: "Advisor Jane's Door",
          headline: 'Advisory requests only. Send context before this reaches my inbox.',
          plan: DoorPlan.FREE,
          categories: expect.objectContaining({
            create: expect.arrayContaining([
              expect.objectContaining({
                key: 'advisory',
                label: 'Advisory Request',
              }),
              expect.objectContaining({
                key: 'speaking',
                label: 'Speaking / Guesting',
              }),
              expect.objectContaining({
                key: 'other',
                label: 'Other',
              }),
            ]),
          }),
        }),
      })
    );
  });
});
