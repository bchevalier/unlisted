/**
 * X (Twitter) social verification adapter.
 *
 * Uses X API v2 with app-only Bearer token auth.
 * Requires X_API_BEARER_TOKEN env var.
 *
 * Rate limits: 300 requests/15min for user lookup (app-only auth).
 * Endpoint: GET /2/users/by/username/:username?user.fields=description,public_metrics
 */

import type { SocialAdapter, ProviderVerificationInput, ProviderProfileResult } from './types';
import { ReachSocialVerificationError } from '../social-verifications';
import { logger } from '../../logger';

const log = logger('reach:social-adapters:x');

const X_API_BASE = 'https://api.x.com/2';

type XUser = {
  id: string;
  username: string;
  name: string;
  description?: string;
  public_metrics?: {
    followers_count: number;
    following_count: number;
    tweet_count: number;
    listed_count: number;
  };
};

type XUserResponse = {
  data?: XUser;
  errors?: Array<{
    title: string;
    detail: string;
    type: string;
  }>;
};

/**
 * Normalize an X handle from various input formats.
 * Supports: @handle, plain handle, full URL (https://x.com/handle or twitter.com/handle).
 */
function normalizeXHandle(raw: string): string {
  const trimmed = raw.trim();

  // URL format
  if (trimmed.includes('x.com/') || trimmed.includes('twitter.com/')) {
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

export class XAdapter implements SocialAdapter {
  readonly platform = 'X' as const;

  async fetchProfile(input: ProviderVerificationInput): Promise<ProviderProfileResult> {
    const bearerToken = process.env.X_API_BEARER_TOKEN;
    if (!bearerToken) {
      throw new ReachSocialVerificationError(
        'X API bearer token not configured',
        'PLATFORM_NOT_CONFIGURED',
        412,
      );
    }

    const username = normalizeXHandle(input.handle);
    if (!username) {
      throw new ReachSocialVerificationError(
        'Invalid X handle',
        'INVALID_HANDLE',
        400,
      );
    }

    const url = `${X_API_BASE}/users/by/username/${encodeURIComponent(username)}?user.fields=description,public_metrics`;

    let response: Response;
    try {
      response = await fetch(url, {
        headers: {
          Authorization: `Bearer ${bearerToken}`,
          Accept: 'application/json',
        },
        signal: AbortSignal.timeout(10_000),
      });
    } catch (err) {
      log.error('X API network error', { error: err, handle: input.handle });
      throw new ReachSocialVerificationError(
        'Failed to reach X API',
        'PROVIDER_NETWORK_ERROR',
        502,
      );
    }

    if (response.status === 401) {
      throw new ReachSocialVerificationError(
        'X API authentication failed. Check bearer token.',
        'PROVIDER_AUTH_ERROR',
        403,
      );
    }

    if (response.status === 429) {
      const retryAfter = response.headers.get('retry-after');
      log.warn('X API rate limited', { retryAfter });
      throw new ReachSocialVerificationError(
        `X API rate limited. ${retryAfter ? `Retry after ${retryAfter}s.` : 'Try again later.'}`,
        'PROVIDER_RATE_LIMITED',
        429,
      );
    }

    if (!response.ok) {
      log.error('X API error', { status: response.status, handle: input.handle });
      throw new ReachSocialVerificationError(
        `X API error (HTTP ${response.status})`,
        'PROVIDER_API_ERROR',
        502,
      );
    }

    const data = (await response.json()) as XUserResponse;

    if (data.errors && data.errors.length > 0) {
      const first = data.errors[0];
      log.warn('X API returned error', { error: first, handle: input.handle });
      throw new ReachSocialVerificationError(
        `X user not found: ${first.detail ?? first.title}`,
        'PROVIDER_PROFILE_NOT_FOUND',
        404,
      );
    }

    if (!data.data) {
      throw new ReachSocialVerificationError(
        `X user not found for handle "${username}"`,
        'PROVIDER_PROFILE_NOT_FOUND',
        404,
      );
    }

    const user = data.data;

    return {
      platformUserId: user.id,
      normalizedHandle: user.username.toLowerCase(),
      profileUrl: `https://x.com/${user.username}`,
      bioText: user.description ?? '',
      followerCount: user.public_metrics?.followers_count,
    };
  }
}
