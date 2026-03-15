/**
 * Social adapter registry.
 *
 * Maps each supported platform to its adapter implementation.
 * Adapters that are not yet fully implemented will throw
 * PLATFORM_NOT_CONFIGURED when called.
 */

import type { SocialAdapter, ReachSocialPlatform } from './types';
import { YouTubeAdapter } from './youtube';
import { InstagramAdapter } from './instagram';
import { XAdapter } from './x';
import { TikTokAdapter } from './tiktok';
import { FacebookAdapter } from './facebook';

const ADAPTER_REGISTRY: Record<ReachSocialPlatform, SocialAdapter> = {
  YOUTUBE: new YouTubeAdapter(),
  INSTAGRAM: new InstagramAdapter(),
  X: new XAdapter(),
  TIKTOK: new TikTokAdapter(),
  FACEBOOK: new FacebookAdapter(),
};

/**
 * Look up the adapter for a given platform.
 * Returns undefined if the platform is not in the registry
 * (should not happen for known platforms).
 */
export function getAdapter(platform: ReachSocialPlatform): SocialAdapter | undefined {
  return ADAPTER_REGISTRY[platform];
}

/**
 * Get all registered adapters.
 */
export function getAllAdapters(): Record<ReachSocialPlatform, SocialAdapter> {
  return ADAPTER_REGISTRY;
}

// Re-export types for convenience
export type { SocialAdapter, ProviderVerificationInput, ProviderProfileResult, ReachSocialPlatform } from './types';
export { SOCIAL_PLATFORMS, PLATFORM_ENV_REQUIREMENTS } from './types';
