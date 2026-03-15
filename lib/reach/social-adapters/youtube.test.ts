import { beforeEach, describe, expect, it, vi } from 'vitest';
import { YouTubeAdapter } from './youtube';

// Mock logger
vi.mock('../../logger', () => ({
  logger: () => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  }),
}));

// Mock social-verifications just for error class
vi.mock('../social-verifications', () => ({
  ReachSocialVerificationError: class extends Error {
    code: string;
    statusCode: number;
    constructor(message: string, code: string, statusCode: number) {
      super(message);
      this.name = 'ReachSocialVerificationError';
      this.code = code;
      this.statusCode = statusCode;
    }
  },
}));

const adapter = new YouTubeAdapter();

describe('YouTubeAdapter', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.unstubAllEnvs();
    vi.stubGlobal('fetch', vi.fn());
  });

  it('returns PLATFORM_NOT_CONFIGURED when API key is missing', async () => {
    vi.stubEnv('YOUTUBE_API_KEY', '');

    await expect(
      adapter.fetchProfile({ handle: 'creator', challengePhrase: 'knokio-TEST' }),
    ).rejects.toMatchObject({
      code: 'PLATFORM_NOT_CONFIGURED',
      statusCode: 412,
    });
  });

  it('fetches profile successfully for @handle format', async () => {
    vi.stubEnv('YOUTUBE_API_KEY', 'test-api-key');

    const mockResponse = {
      ok: true,
      status: 200,
      json: vi.fn().mockResolvedValue({
        items: [
          {
            id: 'UCxxxxxx',
            snippet: {
              description: 'My channel bio knokio-TEST here',
              customUrl: '@creator',
            },
            statistics: {
              subscriberCount: '150000',
              hiddenSubscriberCount: false,
            },
          },
        ],
      }),
    };

    (globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValue(mockResponse);

    const result = await adapter.fetchProfile({
      handle: '@creator',
      challengePhrase: 'knokio-TEST',
    });

    expect(result.platformUserId).toBe('UCxxxxxx');
    expect(result.normalizedHandle).toBe('creator');
    expect(result.bioText).toBe('My channel bio knokio-TEST here');
    expect(result.followerCount).toBe(150000);
    expect(result.profileUrl).toBe('https://youtube.com/@creator');
  });

  it('handles channel not found', async () => {
    vi.stubEnv('YOUTUBE_API_KEY', 'test-api-key');

    const mockResponse = {
      ok: true,
      status: 200,
      json: vi.fn().mockResolvedValue({ items: [] }),
    };

    (globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValue(mockResponse);

    await expect(
      adapter.fetchProfile({ handle: 'nonexistent', challengePhrase: 'knokio-TEST' }),
    ).rejects.toMatchObject({
      code: 'PROVIDER_PROFILE_NOT_FOUND',
      statusCode: 404,
    });
  });

  it('handles quota exceeded (403)', async () => {
    vi.stubEnv('YOUTUBE_API_KEY', 'test-api-key');

    const mockResponse = {
      ok: false,
      status: 403,
      json: vi.fn().mockResolvedValue({
        error: {
          code: 403,
          message: 'Quota exceeded',
          errors: [{ reason: 'quotaExceeded' }],
        },
      }),
    };

    (globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValue(mockResponse);

    await expect(
      adapter.fetchProfile({ handle: 'creator', challengePhrase: 'knokio-TEST' }),
    ).rejects.toMatchObject({
      code: 'PROVIDER_RATE_LIMITED',
      statusCode: 429,
    });
  });

  it('handles rate limiting (429)', async () => {
    vi.stubEnv('YOUTUBE_API_KEY', 'test-api-key');

    const mockResponse = {
      ok: false,
      status: 429,
    };

    (globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValue(mockResponse);

    await expect(
      adapter.fetchProfile({ handle: 'creator', challengePhrase: 'knokio-TEST' }),
    ).rejects.toMatchObject({
      code: 'PROVIDER_RATE_LIMITED',
      statusCode: 429,
    });
  });

  it('handles network errors', async () => {
    vi.stubEnv('YOUTUBE_API_KEY', 'test-api-key');

    (globalThis.fetch as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('Network timeout'));

    await expect(
      adapter.fetchProfile({ handle: 'creator', challengePhrase: 'knokio-TEST' }),
    ).rejects.toMatchObject({
      code: 'PROVIDER_NETWORK_ERROR',
      statusCode: 502,
    });
  });

  it('handles hidden subscriber count', async () => {
    vi.stubEnv('YOUTUBE_API_KEY', 'test-api-key');

    const mockResponse = {
      ok: true,
      status: 200,
      json: vi.fn().mockResolvedValue({
        items: [
          {
            id: 'UCxxxxxx',
            snippet: {
              description: 'bio text',
              customUrl: '@privatecreator',
            },
            statistics: {
              subscriberCount: '0',
              hiddenSubscriberCount: true,
            },
          },
        ],
      }),
    };

    (globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValue(mockResponse);

    const result = await adapter.fetchProfile({
      handle: '@privatecreator',
      challengePhrase: 'knokio-TEST',
    });

    expect(result.followerCount).toBeUndefined();
  });

  it('handles channel ID format (UC...)', async () => {
    vi.stubEnv('YOUTUBE_API_KEY', 'test-api-key');

    const mockResponse = {
      ok: true,
      status: 200,
      json: vi.fn().mockResolvedValue({
        items: [
          {
            id: 'UCxxxxxxxxxxxxxxxxxxxxxx',
            snippet: { description: 'bio' },
            statistics: { subscriberCount: '100' },
          },
        ],
      }),
    };

    (globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValue(mockResponse);

    await adapter.fetchProfile({
      handle: 'UCxxxxxxxxxxxxxxxxxxxxxx',
      challengePhrase: 'knokio-TEST',
    });

    // Should use id= parameter, not forHandle=
    const fetchCall = (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls[0][0] as string;
    expect(fetchCall).toContain('id=UC');
    expect(fetchCall).not.toContain('forHandle=');
  });
});
