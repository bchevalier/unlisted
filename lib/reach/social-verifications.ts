/**
 * Reach social verification (V1).
 *
 * Goal: verify creator ownership of social accounts by checking a Knokio challenge
 * phrase in profile bio/description and storing follower signals for targeting.
 *
 * V1 implementation notes:
 * - Uses provider-specific env placeholders (see .env.example)
 * - Includes a safe dev fallback (`SOCIAL_VERIFICATION_ALLOW_BIO_OVERRIDE=true`)
 *   so flow can be tested before platform adapters are fully wired.
 * - Production safety: bio override is blocked when NODE_ENV=production.
 */

import crypto from 'node:crypto';
import { z } from 'zod';
import { db } from '../db';
import { getAdapter, SOCIAL_PLATFORMS, PLATFORM_ENV_REQUIREMENTS } from './social-adapters';
import type { ReachSocialPlatform, ProviderProfileResult, ProviderVerificationInput } from './social-adapters';
import { logger } from '../logger';

const log = logger('reach:social-verifications');

export const ReachSocialVerificationCreateSchema = z.object({
  platform: z.enum(SOCIAL_PLATFORMS),
  handle: z.string().trim().min(2).max(200),
  profileUrl: z.string().trim().url().optional(),
});

export const ReachSocialVerificationVerifySchema = z.object({
  /**
   * Dev-only fallback to simulate profile bio text while API credentials/adapters
   * are pending. Ignored unless SOCIAL_VERIFICATION_ALLOW_BIO_OVERRIDE=true.
   */
  bioTextOverride: z.string().max(3000).optional(),
  force: z.boolean().optional().default(false),
});

export type ReachSocialVerificationCreateInput = z.infer<typeof ReachSocialVerificationCreateSchema>;
export type ReachSocialVerificationVerifyInput = z.infer<typeof ReachSocialVerificationVerifySchema>;

export class ReachSocialVerificationError extends Error {
  constructor(
    message: string,
    public code: string,
    public statusCode: number = 400,
  ) {
    super(message);
    this.name = 'ReachSocialVerificationError';
  }
}

function normalizeHandle(input: string): string {
  const trimmed = input.trim();
  if (!trimmed) return trimmed;

  // If URL-like handle is provided, extract trailing path segment.
  try {
    if (trimmed.includes('://')) {
      const parsed = new URL(trimmed);
      const segments = parsed.pathname.split('/').filter(Boolean);
      const candidate = segments[segments.length - 1] ?? '';
      return candidate.replace(/^@+/, '').trim().toLowerCase();
    }
  } catch {
    // Fall through to non-URL normalization.
  }

  return trimmed.replace(/^@+/, '').trim().toLowerCase();
}

function makeChallengePhrase(): string {
  // Short, easy to paste token for profile-bio proof.
  const suffix = crypto.randomBytes(4).toString('hex').toUpperCase();
  return `knokio-${suffix}`;
}

async function fetchProviderProfile(
  platform: ReachSocialPlatform,
  input: ProviderVerificationInput,
): Promise<ProviderProfileResult> {
  const adapter = getAdapter(platform);
  if (!adapter) {
    throw new ReachSocialVerificationError(
      `No adapter registered for platform ${platform}`,
      'PROVIDER_ADAPTER_NOT_IMPLEMENTED',
      501,
    );
  }

  log.info('Fetching provider profile', { platform, handle: input.handle });
  return adapter.fetchProfile(input);
}

function canUseBioOverride(): boolean {
  return process.env.SOCIAL_VERIFICATION_ALLOW_BIO_OVERRIDE === 'true';
}

/**
 * Production safety: assert that bio override is NOT enabled in production.
 * Call at module load time or at startup to fail-fast.
 */
export function assertBioOverrideSafe(): void {
  const isProduction = process.env.NODE_ENV === 'production';
  const overrideEnabled = process.env.SOCIAL_VERIFICATION_ALLOW_BIO_OVERRIDE === 'true';

  if (isProduction && overrideEnabled) {
    throw new Error(
      'FATAL: SOCIAL_VERIFICATION_ALLOW_BIO_OVERRIDE=true is not allowed in production. ' +
      'This setting bypasses real platform verification and must only be used in development.',
    );
  }

  if (!isProduction && overrideEnabled) {
    log.warn(
      'SOCIAL_VERIFICATION_ALLOW_BIO_OVERRIDE is enabled — bio text can be overridden in verification requests. ' +
      'This is a dev-only feature and MUST NOT be enabled in production.',
    );
  }
}

// Fail-fast on module load
assertBioOverrideSafe();

