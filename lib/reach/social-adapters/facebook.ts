/**
 * Facebook social verification adapter (P1 — scaffolded).
 *
 * Uses Meta Graph API for Facebook Pages.
 * Personal profiles have limited API access; Pages are the primary target.
 *
 * This adapter is scaffolded for V1 with explicit PLATFORM_NOT_CONFIGURED
 * behavior until app credentials and review are in place.
 *
 * When implemented, will use:
 * - Graph API: GET /{page-id}?fields=about,fan_count,name
 * - Requires: META_APP_ID, META_APP_SECRET + page access token
 */

import type { SocialAdapter, ProviderVerificationInput, ProviderProfileResult } from './types';
import { ReachSocialVerificationError } from '../social-verifications';

export class FacebookAdapter implements SocialAdapter {
  readonly platform = 'FACEBOOK' as const;

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  async fetchProfile(_input: ProviderVerificationInput): Promise<ProviderProfileResult> {
    throw new ReachSocialVerificationError(
      'Facebook adapter is not yet implemented. Requires Meta App review and Page token integration. See docs/Reach-Social-Provider-Setup.md.',
      'PLATFORM_NOT_CONFIGURED',
      412,
    );
  }
}
