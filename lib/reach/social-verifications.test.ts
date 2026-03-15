import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockFns = vi.hoisted(() => ({
  reachActor: {
    findUnique: vi.fn(),
  },
  reachSocialVerification: {
    findUnique: vi.fn(),
    findMany: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  },
}));

vi.mock('../db', () => ({
  db: {
    ...mockFns,
  },
}));

// Mock logger to avoid side-effect noise
vi.mock('../logger', () => ({
  logger: () => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  }),
}));

// Mock the social adapters module so we can control adapter behavior in tests
const mockFetchProfile = vi.fn();
vi.mock('./social-adapters', async () => {
  const actual = await vi.importActual<typeof import('./social-adapters')>('./social-adapters');
  return {
    ...actual,
    getAdapter: vi.fn(() => ({
      platform: 'X',
      fetchProfile: mockFetchProfile,
    })),
  };
});

import {
  createSocialVerificationChallenge,
  deleteSocialVerification,
  listSocialVerifications,
  verifySocialVerification,
  assertBioOverrideSafe,
} from './social-verifications';

describe('reach social verifications', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.unstubAllEnvs();
  });

  it('creates a challenge for an active actor', async () => {
    mockFns.reachActor.findUnique.mockResolvedValue({ id: 'actor-1', isActive: true });
    mockFns.reachSocialVerification.findUnique.mockResolvedValue(null);
    mockFns.reachSocialVerification.create.mockResolvedValue({
      id: 'sv-1',
      actorId: 'actor-1',
      platform: 'YOUTUBE',
      status: 'PENDING',
      handle: 'creator',
      profileUrl: 'https://youtube.com/@creator',
      challengePhrase: 'knokio-AB12CD',
      challengeToken: 'token-1',
      createdAt: new Date('2026-03-14T00:00:00.000Z'),
    });

    const result = await createSocialVerificationChallenge('actor-1', {
      platform: 'YOUTUBE',
      handle: '@Creator',
      profileUrl: 'https://youtube.com/@creator',
    });

    expect(result.id).toBe('sv-1');
    expect(result.platform).toBe('YOUTUBE');
    expect(result.handle).toBe('creator');
    expect(result.challengePhrase).toBe('knokio-AB12CD');
    expect(result.instructions).toContain('knokio-AB12CD');
  });

  it('rejects duplicate platform handle for actor', async () => {
    mockFns.reachActor.findUnique.mockResolvedValue({ id: 'actor-1', isActive: true });
    mockFns.reachSocialVerification.findUnique.mockResolvedValue({ id: 'existing' });

    await expect(
      createSocialVerificationChallenge('actor-1', {
        platform: 'X',
        handle: 'creator',
      }),
    ).rejects.toMatchObject({
      code: 'HANDLE_ALREADY_LINKED',
      statusCode: 409,
    });
  });

  it('lists social verifications for actor', async () => {
    mockFns.reachSocialVerification.findMany.mockResolvedValue([
      { id: 'sv-1', platform: 'X', status: 'VERIFIED' },
      { id: 'sv-2', platform: 'YOUTUBE', status: 'PENDING' },
    ]);

    const rows = await listSocialVerifications('actor-1');
    expect(rows).toHaveLength(2);
    expect(mockFns.reachSocialVerification.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { actorId: 'actor-1' } }),
    );
  });

  it('verifies when bio override contains challenge phrase (dev mode)', async () => {
    vi.stubEnv('SOCIAL_VERIFICATION_ALLOW_BIO_OVERRIDE', 'true');

    mockFns.reachSocialVerification.findUnique
      .mockResolvedValueOnce({
        id: 'sv-1',
        actorId: 'actor-1',
        platform: 'INSTAGRAM',
        status: 'PENDING',
        handle: 'creator',
        profileUrl: 'https://instagram.com/creator',
        challengePhrase: 'knokio-AB12CD',
        verifiedAt: null,
      })
      .mockResolvedValueOnce({
        id: 'sv-1',
        platform: 'INSTAGRAM',
        status: 'VERIFIED',
      });

    mockFns.reachSocialVerification.update.mockResolvedValue({
      id: 'sv-1',
      platform: 'INSTAGRAM',
      status: 'VERIFIED',
      handle: 'creator',
      profileUrl: 'https://instagram.com/creator',
      followerCount: null,
      followerCountUpdatedAt: null,
      failureReason: null,
      verifiedAt: new Date(),
      lastCheckedAt: new Date(),
    });

    const result = await verifySocialVerification('actor-1', 'sv-1', {
      bioTextOverride: 'Hello world knokio-AB12CD in bio',
      force: false,
    });

    expect(result?.status).toBe('VERIFIED');
    expect(mockFns.reachSocialVerification.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: 'VERIFIED' }),
      }),
    );
  });

  it('marks verification failed when challenge phrase is missing in bio override', async () => {
    vi.stubEnv('SOCIAL_VERIFICATION_ALLOW_BIO_OVERRIDE', 'true');

    mockFns.reachSocialVerification.findUnique.mockResolvedValue({
      id: 'sv-1',
      actorId: 'actor-1',
      platform: 'TIKTOK',
      status: 'PENDING',
      handle: 'creator',
      profileUrl: null,
      challengePhrase: 'knokio-AB12CD',
      verifiedAt: null,
    });

    mockFns.reachSocialVerification.update.mockResolvedValue({
      id: 'sv-1',
      platform: 'TIKTOK',
      status: 'FAILED',
      handle: 'creator',
      profileUrl: null,
      followerCount: null,
      followerCountUpdatedAt: null,
      failureReason: 'Challenge phrase not found in profile bio',
      verifiedAt: null,
      lastCheckedAt: new Date(),
    });

    const result = await verifySocialVerification('actor-1', 'sv-1', {
      bioTextOverride: 'no challenge here',
      force: false,
    });

    expect(result?.status).toBe('FAILED');
  });

  it('verifies via real adapter when bio override is not used', async () => {
    // No bio override enabled — should go through adapter
    mockFns.reachSocialVerification.findUnique.mockResolvedValue({
      id: 'sv-1',
      actorId: 'actor-1',
      platform: 'X',
      status: 'PENDING',
      handle: 'creator',
      profileUrl: 'https://x.com/creator',
      challengePhrase: 'knokio-AB12CD',
      verifiedAt: null,
    });

    mockFetchProfile.mockResolvedValue({
      platformUserId: '12345',
      normalizedHandle: 'creator',
      profileUrl: 'https://x.com/creator',
      bioText: 'Hello knokio-AB12CD world',
      followerCount: 50000,
    });

    mockFns.reachSocialVerification.update.mockResolvedValue({
      id: 'sv-1',
      platform: 'X',
      status: 'VERIFIED',
      handle: 'creator',
      profileUrl: 'https://x.com/creator',
      followerCount: 50000,
      followerCountUpdatedAt: new Date(),
      failureReason: null,
      verifiedAt: new Date(),
      lastCheckedAt: new Date(),
    });

    const result = await verifySocialVerification('actor-1', 'sv-1', { force: false });
    expect(result?.status).toBe('VERIFIED');
    expect(mockFetchProfile).toHaveBeenCalledOnce();
    expect(mockFns.reachSocialVerification.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: 'VERIFIED',
          followerCount: 50000,
          platformUserId: '12345',
        }),
      }),
    );
  });

  it('returns FAILED when adapter bio does not contain challenge', async () => {
    mockFns.reachSocialVerification.findUnique.mockResolvedValue({
      id: 'sv-1',
      actorId: 'actor-1',
      platform: 'X',
      status: 'PENDING',
      handle: 'creator',
      profileUrl: 'https://x.com/creator',
      challengePhrase: 'knokio-AB12CD',
      verifiedAt: null,
    });

    mockFetchProfile.mockResolvedValue({
      platformUserId: '12345',
      normalizedHandle: 'creator',
      profileUrl: 'https://x.com/creator',
      bioText: 'Just a regular bio',
      followerCount: 1000,
    });

    mockFns.reachSocialVerification.update.mockResolvedValue({
      id: 'sv-1',
      platform: 'X',
      status: 'FAILED',
      handle: 'creator',
      profileUrl: 'https://x.com/creator',
      followerCount: 1000,
      followerCountUpdatedAt: null,
      failureReason: 'Challenge phrase not found in profile bio',
      verifiedAt: null,
      lastCheckedAt: new Date(),
    });

    const result = await verifySocialVerification('actor-1', 'sv-1', { force: false });
    expect(result?.status).toBe('FAILED');
  });

  it('propagates adapter errors (e.g., PLATFORM_NOT_CONFIGURED)', async () => {
    const { ReachSocialVerificationError } = await import('./social-verifications');

    mockFns.reachSocialVerification.findUnique.mockResolvedValue({
      id: 'sv-1',
      actorId: 'actor-1',
      platform: 'X',
      status: 'PENDING',
      handle: 'creator',
      profileUrl: 'https://x.com/creator',
      challengePhrase: 'knokio-AB12CD',
      verifiedAt: null,
    });

    mockFetchProfile.mockRejectedValue(
      new ReachSocialVerificationError(
        'X API bearer token not configured',
        'PLATFORM_NOT_CONFIGURED',
        412,
      ),
    );

    await expect(
      verifySocialVerification('actor-1', 'sv-1', { force: false }),
    ).rejects.toMatchObject({
      code: 'PLATFORM_NOT_CONFIGURED',
      statusCode: 412,
    });
  });

  it('deletes a social verification linked to actor', async () => {
    mockFns.reachSocialVerification.findUnique.mockResolvedValue({
      id: 'sv-1',
      actorId: 'actor-1',
    });
    mockFns.reachSocialVerification.delete.mockResolvedValue({ id: 'sv-1' });

    const result = await deleteSocialVerification('actor-1', 'sv-1');
    expect(result.ok).toBe(true);
    expect(mockFns.reachSocialVerification.delete).toHaveBeenCalledWith({ where: { id: 'sv-1' } });
  });
});

