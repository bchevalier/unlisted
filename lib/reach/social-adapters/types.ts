/**
 * Shared types for Reach social verification platform adapters.
 *
 * Each adapter implements `SocialAdapter` to fetch a profile from
 * a specific platform and return normalized data for challenge verification.
 */

export const SOCIAL_PLATFORMS = ['YOUTUBE', 'INSTAGRAM', 'TIKTOK', 'FACEBOOK', 'X'] as const;

export type ReachSocialPlatform = (typeof SOCIAL_PLATFORMS)[number];

/**
 * Input provided to an adapter when fetching a profile for verification.
 */
export type ProviderVerificationInput = {
  handle: string;
  profileUrl?: string | null;
  challengePhrase: string;
};

/**
 * Normalized result returned by a platform adapter after fetching a profile.
 */
export type ProviderProfileResult = {
  /** Platform-specific user ID (e.g., YouTube channel ID, X user ID). */
  platformUserId?: string;
  /** Handle after platform-specific normalization. */
  normalizedHandle?: string;
  /** Canonical profile URL on the platform. */
  profileUrl?: string;
  /** Raw bio/description text from the profile. */
  bioText: string;
  /** Follower/subscriber count if available. */
  followerCount?: number;
};

/**
 * Common interface for all social platform adapters.
 *
 * Implementors must handle:
 * - Platform API authentication (via env vars)
 * - Handle normalization for their platform
 * - Rate limit awareness (back off on 429/403)
 * - Structured error reporting
 */
export interface SocialAdapter {
  /** Platform this adapter handles. */
  readonly platform: ReachSocialPlatform;

  /**
   * Fetch a user profile from the platform.
   * Throws a structured error on failure (not found, rate limited, etc.).
   */
  fetchProfile(input: ProviderVerificationInput): Promise<ProviderProfileResult>;
}

/**
 * Env var requirements per platform. Used to gate adapter calls with
 * an explicit PLATFORM_NOT_CONFIGURED error when credentials are missing.
 */
export const PLATFORM_ENV_REQUIREMENTS: Record<ReachSocialPlatform, string[]> = {
  YOUTUBE: ['YOUTUBE_API_KEY'],
  INSTAGRAM: ['META_APP_ID', 'META_APP_SECRET'],
  TIKTOK: ['TIKTOK_CLIENT_KEY', 'TIKTOK_CLIENT_SECRET'],
  FACEBOOK: ['META_APP_ID', 'META_APP_SECRET'],
  X: ['X_API_BEARER_TOKEN'],
};
