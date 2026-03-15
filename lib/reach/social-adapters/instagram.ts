/**
 * Instagram social verification adapter.
 *
 * Uses Meta Graph API (Instagram Business / Creator API).
 * Requires META_APP_ID and META_APP_SECRET env vars.
 *
 * IMPORTANT: Instagram's API requires a user access token obtained through
 * the OAuth flow. For V1, this adapter is scaffolded to accept a user access
 * token via INSTAGRAM_USER_ACCESS_TOKEN env var for testing. In production,
 * the token would come from a stored OAuth grant per actor.
 *
 * Endpoint: GET /me?fields=id,username,biography,followers_count
 *   (requires instagram_basic scope)
 *
 * Note: The Instagram Basic Display API is deprecated as of Dec 2024.
 * New integrations should use the Instagram API with Instagram Login.
 */

import type { SocialAdapter, ProviderVerificationInput, ProviderProfileResult } from './types';
import { ReachSocialVerificationError } from '../social-verifications';
import { logger } from '../../logger';

const log = logger('reach:social-adapters:instagram');

const GRAPH_API_BASE = 'https://graph.instagram.com/v21.0';

type InstagramProfileResponse = {
  id?: string;
  username?: string;
  biography?: string;
  followers_count?: number;
  error?: {
    message: string;
    type: string;
    code: number;
    fbtrace_id?: string;
  };
};

/**
 * Normalize an Instagram handle from various formats.
 * Supports: @handle, plain handle, full URL (https://instagram.com/handle).
 */
function normalizeInstagramHandle(raw: string): string {
  const trimmed = raw.trim();

  if (trimmed.includes('instagram.com/')) {
    try {
      const url = new URL(trimmed.startsWith('http') ? trimmed : `https://${trimmed}`);
      const segments = url.pathname.split('/').filter(Boolean);
      if (segments[0]) {
        return segments[0].replace(/^@/, '').toLowerCase();
      }
    } catch {
      // Fall through
    }
  }

  return trimmed.replace(/^@/, '').toLowerCase();
}

export class InstagramAdapter implements SocialAdapter {
  readonly platform = 'INSTAGRAM' as const;

  async fetchProfile(input: ProviderVerificationInput): Promise<ProviderProfileResult> {
    const appId = process.env.META_APP_ID;
    const appSecret = process.env.META_APP_SECRET;

    if (!appId || !appSecret) {
      throw new ReachSocialVerificationError(
        'Meta App credentials not configured for Instagram',
        'PLATFORM_NOT_CONFIGURED',
        412,
      );
    }

    // V1: For testing, use a static user access token from env.
    // Production: would look up stored OAuth token for the actor.
    const accessToken = process.env.INSTAGRAM_USER_ACCESS_TOKEN;
    if (!accessToken) {
      throw new ReachSocialVerificationError(
        'Instagram user access token not available. OAuth token exchange not yet implemented for V1.',
        'PLATFORM_NOT_CONFIGURED',
        412,
      );
    }

    const username = normalizeInstagramHandle(input.handle);
    if (!username) {
      throw new ReachSocialVerificationError(
        'Invalid Instagram handle',
        'INVALID_HANDLE',
        400,
      );
    }

    const url = `${GRAPH_API_BASE}/me?fields=id,username,biography,followers_count&access_token=${encodeURIComponent(accessToken)}`;

    let response: Response;
    try {
      response = await fetch(url, {
        headers: { Accept: 'application/json' },
        signal: AbortSignal.timeout(10_000),
      });
    } catch (err) {
      log.error('Instagram API network error', { error: err, handle: input.handle });
      throw new ReachSocialVerificationError(
        'Failed to reach Instagram API',
        'PROVIDER_NETWORK_ERROR',
        502,
      );
    }

    if (response.status === 429) {
      throw new ReachSocialVerificationError(
        'Instagram API rate limited. Try again later.',
        'PROVIDER_RATE_LIMITED',
        429,
      );
    }

    if (!response.ok) {
      const body = (await response.json().catch(() => ({}))) as InstagramProfileResponse;
      if (body.error) {
        // Token expired
        if (body.error.code === 190) {
          throw new ReachSocialVerificationError(
            'Instagram access token expired. Re-authentication required.',
            'PROVIDER_AUTH_ERROR',
            403,
          );
        }
        log.error('Instagram API error', { error: body.error, handle: input.handle });
      }
      throw new ReachSocialVerificationError(
        `Instagram API error (HTTP ${response.status})`,
        'PROVIDER_API_ERROR',
        502,
      );
    }

    const data = (await response.json()) as InstagramProfileResponse;

    if (!data.id) {
      throw new ReachSocialVerificationError(
        `Instagram profile not found for handle "${username}"`,
        'PROVIDER_PROFILE_NOT_FOUND',
        404,
      );
    }

    // Note: The /me endpoint returns the profile of the token owner.
    // We verify the returned username matches the claimed handle.
    const returnedUsername = (data.username ?? '').toLowerCase();
    if (returnedUsername !== username) {
      log.warn('Instagram handle mismatch', {
        claimed: username,
        returned: returnedUsername,
      });
      throw new ReachSocialVerificationError(
        `Instagram token belongs to "${returnedUsername}", not "${username}". The actor must authenticate with the correct Instagram account.`,
        'PROVIDER_HANDLE_MISMATCH',
        400,
      );
    }

    return {
      platformUserId: data.id,
      normalizedHandle: returnedUsername,
      profileUrl: `https://instagram.com/${returnedUsername}`,
      bioText: data.biography ?? '',
      followerCount: data.followers_count,
    };
  }
}
