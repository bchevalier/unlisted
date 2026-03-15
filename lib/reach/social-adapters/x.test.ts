import { beforeEach, describe, expect, it, vi } from 'vitest';
import { XAdapter } from './x';

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

const adapter = new XAdapter();

describe('XAdapter', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.unstubAllEnvs();
    vi.stubGlobal('fetch', vi.fn());
  });

  it('returns PLATFORM_NOT_CONFIGURED when bearer token is missing', async () => {
    vi.stubEnv('X_API_BEARER_TOKEN', '');

    await expect(
      adapter.fetchProfile({ handle: 'creator', challengePhrase: 'knokio-TEST' }),
    ).rejects.toMatchObject({
      code: 'PLATFORM_NOT_CONFIGURED',
      statusCode: 412,
    });
  });

  it('fetches profile successfully', async () => {
    vi.stubEnv('X_API_BEARER_TOKEN', 'test-bearer');

    const mockResponse = {
      ok: true,
      status: 200,
      json: vi.fn().mockResolvedValue({
        data: {
          id: '12345',
          username: 'Creator',
          name: 'The Creator',
          description: 'Hello knokio-TEST world',
          public_metrics: {
            followers_count: 25000,
            following_count: 500,
            tweet_count: 10000,
            listed_count: 100,
          },
        },
      }),
    };

    (globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValue(mockResponse);

    const result = await adapter.fetchProfile({
      handle: '@Creator',
      challengePhrase: 'knokio-TEST',
    });

    expect(result.platformUserId).toBe('12345');
    expect(result.normalizedHandle).toBe('creator');
    expect(result.bioText).toBe('Hello knokio-TEST world');
    expect(result.followerCount).toBe(25000);
    expect(result.profileUrl).toBe('https://x.com/Creator');
  });

  it('handles user not found (errors array)', async () => {
    vi.stubEnv('X_API_BEARER_TOKEN', 'test-bearer');

    const mockResponse = {
      ok: true,
      status: 200,
      json: vi.fn().mockResolvedValue({
        errors: [
          {
            title: 'Not Found Error',
            detail: 'Could not find user with username [nonexistent].',
            type: 'https://api.twitter.com/2/problems/resource-not-found',
          },
        ],
      }),
    };

    (globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValue(mockResponse);

    await expect(
      adapter.fetchProfile({ handle: 'nonexistent', challengePhrase: 'knokio-TEST' }),
    ).rejects.toMatchObject({
      code: 'PROVIDER_PROFILE_NOT_FOUND',
      statusCode: 404,
    });
  });

  it('handles 401 auth errors', async () => {
    vi.stubEnv('X_API_BEARER_TOKEN', 'bad-token');

    const mockResponse = {
      ok: false,
      status: 401,
    };

    (globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValue(mockResponse);

    await expect(
      adapter.fetchProfile({ handle: 'creator', challengePhrase: 'knokio-TEST' }),
    ).rejects.toMatchObject({
      code: 'PROVIDER_AUTH_ERROR',
      statusCode: 403,
    });
  });

  it('handles 429 rate limiting with Retry-After', async () => {
    vi.stubEnv('X_API_BEARER_TOKEN', 'test-bearer');

    const mockHeaders = new Map([['retry-after', '60']]);
    const mockResponse = {
      ok: false,
      status: 429,
      headers: { get: (name: string) => mockHeaders.get(name) ?? null },
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
    vi.stubEnv('X_API_BEARER_TOKEN', 'test-bearer');

    (globalThis.fetch as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('DNS failure'));

    await expect(
      adapter.fetchProfile({ handle: 'creator', challengePhrase: 'knokio-TEST' }),
    ).rejects.toMatchObject({
      code: 'PROVIDER_NETWORK_ERROR',
      statusCode: 502,
    });
  });

  it('normalizes handle from URL format', async () => {
    vi.stubEnv('X_API_BEARER_TOKEN', 'test-bearer');

    const mockResponse = {
      ok: true,
      status: 200,
      json: vi.fn().mockResolvedValue({
        data: {
          id: '99',
          username: 'someuser',
          name: 'Some User',
          description: 'bio',
        },
      }),
    };

    (globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValue(mockResponse);

    await adapter.fetchProfile({
      handle: 'https://x.com/someuser',
      challengePhrase: 'knokio-TEST',
    });

    const fetchCall = (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls[0][0] as string;
    expect(fetchCall).toContain('/users/by/username/someuser');
  });
});
