import { beforeEach, describe, expect, it, vi } from 'vitest';
import { InstagramAdapter } from './instagram';

vi.mock('../../logger', () => ({
  logger: () => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  }),
}));

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

const adapter = new InstagramAdapter();

describe('InstagramAdapter', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.unstubAllEnvs();
    vi.stubGlobal('fetch', vi.fn());
  });

  it('returns PLATFORM_NOT_CONFIGURED when Meta credentials are missing', async () => {
    vi.stubEnv('META_APP_ID', '');
    vi.stubEnv('META_APP_SECRET', '');

    await expect(
      adapter.fetchProfile({ handle: 'creator', challengePhrase: 'knokio-TEST' }),
    ).rejects.toMatchObject({
      code: 'PLATFORM_NOT_CONFIGURED',
      statusCode: 412,
    });
  });

  it('returns PLATFORM_NOT_CONFIGURED when user access token is missing', async () => {
    vi.stubEnv('META_APP_ID', 'test-id');
    vi.stubEnv('META_APP_SECRET', 'test-secret');
    // INSTAGRAM_USER_ACCESS_TOKEN not set

    await expect(
      adapter.fetchProfile({ handle: 'creator', challengePhrase: 'knokio-TEST' }),
    ).rejects.toMatchObject({
      code: 'PLATFORM_NOT_CONFIGURED',
      statusCode: 412,
    });
  });

  it('fetches profile successfully', async () => {
    vi.stubEnv('META_APP_ID', 'test-id');
    vi.stubEnv('META_APP_SECRET', 'test-secret');
    vi.stubEnv('INSTAGRAM_USER_ACCESS_TOKEN', 'test-token');

    const mockResponse = {
      ok: true,
      status: 200,
      json: vi.fn().mockResolvedValue({
        id: '17841400000',
        username: 'creator',
        biography: 'My IG bio knokio-TEST here',
        followers_count: 75000,
      }),
    };

    (globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValue(mockResponse);

    const result = await adapter.fetchProfile({
      handle: '@Creator',
      challengePhrase: 'knokio-TEST',
    });

    expect(result.platformUserId).toBe('17841400000');
    expect(result.normalizedHandle).toBe('creator');
    expect(result.bioText).toBe('My IG bio knokio-TEST here');
    expect(result.followerCount).toBe(75000);
    expect(result.profileUrl).toBe('https://instagram.com/creator');
  });

  it('rejects handle mismatch between claimed handle and token owner', async () => {
    vi.stubEnv('META_APP_ID', 'test-id');
    vi.stubEnv('META_APP_SECRET', 'test-secret');
    vi.stubEnv('INSTAGRAM_USER_ACCESS_TOKEN', 'test-token');

    const mockResponse = {
      ok: true,
      status: 200,
      json: vi.fn().mockResolvedValue({
        id: '17841400000',
        username: 'differentuser',
        biography: 'Not the right user',
        followers_count: 100,
      }),
    };

    (globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValue(mockResponse);

    await expect(
      adapter.fetchProfile({ handle: 'creator', challengePhrase: 'knokio-TEST' }),
    ).rejects.toMatchObject({
      code: 'PROVIDER_HANDLE_MISMATCH',
      statusCode: 400,
    });
  });

  it('handles expired token (error code 190)', async () => {
    vi.stubEnv('META_APP_ID', 'test-id');
    vi.stubEnv('META_APP_SECRET', 'test-secret');
    vi.stubEnv('INSTAGRAM_USER_ACCESS_TOKEN', 'expired-token');

    const mockResponse = {
      ok: false,
      status: 400,
      json: vi.fn().mockResolvedValue({
        error: {
          message: 'Error validating access token',
          type: 'OAuthException',
          code: 190,
        },
      }),
    };

    (globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValue(mockResponse);

    await expect(
      adapter.fetchProfile({ handle: 'creator', challengePhrase: 'knokio-TEST' }),
    ).rejects.toMatchObject({
      code: 'PROVIDER_AUTH_ERROR',
      statusCode: 403,
    });
  });

  it('handles rate limiting (429)', async () => {
    vi.stubEnv('META_APP_ID', 'test-id');
    vi.stubEnv('META_APP_SECRET', 'test-secret');
    vi.stubEnv('INSTAGRAM_USER_ACCESS_TOKEN', 'test-token');

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
    vi.stubEnv('META_APP_ID', 'test-id');
    vi.stubEnv('META_APP_SECRET', 'test-secret');
    vi.stubEnv('INSTAGRAM_USER_ACCESS_TOKEN', 'test-token');

    (globalThis.fetch as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('Connection refused'));

    await expect(
      adapter.fetchProfile({ handle: 'creator', challengePhrase: 'knokio-TEST' }),
    ).rejects.toMatchObject({
      code: 'PROVIDER_NETWORK_ERROR',
      statusCode: 502,
    });
  });
});
