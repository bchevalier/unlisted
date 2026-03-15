import { beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * Social verification integration tests (Reach).
 *
 * Full lifecycle coverage: create → verify (success/failure) → list → delete.
 * Also covers error paths, flag isolation, and bio-override safety.
 *
 * All DB and adapter calls are mocked — no live database or network required.
 * Direct modules are never imported; Reach isolation is preserved.
 */

// ---------------------------------------------------------------------------
// Mock setup — DB, logger, adapters
// ---------------------------------------------------------------------------

const mockDb = vi.hoisted(() => ({
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

vi.mock('../db', () => ({ db: { ...mockDb } }));

vi.mock('../logger', () => ({
  logger: () => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  }),
}));

const mockFetchProfile = vi.fn();
vi.mock('./social-adapters', async () => {
  const actual = await vi.importActual<typeof import('./social-adapters')>('./social-adapters');
  return {
    ...actual,
    getAdapter: vi.fn((platform: string) => ({
      platform,
      fetchProfile: mockFetchProfile,
    })),
  };
});

import {
  createSocialVerificationChallenge,
  verifySocialVerification,
  listSocialVerifications,
  deleteSocialVerification,
  assertBioOverrideSafe,
  ReachSocialVerificationError,
} from './social-verifications';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function activeActor(id = 'actor-1') {
  return { id, isActive: true };
}

function pendingRecord(overrides: Record<string, unknown> = {}) {
  return {
    id: 'sv-1',
    actorId: 'actor-1',
    platform: 'X',
    status: 'PENDING',
    handle: 'creator',
    profileUrl: 'https://x.com/creator',
    challengePhrase: 'knokio-A1B2C3D4',
    challengeToken: 'tok-abc',
    verifiedAt: null,
    ...overrides,
  };
}

function verifiedRecord(overrides: Record<string, unknown> = {}) {
  return {
    id: 'sv-1',
    platform: 'X',
    status: 'VERIFIED',
    handle: 'creator',
    profileUrl: 'https://x.com/creator',
    followerCount: 42000,
    followerCountUpdatedAt: new Date(),
    failureReason: null,
    verifiedAt: new Date(),
    lastCheckedAt: new Date(),
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// 1. Full lifecycle: create → verify (success) → list → delete
// ---------------------------------------------------------------------------

describe('social verification lifecycle (integration)', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.unstubAllEnvs();
  });

  it('runs a full happy-path lifecycle via adapter', async () => {
    // --- Step 1: Create challenge ---
    mockDb.reachActor.findUnique.mockResolvedValue(activeActor());
    mockDb.reachSocialVerification.findUnique.mockResolvedValueOnce(null); // no duplicate

    const created = pendingRecord();
    mockDb.reachSocialVerification.create.mockResolvedValue(created);

    const challenge = await createSocialVerificationChallenge('actor-1', {
      platform: 'X',
      handle: '@Creator',
      profileUrl: 'https://x.com/creator',
    });

    expect(challenge.id).toBe('sv-1');
    expect(challenge.status).toBe('PENDING');
    expect(challenge.challengePhrase).toMatch(/^knokio-/);
    expect(challenge.instructions).toContain(challenge.challengePhrase);

    // --- Step 2: Verify via adapter (bio contains phrase) ---
    mockDb.reachSocialVerification.findUnique.mockResolvedValueOnce(created);

    mockFetchProfile.mockResolvedValue({
      platformUserId: 'x-id-99',
      normalizedHandle: 'creator',
      profileUrl: 'https://x.com/creator',
      bioText: `Doing cool things ${created.challengePhrase} #knokio`,
      followerCount: 42000,
    });

    const verified = verifiedRecord();
    mockDb.reachSocialVerification.update.mockResolvedValue(verified);

    const verifyResult = await verifySocialVerification('actor-1', 'sv-1', { force: false });

    expect(verifyResult?.status).toBe('VERIFIED');
    expect(verifyResult?.followerCount).toBe(42000);
    expect(mockFetchProfile).toHaveBeenCalledOnce();
    expect(mockDb.reachSocialVerification.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: 'VERIFIED',
          platformUserId: 'x-id-99',
          followerCount: 42000,
        }),
      }),
    );

    // --- Step 3: List verifications ---
    mockDb.reachSocialVerification.findMany.mockResolvedValue([verified]);

    const list = await listSocialVerifications('actor-1');
    expect(list).toHaveLength(1);
    expect(list[0].status).toBe('VERIFIED');

    // --- Step 4: Delete ---
    mockDb.reachSocialVerification.findUnique.mockResolvedValueOnce({
      id: 'sv-1',
      actorId: 'actor-1',
    });
    mockDb.reachSocialVerification.delete.mockResolvedValue({ id: 'sv-1' });

    const deleteResult = await deleteSocialVerification('actor-1', 'sv-1');
    expect(deleteResult.ok).toBe(true);
  });

  it('runs a full lifecycle with bio override (dev mode)', async () => {
    vi.stubEnv('SOCIAL_VERIFICATION_ALLOW_BIO_OVERRIDE', 'true');

    // Create
    mockDb.reachActor.findUnique.mockResolvedValue(activeActor());
    mockDb.reachSocialVerification.findUnique.mockResolvedValueOnce(null);

    const created = pendingRecord({ platform: 'YOUTUBE', handle: 'yt-creator' });
    mockDb.reachSocialVerification.create.mockResolvedValue(created);

    const challenge = await createSocialVerificationChallenge('actor-1', {
      platform: 'YOUTUBE',
      handle: 'yt-creator',
    });

    expect(challenge.platform).toBe('YOUTUBE');

    // Verify via bio override
    mockDb.reachSocialVerification.findUnique.mockResolvedValueOnce(created);
    mockDb.reachSocialVerification.update.mockResolvedValue(
      verifiedRecord({ platform: 'YOUTUBE' }),
    );

    const result = await verifySocialVerification('actor-1', 'sv-1', {
      bioTextOverride: `My channel ${created.challengePhrase} link`,
      force: false,
    });

    expect(result?.status).toBe('VERIFIED');
    // Should NOT have called the real adapter
    expect(mockFetchProfile).not.toHaveBeenCalled();

    // Verify metadata records the override method
    expect(mockDb.reachSocialVerification.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          metadata: { verificationMethod: 'BIO_OVERRIDE' },
        }),
      }),
    );
  });
});

