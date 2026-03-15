/**
 * TikTok social verification adapter (P1 — scaffolded).
 *
 * TikTok's API requires app review and Login Kit for user info access.
 * This adapter is scaffolded for V1 with explicit PLATFORM_NOT_CONFIGURED
 * behavior until credentials and app approval are in place.
 *
 * When implemented, will use:
 * - TikTok Login Kit for OAuth
 * - User Info endpoint for bio + follower count
 * - Requires: TIKTOK_CLIENT_KEY, TIKTOK_CLIENT_SECRET
 */

import type { SocialAdapter, ProviderVerificationInput, ProviderProfileResult } from './types';
import { ReachSocialVerificationError } from '../social-verifications';

export class TikTokAdapter implements SocialAdapter {
  readonly platform = 'TIKTOK' as const;

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  async fetchProfile(_input: ProviderVerificationInput): Promise<ProviderProfileResult> {
    throw new ReachSocialVerificationError(
      'TikTok adapter is not yet implemented. Requires TikTok Login Kit app review and OAuth integration. See docs/Reach-Social-Provider-Setup.md.',
      'PLATFORM_NOT_CONFIGURED',
      412,
    );
  }
}