describe('assertBioOverrideSafe', () => {
  beforeEach(() => {
    vi.unstubAllEnvs();
  });

  it('throws in production when bio override is enabled', () => {
    vi.stubEnv('NODE_ENV', 'production');
    vi.stubEnv('SOCIAL_VERIFICATION_ALLOW_BIO_OVERRIDE', 'true');

    expect(() => assertBioOverrideSafe()).toThrow(
      'SOCIAL_VERIFICATION_ALLOW_BIO_OVERRIDE=true is not allowed in production',
    );
  });

  it('does not throw in production when bio override is disabled', () => {
    vi.stubEnv('NODE_ENV', 'production');
    vi.stubEnv('SOCIAL_VERIFICATION_ALLOW_BIO_OVERRIDE', 'false');

    expect(() => assertBioOverrideSafe()).not.toThrow();
  });

  it('does not throw in development when bio override is enabled', () => {
    vi.stubEnv('NODE_ENV', 'development');
    vi.stubEnv('SOCIAL_VERIFICATION_ALLOW_BIO_OVERRIDE', 'true');

    expect(() => assertBioOverrideSafe()).not.toThrow();
  });

  it('does not throw when bio override is not set at all', () => {
    vi.stubEnv('NODE_ENV', 'production');
    // Don't set SOCIAL_VERIFICATION_ALLOW_BIO_OVERRIDE

    expect(() => assertBioOverrideSafe()).not.toThrow();
  });
});
