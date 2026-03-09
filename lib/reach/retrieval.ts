import { z } from 'zod';
import {
  EMBEDDING_PROVIDER_NAMES,
  EmbeddingError,
  type EmbeddingProviderName,
  type EmbeddingRequestInput,
  type EmbeddingResult,
  generateEmbeddings,
} from './embeddings';

const RetrievalQuerySchema = z
  .object({
    query: z.string().trim().min(1, 'query must not be empty'),
    topK: z.number().int().positive().max(100).default(5),
    recallK: z.number().int().positive().max(500).optional(),
    filters: z.record(z.unknown()).optional(),
    providerOrder: z.array(z.enum(EMBEDDING_PROVIDER_NAMES)).optional(),
    rerank: z.boolean().optional(),
    strictRerank: z.boolean().default(false),
  })
  .strict();

export type RetrievalQueryInput = z.input<typeof RetrievalQuerySchema>;

export interface RetrievalQuery {
  query: string;
  queryEmbedding: number[];
  topK: number;
  filters?: Record<string, unknown>;
}

export interface VectorSearchHit {
  id: string;
  score: number;
  content?: string;
  metadata?: Record<string, unknown>;
}

export interface VectorSearchAdapter {
  /**
   * Optional index kind for observability/debugging.
   * Use this to signal adapter backing: hnsw / ivf / exact / hybrid.
   */
  kind?: 'hnsw' | 'ivf' | 'exact' | 'hybrid';

  /**
   * Return top candidates by vector similarity score (higher = better).
   */
  search(input: RetrievalQuery): Promise<VectorSearchHit[]>;
}

export interface RerankQuery {
  query: string;
  candidates: VectorSearchHit[];
}

export interface RerankHit {
  id: string;
  score: number;
  reason?: string;
}

export type Reranker = (input: RerankQuery) => Promise<RerankHit[]>;

export interface RetrievalDeps {
  vectorStore: VectorSearchAdapter;
  reranker?: Reranker;
  embedder?: (
    input: EmbeddingRequestInput,
    options?: { providerOrder?: EmbeddingProviderName[] },
  ) => Promise<EmbeddingResult>;
}

export interface RetrievalHit extends VectorSearchHit {
  rank: number;
  rerankScore?: number;
  rerankReason?: string;
}

export interface RetrievalResult {
  query: string;
  topK: number;
  recallK: number;
  hits: RetrievalHit[];
  debug: {
    embeddingProvider: EmbeddingProviderName;
    embeddingModel: string;
    embeddingDimensions: number;
    embeddingFallbackUsed: boolean;
    attemptedProviders: EmbeddingProviderName[];
    vectorIndexKind: VectorSearchAdapter['kind'];
    rerankerUsed: boolean;
    candidateCount: number;
  };
}

export class RetrievalError extends Error {
  code: string;
  cause?: unknown;

  constructor(message: string, code = 'RETRIEVAL_ERROR', cause?: unknown) {
    super(message, cause ? { cause } : undefined);
    this.name = 'RetrievalError';
    this.code = code;
    this.cause = cause;
  }
}

function computeRecallK(topK: number, recallK?: number): number {
  if (recallK) return Math.max(topK, recallK);
  return Math.max(topK, topK * 5);
}

function dedupeHits(hits: VectorSearchHit[]): VectorSearchHit[] {
  const byId = new Map<string, VectorSearchHit>();

  for (const hit of hits) {
    const existing = byId.get(hit.id);
    if (!existing || hit.score > existing.score) {
      byId.set(hit.id, hit);
    }
  }

  return [...byId.values()].sort((a, b) => b.score - a.score);
}

function applyRerank(baseHits: VectorSearchHit[], rerankHits: RerankHit[]): RetrievalHit[] {
  const rerankById = new Map(rerankHits.map((hit) => [hit.id, hit]));

  return [...baseHits]
    .sort((a, b) => {
      const rerankA = rerankById.get(a.id);
      const rerankB = rerankById.get(b.id);

      if (rerankA && rerankB) {
        return rerankB.score - rerankA.score;
      }
      if (rerankA) return -1;
      if (rerankB) return 1;
      return b.score - a.score;
    })
    .map((hit, index) => {
      const rerank = rerankById.get(hit.id);
      return {
        ...hit,
        rank: index + 1,
        rerankScore: rerank?.score,
        rerankReason: rerank?.reason,
      };
    });
}

function toRankedHits(hits: VectorSearchHit[]): RetrievalHit[] {
  return hits
    .sort((a, b) => b.score - a.score)
    .map((hit, index) => ({
      ...hit,
      rank: index + 1,
    }));
}

export async function retrieveTopK(
  input: RetrievalQueryInput,
  deps: RetrievalDeps,
): Promise<RetrievalResult> {
  const parsed = RetrievalQuerySchema.parse(input);
  const recallK = computeRecallK(parsed.topK, parsed.recallK);
  const embedder = deps.embedder ?? generateEmbeddings;

  let embedding: EmbeddingResult;
  try {
    embedding = await embedder(
      {
        input: parsed.query,
      },
      parsed.providerOrder ? { providerOrder: parsed.providerOrder } : undefined,
    );
  } catch (error) {
    if (error instanceof EmbeddingError) {
      throw new RetrievalError(error.message, error.code, error);
    }
    throw new RetrievalError('Failed to generate query embedding', 'RETRIEVAL_EMBEDDING_FAILED', error);
  }

  const queryEmbedding = embedding.data[0]?.embedding;
  if (!queryEmbedding || queryEmbedding.length === 0) {
    throw new RetrievalError('Embedding provider returned empty query vector', 'RETRIEVAL_EMPTY_EMBEDDING');
  }

  let recalled: VectorSearchHit[];
  try {
    recalled = await deps.vectorStore.search({
      query: parsed.query,
      queryEmbedding,
      topK: recallK,
      filters: parsed.filters,
    });
  } catch (error) {
    throw new RetrievalError('Vector search adapter failed', 'RETRIEVAL_VECTOR_SEARCH_FAILED', error);
  }

  const deduped = dedupeHits(recalled);
  const shouldRerank = parsed.rerank ?? Boolean(deps.reranker);

  let ranked: RetrievalHit[];
  let rerankerUsed = false;

  if (shouldRerank && deps.reranker) {
    try {
      const rerankResult = await deps.reranker({
        query: parsed.query,
        candidates: deduped,
      });
      ranked = applyRerank(deduped, rerankResult);
      rerankerUsed = true;
    } catch (error) {
      if (parsed.strictRerank) {
        throw new RetrievalError('Reranker failed in strict mode', 'RETRIEVAL_RERANK_FAILED', error);
      }
      ranked = toRankedHits(deduped);
    }
  } else {
    ranked = toRankedHits(deduped);
  }

  const hits = ranked.slice(0, parsed.topK).map((hit, index) => ({
    ...hit,
    rank: index + 1,
  }));

  return {
    query: parsed.query,
    topK: parsed.topK,
    recallK,
    hits,
    debug: {
      embeddingProvider: embedding.provider,
      embeddingModel: embedding.model,
      embeddingDimensions: embedding.dimensions,
      embeddingFallbackUsed: embedding.fallbackUsed,
      attemptedProviders: embedding.attemptedProviders,
      vectorIndexKind: deps.vectorStore.kind,
      rerankerUsed,
      candidateCount: deduped.length,
    },
  };
}