// ---------------------------------------------------------------------------
// 2. Verify failure paths
// ---------------------------------------------------------------------------

describe('social verification failure paths', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.unstubAllEnvs();
  });

  it('fails verification when bio does not contain challenge phrase (adapter)', async () => {
    mockDb.reachSocialVerification.findUnique.mockResolvedValueOnce(pendingRecord());

    mockFetchProfile.mockResolvedValue({
      platformUserId: 'x-id-99',
      normalizedHandle: 'creator',
      profileUrl: 'https://x.com/creator',
      bioText: 'Just a creator. No challenge here.',
      followerCount: 500,
    });

    const failedResult = {
      ...verifiedRecord(),
      status: 'FAILED',
      failureReason: 'Challenge phrase not found in profile bio',
      verifiedAt: null,
      followerCount: 500,
    };
    mockDb.reachSocialVerification.update.mockResolvedValue(failedResult);

    const result = await verifySocialVerification('actor-1', 'sv-1', { force: false });

    expect(result?.status).toBe('FAILED');
    expect(result?.failureReason).toContain('Challenge phrase not found');
    expect(mockDb.reachSocialVerification.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: 'FAILED' }),
      }),
    );
  });

  it('fails verification when bio override misses challenge phrase', async () => {
    vi.stubEnv('SOCIAL_VERIFICATION_ALLOW_BIO_OVERRIDE', 'true');
    mockDb.reachSocialVerification.findUnique.mockResolvedValueOnce(pendingRecord());

    const failedResult = {
      ...verifiedRecord(),
      status: 'FAILED',
      failureReason: 'Challenge phrase not found in profile bio',
      verifiedAt: null,
    };
    mockDb.reachSocialVerification.update.mockResolvedValue(failedResult);

    const result = await verifySocialVerification('actor-1', 'sv-1', {
      bioTextOverride: 'wrong text completely',
      force: false,
    });

    expect(result?.status).toBe('FAILED');
  });

  it('returns existing verified record without re-checking when force=false', async () => {
    const alreadyVerified = {
      ...pendingRecord(),
      status: 'VERIFIED',
      verifiedAt: new Date(),
    };
    mockDb.reachSocialVerification.findUnique
      .mockResolvedValueOnce(alreadyVerified)
      .mockResolvedValueOnce(verifiedRecord());

    const result = await verifySocialVerification('actor-1', 'sv-1', { force: false });

    expect(result?.status).toBe('VERIFIED');
    expect(mockFetchProfile).not.toHaveBeenCalled();
    expect(mockDb.reachSocialVerification.update).not.toHaveBeenCalled();
  });

  it('re-verifies when force=true even if already VERIFIED', async () => {
    const alreadyVerified = {
      ...pendingRecord(),
      status: 'VERIFIED',
      verifiedAt: new Date(),
    };
    mockDb.reachSocialVerification.findUnique.mockResolvedValueOnce(alreadyVerified);

    mockFetchProfile.mockResolvedValue({
      platformUserId: 'x-id-99',
      normalizedHandle: 'creator',
      profileUrl: 'https://x.com/creator',
      bioText: `Bio with ${alreadyVerified.challengePhrase}`,
      followerCount: 50000,
    });

    mockDb.reachSocialVerification.update.mockResolvedValue(
      verifiedRecord({ followerCount: 50000 }),
    );

    const result = await verifySocialVerification('actor-1', 'sv-1', { force: true });

    expect(result?.status).toBe('VERIFIED');
    expect(mockFetchProfile).toHaveBeenCalledOnce();
    expect(mockDb.reachSocialVerification.update).toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// 3. Error / guard paths
// ---------------------------------------------------------------------------

describe('social verification error paths', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.unstubAllEnvs();
  });

  it('rejects create for inactive actor', async () => {
    mockDb.reachActor.findUnique.mockResolvedValue({ id: 'actor-1', isActive: false });

    await expect(
      createSocialVerificationChallenge('actor-1', { platform: 'X', handle: 'test' }),
    ).rejects.toMatchObject({ code: 'ACTOR_NOT_FOUND', statusCode: 404 });
  });

  it('rejects create for non-existent actor', async () => {
    mockDb.reachActor.findUnique.mockResolvedValue(null);

    await expect(
      createSocialVerificationChallenge('ghost', { platform: 'X', handle: 'test' }),
    ).rejects.toMatchObject({ code: 'ACTOR_NOT_FOUND', statusCode: 404 });
  });

  it('rejects create with empty/whitespace handle (Zod min length)', async () => {
    mockDb.reachActor.findUnique.mockResolvedValue(activeActor());
    mockDb.reachSocialVerification.findUnique.mockResolvedValue(null);

    // Trimmed whitespace produces "", which fails Zod's .min(2) before
    // reaching the INVALID_HANDLE guard.
    await expect(
      createSocialVerificationChallenge('actor-1', { platform: 'X', handle: '   ' }),
    ).rejects.toThrow(); // ZodError
  });

  it('rejects duplicate platform + handle combo (409)', async () => {
    mockDb.reachActor.findUnique.mockResolvedValue(activeActor());
    mockDb.reachSocialVerification.findUnique.mockResolvedValue({ id: 'existing' });

    await expect(
      createSocialVerificationChallenge('actor-1', { platform: 'INSTAGRAM', handle: 'creator' }),
    ).rejects.toMatchObject({ code: 'HANDLE_ALREADY_LINKED', statusCode: 409 });
  });

  it('rejects verify for verification belonging to another actor', async () => {
    mockDb.reachSocialVerification.findUnique.mockResolvedValue(
      pendingRecord({ actorId: 'actor-other' }),
    );

    await expect(
      verifySocialVerification('actor-1', 'sv-1', { force: false }),
    ).rejects.toMatchObject({ code: 'VERIFICATION_NOT_FOUND', statusCode: 404 });
  });

  it('rejects verify for non-existent verification', async () => {
    mockDb.reachSocialVerification.findUnique.mockResolvedValue(null);

    await expect(
      verifySocialVerification('actor-1', 'does-not-exist', { force: false }),
    ).rejects.toMatchObject({ code: 'VERIFICATION_NOT_FOUND', statusCode: 404 });
  });

  it('rejects delete for verification belonging to another actor', async () => {
    mockDb.reachSocialVerification.findUnique.mockResolvedValue({
      id: 'sv-1',
      actorId: 'actor-other',
    });

    await expect(
      deleteSocialVerification('actor-1', 'sv-1'),
    ).rejects.toMatchObject({ code: 'VERIFICATION_NOT_FOUND', statusCode: 404 });
  });

  it('rejects delete for non-existent verification', async () => {
    mockDb.reachSocialVerification.findUnique.mockResolvedValue(null);

    await expect(
      deleteSocialVerification('actor-1', 'sv-999'),
    ).rejects.toMatchObject({ code: 'VERIFICATION_NOT_FOUND', statusCode: 404 });
  });

  it('propagates adapter errors transparently', async () => {
    mockDb.reachSocialVerification.findUnique.mockResolvedValue(pendingRecord());

    mockFetchProfile.mockRejectedValue(
      new ReachSocialVerificationError(
        'X API bearer token not configured',
        'PLATFORM_NOT_CONFIGURED',
        412,
      ),
    );

    await expect(
      verifySocialVerification('actor-1', 'sv-1', { force: false }),
    ).rejects.toMatchObject({ code: 'PLATFORM_NOT_CONFIGURED', statusCode: 412 });
  });

  it('propagates adapter network errors', async () => {
    mockDb.reachSocialVerification.findUnique.mockResolvedValue(pendingRecord());

    mockFetchProfile.mockRejectedValue(new Error('ECONNREFUSED'));

    await expect(
      verifySocialVerification('actor-1', 'sv-1', { force: false }),
    ).rejects.toThrow('ECONNREFUSED');
  });
});