export async function createSocialVerificationChallenge(
  actorId: string,
  input: ReachSocialVerificationCreateInput,
) {
  const data = ReachSocialVerificationCreateSchema.parse(input);

  const actor = await db.reachActor.findUnique({
    where: { id: actorId },
    select: { id: true, isActive: true },
  });

  if (!actor || !actor.isActive) {
    throw new ReachSocialVerificationError('Actor not found or inactive', 'ACTOR_NOT_FOUND', 404);
  }

  const normalizedHandle = normalizeHandle(data.handle);
  if (!normalizedHandle) {
    throw new ReachSocialVerificationError('Handle is required', 'INVALID_HANDLE', 400);
  }

  const existing = await db.reachSocialVerification.findUnique({
    where: {
      actorId_platform_handle: {
        actorId,
        platform: data.platform,
        handle: normalizedHandle,
      },
    },
    select: { id: true },
  });

  if (existing) {
    throw new ReachSocialVerificationError(
      'This platform handle is already linked for this actor',
      'HANDLE_ALREADY_LINKED',
      409,
    );
  }

  const challengePhrase = makeChallengePhrase();
  const challengeToken = crypto.randomBytes(24).toString('hex');

  const record = await db.reachSocialVerification.create({
    data: {
      actorId,
      platform: data.platform,
      status: 'PENDING',
      handle: normalizedHandle,
      profileUrl: data.profileUrl ?? null,
      challengeToken,
      challengePhrase,
      metadata: {
        verificationMethod: 'PROFILE_BIO_MARKER',
        createdVia: 'reach-api',
      },
    },
  });

  return {
    id: record.id,
    platform: record.platform,
    handle: record.handle,
    profileUrl: record.profileUrl,
    status: record.status,
    challengePhrase: record.challengePhrase,
    instructions: `Add "${record.challengePhrase}" to your ${record.platform} profile bio, then run verification.`,
    createdAt: record.createdAt,
  };
}

export async function listSocialVerifications(actorId: string) {
  return db.reachSocialVerification.findMany({
    where: { actorId },
    orderBy: [{ verifiedAt: 'desc' }, { createdAt: 'desc' }],
    select: {
      id: true,
      platform: true,
      status: true,
      handle: true,
      platformUserId: true,
      profileUrl: true,
      followerCount: true,
      followerCountUpdatedAt: true,
      challengePhrase: true,
      failureReason: true,
      verifiedAt: true,
      lastCheckedAt: true,
      createdAt: true,
      updatedAt: true,
    },
  });
}

export async function verifySocialVerification(
  actorId: string,
  verificationId: string,
  input: ReachSocialVerificationVerifyInput,
) {
  const data = ReachSocialVerificationVerifySchema.parse(input);

  const record = await db.reachSocialVerification.findUnique({
    where: { id: verificationId },
    select: {
      id: true,
      actorId: true,
      platform: true,
      status: true,
      handle: true,
      profileUrl: true,
      challengePhrase: true,
      verifiedAt: true,
    },
  });

  if (!record || record.actorId !== actorId) {
    throw new ReachSocialVerificationError('Verification record not found', 'VERIFICATION_NOT_FOUND', 404);
  }

  if (record.status === 'VERIFIED' && !data.force) {
    return db.reachSocialVerification.findUnique({
      where: { id: record.id },
      select: {
        id: true,
        platform: true,
        status: true,
        handle: true,
        profileUrl: true,
        followerCount: true,
        followerCountUpdatedAt: true,
        bioSnapshot: true,
        failureReason: true,
        verifiedAt: true,
        lastCheckedAt: true,
      },
    });
  }

  let profile: ProviderProfileResult;
  if (data.bioTextOverride && canUseBioOverride()) {
    profile = {
      normalizedHandle: record.handle,
      profileUrl: record.profileUrl ?? undefined,
      bioText: data.bioTextOverride,
    };
  } else {
    profile = await fetchProviderProfile(record.platform as ReachSocialPlatform, {
      handle: record.handle,
      profileUrl: record.profileUrl,
      challengePhrase: record.challengePhrase,
    });
  }

  const bioText = profile.bioText ?? '';
  const containsChallenge = bioText.toLowerCase().includes(record.challengePhrase.toLowerCase());

  const now = new Date();

  const updated = await db.reachSocialVerification.update({
    where: { id: record.id },
    data: {
      status: containsChallenge ? 'VERIFIED' : 'FAILED',
      failureReason: containsChallenge ? null : 'Challenge phrase not found in profile bio',
      platformUserId: profile.platformUserId ?? null,
      handle: profile.normalizedHandle ? normalizeHandle(profile.normalizedHandle) : record.handle,
      profileUrl: profile.profileUrl ?? record.profileUrl,
      bioSnapshot: bioText.slice(0, 3000),
      followerCount: typeof profile.followerCount === 'number' ? profile.followerCount : null,
      followerCountUpdatedAt: typeof profile.followerCount === 'number' ? now : null,
      verifiedAt: containsChallenge ? now : null,
      lastCheckedAt: now,
      metadata: {
        verificationMethod: data.bioTextOverride && canUseBioOverride() ? 'BIO_OVERRIDE' : 'PLATFORM_ADAPTER',
      },
    },
    select: {
      id: true,
      platform: true,
      status: true,
      handle: true,
      profileUrl: true,
      followerCount: true,
      followerCountUpdatedAt: true,
      failureReason: true,
      verifiedAt: true,
      lastCheckedAt: true,
    },
  });

  return updated;
}

export async function deleteSocialVerification(actorId: string, verificationId: string) {
  const record = await db.reachSocialVerification.findUnique({
    where: { id: verificationId },
    select: { id: true, actorId: true },
  });

  if (!record || record.actorId !== actorId) {
    throw new ReachSocialVerificationError('Verification record not found', 'VERIFICATION_NOT_FOUND', 404);
  }

  await db.reachSocialVerification.delete({ where: { id: record.id } });
  return { ok: true as const };
}

export function getSocialPlatformEnvRequirements(platform: ReachSocialPlatform): string[] {
  return PLATFORM_ENV_REQUIREMENTS[platform];
}

export function getAllSocialPlatformEnvRequirements(): Record<ReachSocialPlatform, string[]> {
  return PLATFORM_ENV_REQUIREMENTS;
}
