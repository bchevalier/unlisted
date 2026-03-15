/**
 * YouTube social verification adapter.
 *
 * Uses YouTube Data API v3 to fetch channel profile data.
 * Requires YOUTUBE_API_KEY env var (server-side API key).
 *
 * Handle formats supported:
 * - @handle (e.g., @mkbhd)
 * - /channel/UCxxxxx (channel ID)
 * - /c/CustomName (legacy custom URL)
 * - Full URL (https://youtube.com/@handle)
 * - Plain handle (mkbhd)
 *
 * API quota: 10,000 units/day default. channels.list costs 1 unit per call.
 */

import type { SocialAdapter, ProviderVerificationInput, ProviderProfileResult } from './types';
import { ReachSocialVerificationError } from '../social-verifications';
import { logger } from '../../logger';

const log = logger('reach:social-adapters:youtube');

const YOUTUBE_API_BASE = 'https://www.googleapis.com/youtube/v3';

type YouTubeChannelSnippet = {
  title?: string;
  description?: string;
  customUrl?: string;
};

type YouTubeChannelStatistics = {
  subscriberCount?: string;
  hiddenSubscriberCount?: boolean;
};

type YouTubeChannelItem = {
  id: string;
  snippet?: YouTubeChannelSnippet;
  statistics?: YouTubeChannelStatistics;
};

type YouTubeChannelListResponse = {
  items?: YouTubeChannelItem[];
  error?: {
    code: number;
    message: string;
    errors?: Array<{ reason: string }>;
  };
};

/**
 * Extract a YouTube channel ID from a handle/URL.
 * Returns { type: 'id' | 'handle', value: string }.
 */
function parseYouTubeHandle(raw: string): { type: 'id' | 'handle'; value: string } {
  const trimmed = raw.trim();

  // Full URL: extract path segments
  if (trimmed.includes('youtube.com') || trimmed.includes('youtu.be')) {
    try {
      const url = new URL(trimmed.startsWith('http') ? trimmed : `https://${trimmed}`);
      const segments = url.pathname.split('/').filter(Boolean);

      if (segments[0] === 'channel' && segments[1]) {
        return { type: 'id', value: segments[1] };
      }
      if (segments[0] === 'c' && segments[1]) {
        return { type: 'handle', value: segments[1].replace(/^@/, '') };
      }
      if (segments[0]?.startsWith('@')) {
        return { type: 'handle', value: segments[0].replace(/^@/, '') };
      }
      if (segments[0]) {
        return { type: 'handle', value: segments[0].replace(/^@/, '') };
      }
    } catch {
      // Fall through
    }
  }

  // Channel ID (starts with UC, 24 chars)
  if (/^UC[\w-]{22}$/.test(trimmed)) {
    return { type: 'id', value: trimmed };
  }

  // @handle or plain handle
  return { type: 'handle', value: trimmed.replace(/^@/, '') };
}

export class YouTubeAdapter implements SocialAdapter {
  readonly platform = 'YOUTUBE' as const;

  async fetchProfile(input: ProviderVerificationInput): Promise<ProviderProfileResult> {
    const apiKey = process.env.YOUTUBE_API_KEY;
    if (!apiKey) {
      throw new ReachSocialVerificationError(
        'YouTube API key not configured',
        'PLATFORM_NOT_CONFIGURED',
        412,
      );
    }

    const parsed = parseYouTubeHandle(input.handle);

    let url: string;
    if (parsed.type === 'id') {
      url = `${YOUTUBE_API_BASE}/channels?part=snippet,statistics&id=${encodeURIComponent(parsed.value)}&key=${encodeURIComponent(apiKey)}`;
    } else {
      // forHandle requires the @ prefix
      url = `${YOUTUBE_API_BASE}/channels?part=snippet,statistics&forHandle=@${encodeURIComponent(parsed.value)}&key=${encodeURIComponent(apiKey)}`;
    }

    let response: Response;
    try {
      response = await fetch(url, {
        headers: { Accept: 'application/json' },
        signal: AbortSignal.timeout(10_000),
      });
    } catch (err) {
      log.error('YouTube API network error', { error: err, handle: input.handle });
      throw new ReachSocialVerificationError(
        'Failed to reach YouTube API',
        'PROVIDER_NETWORK_ERROR',
        502,
      );
    }

    if (response.status === 403) {
      const body = await response.json().catch(() => ({})) as YouTubeChannelListResponse;
      const reason = body.error?.errors?.[0]?.reason;
      if (reason === 'quotaExceeded') {
        log.warn('YouTube API quota exceeded');
        throw new ReachSocialVerificationError(
          'YouTube API quota exceeded. Try again later.',
          'PROVIDER_RATE_LIMITED',
          429,
        );
      }
      throw new ReachSocialVerificationError(
        'YouTube API access denied. Check API key permissions.',
        'PROVIDER_AUTH_ERROR',
        403,
      );
    }

    if (response.status === 429) {
      throw new ReachSocialVerificationError(
        'YouTube API rate limited. Try again later.',
        'PROVIDER_RATE_LIMITED',
        429,
      );
    }

    if (!response.ok) {
      log.error('YouTube API error', { status: response.status, handle: input.handle });
      throw new ReachSocialVerificationError(
        `YouTube API error (HTTP ${response.status})`,
        'PROVIDER_API_ERROR',
        502,
      );
    }

    const data = (await response.json()) as YouTubeChannelListResponse;

    if (!data.items || data.items.length === 0) {
      throw new ReachSocialVerificationError(
        `YouTube channel not found for handle "${input.handle}"`,
        'PROVIDER_PROFILE_NOT_FOUND',
        404,
      );
    }

    const channel = data.items[0];
    const snippet = channel.snippet ?? {};
    const stats = channel.statistics ?? {};

    const followerCount =
      stats.hiddenSubscriberCount ? undefined
      : stats.subscriberCount ? parseInt(stats.subscriberCount, 10)
      : undefined;

    const customUrl = snippet.customUrl;
    const profileUrl = customUrl
      ? `https://youtube.com/${customUrl}`
      : `https://youtube.com/channel/${channel.id}`;

    return {
      platformUserId: channel.id,
      normalizedHandle: customUrl?.replace(/^@/, '') ?? parsed.value,
      profileUrl,
      bioText: snippet.description ?? '',
      followerCount: Number.isFinite(followerCount) ? followerCount : undefined,
    };
  }
}
