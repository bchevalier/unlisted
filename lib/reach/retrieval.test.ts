import { describe, expect, it, vi } from 'vitest';
import type { EmbeddingResult } from './embeddings';
import {
  RetrievalError,
  retrieveTopK,
  type RetrievalDeps,
  type VectorSearchHit,
} from './retrieval';

function mockEmbeddingResult(): EmbeddingResult {
  return {
    provider: 'openai',
    model: 'text-embedding-3-small',
    dimensions: 3,
    data: [{ index: 0, embedding: [0.1, 0.2, 0.3] }],
    fallbackUsed: false,
    attemptedProviders: ['openai'],
  };
}

function makeDeps(overrides?: Partial<RetrievalDeps>): RetrievalDeps {
  const vectorHits: VectorSearchHit[] = [
    { id: 'c', score: 0.61, content: 'charlie' },
    { id: 'a', score: 0.92, content: 'alpha' },
    { id: 'b', score: 0.77, content: 'bravo' },
  ];

  return {
    embedder: vi.fn().mockResolvedValue(mockEmbeddingResult()),
    vectorStore: {
      kind: 'hnsw',
      search: vi.fn().mockResolvedValue(vectorHits),
    },
    ...overrides,
  };
}

describe('retrieveTopK', () => {
  it('returns vector-ranked topK when reranker is not provided', async () => {
    const deps = makeDeps();

    const result = await retrieveTopK({ query: 'find best', topK: 2 }, deps);

    expect(result.hits).toHaveLength(2);
    expect(result.hits.map((h) => h.id)).toEqual(['a', 'b']);
    expect(result.debug.rerankerUsed).toBe(false);
    expect(result.debug.vectorIndexKind).toBe('hnsw');
  });

  it('uses default recallK = topK * 5', async () => {
    const deps = makeDeps();

    await retrieveTopK({ query: 'find best', topK: 4 }, deps);

    expect(deps.vectorStore.search).toHaveBeenCalledWith(
      expect.objectContaining({
        topK: 20,
      }),
    );
  });

  it('forwards provider order to embedder', async () => {
    const deps = makeDeps();

    await retrieveTopK(
      {
        query: 'find best',
        topK: 2,
        providerOrder: ['voyage', 'openai'],
      },
      deps,
    );

    expect(deps.embedder).toHaveBeenCalledWith(
      { input: 'find best' },
      { providerOrder: ['voyage', 'openai'] },
    );
  });

  it('applies reranker ordering when provided', async () => {
    const reranker = vi.fn().mockResolvedValue([
      { id: 'b', score: 0.99, reason: 'best intent match' },
      { id: 'a', score: 0.88, reason: 'close intent match' },
    ]);

    const deps = makeDeps({ reranker });

    const result = await retrieveTopK({ query: 'find best', topK: 2 }, deps);

    expect(result.hits.map((h) => h.id)).toEqual(['b', 'a']);
    expect(result.hits[0]?.rerankScore).toBe(0.99);
    expect(result.debug.rerankerUsed).toBe(true);
  });

  it('falls back to vector ordering when reranker fails in non-strict mode', async () => {
    const deps = makeDeps({
      reranker: vi.fn().mockRejectedValue(new Error('reranker down')),
    });

    const result = await retrieveTopK({ query: 'find best', topK: 2 }, deps);

    expect(result.hits.map((h) => h.id)).toEqual(['a', 'b']);
    expect(result.debug.rerankerUsed).toBe(false);
  });

  it('throws in strict mode when reranker fails', async () => {
    const deps = makeDeps({
      reranker: vi.fn().mockRejectedValue(new Error('reranker down')),
    });

    await expect(
      retrieveTopK({ query: 'find best', topK: 2, strictRerank: true }, deps),
    ).rejects.toBeInstanceOf(RetrievalError);
  });

  it('deduplicates hits by id and keeps the best score', async () => {
    const deps = makeDeps({
      vectorStore: {
        kind: 'ivf',
        search: vi.fn().mockResolvedValue([
          { id: 'x', score: 0.6 },
          { id: 'x', score: 0.9 },
          { id: 'y', score: 0.7 },
        ]),
      },
    });

    const result = await retrieveTopK({ query: 'dedupe', topK: 3 }, deps);

    expect(result.hits.map((h) => [h.id, h.score])).toEqual([
      ['x', 0.9],
      ['y', 0.7],
    ]);
    expect(result.debug.candidateCount).toBe(2);
  });
});
