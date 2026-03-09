import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  EmbeddingError,
  configuredEmbeddingProviders,
  generateEmbeddings,
  resolveEmbeddingProviderOrder,
} from './embeddings';

const originalEnv = { ...process.env };

function jsonResponse(status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

describe('resolveEmbeddingProviderOrder', () => {
  it('returns defaults when env value is missing', () => {
    expect(resolveEmbeddingProviderOrder('')).toEqual(['openai', 'voyage', 'google']);
  });

  it('normalizes and deduplicates configured values', () => {
    expect(resolveEmbeddingProviderOrder('  voyage,openai,voyage,google  ')).toEqual([
      'voyage',
      'openai',
      'google',
    ]);
  });

  it('drops unknown providers and falls back when all are invalid', () => {
    expect(resolveEmbeddingProviderOrder('acme,foo')).toEqual(['openai', 'voyage', 'google']);
  });
});

describe('configuredEmbeddingProviders', () => {
  beforeEach(() => {
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  it('returns configured providers in order', () => {
    process.env.OPENAI_API_KEY = 'openai-key';
    process.env.VOYAGE_API_KEY = 'voyage-key';
    process.env.EMBEDDING_PROVIDER_ORDER = 'voyage,openai';

    expect(configuredEmbeddingProviders()).toEqual(['voyage', 'openai']);
  });
});

describe('generateEmbeddings', () => {
  beforeEach(() => {
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = { ...originalEnv };
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it('generates embeddings with the first configured provider', async () => {
    process.env.OPENAI_API_KEY = 'openai-key';
    process.env.EMBEDDING_PROVIDER_ORDER = 'openai';

    const fetchMock = vi.fn().mockResolvedValue(
      jsonResponse(200, {
        model: 'text-embedding-3-small',
        data: [{ index: 0, embedding: [0.1, 0.2, 0.3] }],
        usage: { prompt_tokens: 4, total_tokens: 4 },
      }),
    );
    vi.stubGlobal('fetch', fetchMock);

    const result = await generateEmbeddings({ input: 'hello world' });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(result.provider).toBe('openai');
    expect(result.model).toBe('text-embedding-3-small');
    expect(result.dimensions).toBe(3);
    expect(result.fallbackUsed).toBe(false);
    expect(result.data).toEqual([{ index: 0, embedding: [0.1, 0.2, 0.3] }]);
  });

  it('falls back to next configured provider on upstream failure', async () => {
    process.env.OPENAI_API_KEY = 'openai-key';
    process.env.VOYAGE_API_KEY = 'voyage-key';
    process.env.EMBEDDING_PROVIDER_ORDER = 'openai,voyage';

    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse(503, { error: { message: 'openai unavailable' } }))
      .mockResolvedValueOnce(
        jsonResponse(200, {
          model: 'voyage-3-lite',
          data: [{ index: 0, embedding: [0.9, 0.8] }],
          usage: { total_tokens: 7 },
        }),
      );

    vi.stubGlobal('fetch', fetchMock);

    const result = await generateEmbeddings({ input: ['test input'] });

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(result.provider).toBe('voyage');
    expect(result.fallbackUsed).toBe(true);
    expect(result.attemptedProviders).toEqual(['openai', 'voyage']);
    expect(result.data[0]?.embedding).toEqual([0.9, 0.8]);
  });

  it('throws a clear error when no providers are configured', async () => {
    await expect(generateEmbeddings({ input: 'no providers configured' })).rejects.toMatchObject({
      name: 'EmbeddingError',
      code: 'EMBEDDING_NO_PROVIDER_CONFIGURED',
    });
  });

  it('surfaces aggregated provider failures when all providers fail', async () => {
    process.env.OPENAI_API_KEY = 'openai-key';
    process.env.EMBEDDING_PROVIDER_ORDER = 'openai';

    const fetchMock = vi
      .fn()
      .mockResolvedValue(jsonResponse(500, { error: { message: 'server exploded' } }));

    vi.stubGlobal('fetch', fetchMock);

    try {
      await generateEmbeddings({ input: 'test' });
      throw new Error('expected generateEmbeddings to fail');
    } catch (error) {
      expect(error).toBeInstanceOf(EmbeddingError);
      const embeddingError = error as EmbeddingError;
      expect(embeddingError.code).toBe('EMBEDDING_ALL_PROVIDERS_FAILED');
      expect(embeddingError.failures?.length).toBe(1);
      expect(embeddingError.failures?.[0]?.provider).toBe('openai');
    }
  });
});