// ---------------------------------------------------------------------------
// 4. Bio override safety (flag isolation)
// ---------------------------------------------------------------------------

describe('bio override flag safety', () => {
  beforeEach(() => {
    vi.unstubAllEnvs();
  });

  it('throws at module level when override enabled in production', () => {
    vi.stubEnv('NODE_ENV', 'production');
    vi.stubEnv('SOCIAL_VERIFICATION_ALLOW_BIO_OVERRIDE', 'true');

    expect(() => assertBioOverrideSafe()).toThrow(
      'SOCIAL_VERIFICATION_ALLOW_BIO_OVERRIDE=true is not allowed in production',
    );
  });

  it('is safe in production with override disabled', () => {
    vi.stubEnv('NODE_ENV', 'production');
    vi.stubEnv('SOCIAL_VERIFICATION_ALLOW_BIO_OVERRIDE', 'false');
    expect(() => assertBioOverrideSafe()).not.toThrow();
  });

  it('is safe in production with override unset', () => {
    vi.stubEnv('NODE_ENV', 'production');
    expect(() => assertBioOverrideSafe()).not.toThrow();
  });

  it('allows override in non-production', () => {
    vi.stubEnv('NODE_ENV', 'development');
    vi.stubEnv('SOCIAL_VERIFICATION_ALLOW_BIO_OVERRIDE', 'true');
    expect(() => assertBioOverrideSafe()).not.toThrow();
  });

  it('ignores bio override text when flag is off (routes through adapter)', async () => {
    vi.resetAllMocks(); // ensure clean mock state for this assertion
    // SOCIAL_VERIFICATION_ALLOW_BIO_OVERRIDE is NOT set / defaults to false
    mockDb.reachSocialVerification.findUnique.mockResolvedValueOnce(pendingRecord());

    mockFetchProfile.mockResolvedValue({
      normalizedHandle: 'creator',
      bioText: 'No challenge here',
    });

    mockDb.reachSocialVerification.update.mockResolvedValue({
      ...verifiedRecord(),
      status: 'FAILED',
      failureReason: 'Challenge phrase not found in profile bio',
      verifiedAt: null,
    });

    // Even though bioTextOverride contains the phrase, it should be ignored
    // because the override flag is off — the adapter result (no phrase) wins.
    const result = await verifySocialVerification('actor-1', 'sv-1', {
      bioTextOverride: `I have the ${pendingRecord().challengePhrase} right here`,
      force: false,
    });

    expect(result?.status).toBe('FAILED');
    expect(mockFetchProfile).toHaveBeenCalledOnce();
  });
});

// ---------------------------------------------------------------------------
// 5. Handle normalization edge cases
// ---------------------------------------------------------------------------

describe('handle normalization via create', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.unstubAllEnvs();
  });

  it('strips leading @ and lowercases', async () => {
    mockDb.reachActor.findUnique.mockResolvedValue(activeActor());
    mockDb.reachSocialVerification.findUnique.mockResolvedValue(null);
    mockDb.reachSocialVerification.create.mockImplementation(({ data }: { data: Record<string, unknown> }) =>
      Promise.resolve({ ...data, id: 'sv-new', createdAt: new Date() }),
    );

    const result = await createSocialVerificationChallenge('actor-1', {
      platform: 'INSTAGRAM',
      handle: '@@BigCreator',
    });

    // handle should be normalized in the create call
    expect(mockDb.reachSocialVerification.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ handle: 'bigcreator' }),
      }),
    );
    expect(result.handle).toBe('bigcreator');
  });

  it('extracts handle from full URL', async () => {
    mockDb.reachActor.findUnique.mockResolvedValue(activeActor());
    mockDb.reachSocialVerification.findUnique.mockResolvedValue(null);
    mockDb.reachSocialVerification.create.mockImplementation(({ data }: { data: Record<string, unknown> }) =>
      Promise.resolve({ ...data, id: 'sv-new', createdAt: new Date() }),
    );

    await createSocialVerificationChallenge('actor-1', {
      platform: 'YOUTUBE',
      handle: 'https://youtube.com/@SomeCreator',
    });

    expect(mockDb.reachSocialVerification.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ handle: 'somecreator' }),
      }),
    );
  });
});

// ---------------------------------------------------------------------------
// 6. Zod input validation
// ---------------------------------------------------------------------------

describe('input validation schemas', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.unstubAllEnvs();
  });

  it('rejects invalid platform enum on create', async () => {
    mockDb.reachActor.findUnique.mockResolvedValue(activeActor());

    await expect(
      createSocialVerificationChallenge('actor-1', {
        platform: 'SNAPCHAT' as never,
        handle: 'user',
      }),
    ).rejects.toThrow(); // ZodError
  });

  it('rejects handle shorter than 2 chars on create', async () => {
    mockDb.reachActor.findUnique.mockResolvedValue(activeActor());

    await expect(
      createSocialVerificationChallenge('actor-1', {
        platform: 'X',
        handle: 'a',
      }),
    ).rejects.toThrow(); // ZodError
  });

  it('rejects malformed profileUrl on create', async () => {
    mockDb.reachActor.findUnique.mockResolvedValue(activeActor());

    await expect(
      createSocialVerificationChallenge('actor-1', {
        platform: 'X',
        handle: 'user',
        profileUrl: 'not-a-url',
      }),
    ).rejects.toThrow(); // ZodError
  });
});

// ---------------------------------------------------------------------------
// 7. Multi-platform coverage
// ---------------------------------------------------------------------------

describe('multi-platform support', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.unstubAllEnvs();
  });

  const platforms = ['YOUTUBE', 'INSTAGRAM', 'TIKTOK', 'FACEBOOK', 'X'] as const;

  for (const platform of platforms) {
    it(`creates challenge for ${platform}`, async () => {
      mockDb.reachActor.findUnique.mockResolvedValue(activeActor());
      mockDb.reachSocialVerification.findUnique.mockResolvedValue(null);
      mockDb.reachSocialVerification.create.mockImplementation(({ data }: { data: Record<string, unknown> }) =>
        Promise.resolve({ ...data, id: `sv-${platform}`, createdAt: new Date() }),
      );

      const result = await createSocialVerificationChallenge('actor-1', {
        platform,
        handle: `${platform.toLowerCase()}-user`,
      });

      expect(result.platform).toBe(platform);
      expect(result.id).toBe(`sv-${platform}`);
    });
  }
});

// ---------------------------------------------------------------------------
// 8. Env requirements helper
// ---------------------------------------------------------------------------

describe('platform env requirements', () => {
  it('exports env requirements for all platforms', async () => {
    const { getSocialPlatformEnvRequirements, getAllSocialPlatformEnvRequirements } =
      await import('./social-verifications');

    const all = getAllSocialPlatformEnvRequirements();
    expect(Object.keys(all)).toHaveLength(5);

    // Each platform should have at least one required env var
    for (const [platform, vars] of Object.entries(all)) {
      expect(vars.length).toBeGreaterThanOrEqual(1);
      expect(getSocialPlatformEnvRequirements(platform as 'X')).toEqual(vars);
    }
  });
});
