import { db } from '../db';
import type { RetrievalQuery, VectorSearchAdapter, VectorSearchHit } from '../reach/retrieval';

export interface PgvectorExecutor {
  query<T>(sql: string, params: unknown[]): Promise<T[]>;
  execute(sql: string, params: unknown[]): Promise<number>;
}

export interface DoorEmbeddingChunkInput {
  doorId: string;
  sourceType: string;
  sourceId: string;
  chunkIndex: number;
  content: string;
  metadata?: Record<string, unknown>;
  embedding: number[];
}

export interface DoorEmbeddingSearchFilters {
  doorId?: string;
  sourceType?: string;
  sourceId?: string;
  minScore?: number;
}

export interface DoorPgvectorAdapterOptions {
  doorId?: string;
  executor?: PgvectorExecutor;
}

export class PgvectorError extends Error {
  code: string;

  constructor(message: string, code = 'PGVECTOR_ERROR', options?: { cause?: unknown }) {
    super(message, options?.cause ? { cause: options.cause } : undefined);
    this.name = 'PgvectorError';
    this.code = code;
  }
}

interface DoorEmbeddingRow {
  id: string;
  doorId: string;
  sourceType: string;
  sourceId: string;
  chunkIndex: number;
  content: string;
  metadata: unknown;
  score: number | string;
}

function defaultExecutor(): PgvectorExecutor {
  return {
    query: async <T>(sql: string, params: unknown[]): Promise<T[]> => {
      const rows = await db.$queryRawUnsafe(sql, ...params);
      return rows as T[];
    },
    execute: (sql, params) => db.$executeRawUnsafe(sql, ...params),
  };
}

function ensureFiniteNumber(value: number, fieldName: string): void {
  if (!Number.isFinite(value)) {
    throw new PgvectorError(`${fieldName} must be a finite number`, 'PGVECTOR_INVALID_NUMBER');
  }
}

function sanitizeString(value: string, fieldName: string): string {
  const normalized = value.trim();
  if (!normalized) {
    throw new PgvectorError(`${fieldName} must not be empty`, 'PGVECTOR_INVALID_INPUT');
  }
  return normalized;
}

export function serializeVector(vector: number[]): string {
  if (!Array.isArray(vector) || vector.length === 0) {
    throw new PgvectorError('embedding vector must contain at least one value', 'PGVECTOR_INVALID_VECTOR');
  }

  for (let index = 0; index < vector.length; index += 1) {
    const value = vector[index];
    ensureFiniteNumber(value, `embedding[${index}]`);
  }

  return `[${vector.join(',')}]`;
}

function parseDoorSearchFilters(filters: Record<string, unknown> | undefined): DoorEmbeddingSearchFilters {
  if (!filters) return {};

  const parsed: DoorEmbeddingSearchFilters = {};

  if (typeof filters.doorId === 'string') parsed.doorId = filters.doorId;
  if (typeof filters.sourceType === 'string') parsed.sourceType = filters.sourceType;
  if (typeof filters.sourceId === 'string') parsed.sourceId = filters.sourceId;
  if (typeof filters.minScore === 'number' && Number.isFinite(filters.minScore)) {
    parsed.minScore = filters.minScore;
  }

  return parsed;
}

export function buildDoorEmbeddingSearchQuery(input: {
  vectorLiteral: string;
  doorId: string;
  topK: number;
  sourceType?: string;
  sourceId?: string;
  minScore?: number;
}): { sql: string; params: unknown[] } {
  const params: unknown[] = [];
  const addParam = (value: unknown): string => {
    params.push(value);
    return `$${params.length}`;
  };

  const vectorRef = addParam(input.vectorLiteral);

  const whereClauses: string[] = [];
  whereClauses.push(`"doorId" = ${addParam(input.doorId)}`);

  if (input.sourceType) {
    whereClauses.push(`"sourceType" = ${addParam(input.sourceType)}`);
  }

  if (input.sourceId) {
    whereClauses.push(`"sourceId" = ${addParam(input.sourceId)}`);
  }

  if (typeof input.minScore === 'number') {
    whereClauses.push(`(1 - (embedding <=> ${vectorRef}::vector)) >= ${addParam(input.minScore)}`);
  }

  const limitRef = addParam(input.topK);

  const sql = `
SELECT
  id,
  "doorId",
  "sourceType",
  "sourceId",
  "chunkIndex",
  content,
  metadata,
  (1 - (embedding <=> ${vectorRef}::vector)) AS score
FROM "DoorEmbeddingChunk"
WHERE ${whereClauses.join(' AND ')}
ORDER BY embedding <=> ${vectorRef}::vector
LIMIT ${limitRef}
`.trim();

  return { sql, params };
}

export function createDoorPgvectorAdapter(options?: DoorPgvectorAdapterOptions): VectorSearchAdapter {
  const executor = options?.executor ?? defaultExecutor();

  return {
    kind: 'hnsw',
    async search(input: RetrievalQuery): Promise<VectorSearchHit[]> {
      const topK = Math.max(1, input.topK);
      const vectorLiteral = serializeVector(input.queryEmbedding);
      const parsedFilters = parseDoorSearchFilters(input.filters);
      const resolvedDoorId = sanitizeString(
        parsedFilters.doorId ?? options?.doorId ?? '',
        'doorId',
      );

      const { sql, params } = buildDoorEmbeddingSearchQuery({
        vectorLiteral,
        doorId: resolvedDoorId,
        topK,
        sourceType: parsedFilters.sourceType,
        sourceId: parsedFilters.sourceId,
        minScore: parsedFilters.minScore,
      });

      let rows: DoorEmbeddingRow[];
      try {
        rows = await executor.query<DoorEmbeddingRow>(sql, params);
      } catch (error) {
        throw new PgvectorError('Door embedding search failed', 'PGVECTOR_SEARCH_FAILED', {
          cause: error,
        });
      }

      return rows.map((row) => ({
        id: row.id,
        score: Number(row.score),
        content: row.content,
        metadata:
          row.metadata && typeof row.metadata === 'object'
            ? {
                ...(row.metadata as Record<string, unknown>),
                doorId: row.doorId,
                sourceType: row.sourceType,
                sourceId: row.sourceId,
                chunkIndex: row.chunkIndex,
              }
            : {
                doorId: row.doorId,
                sourceType: row.sourceType,
                sourceId: row.sourceId,
                chunkIndex: row.chunkIndex,
              },
      }));
    },
  };
}

export async function upsertDoorEmbeddingChunk(
  input: DoorEmbeddingChunkInput,
  options?: { executor?: PgvectorExecutor },
): Promise<void> {
  const executor = options?.executor ?? defaultExecutor();

  const doorId = sanitizeString(input.doorId, 'doorId');
  const sourceType = sanitizeString(input.sourceType, 'sourceType');
  const sourceId = sanitizeString(input.sourceId, 'sourceId');
  const content = sanitizeString(input.content, 'content');

  if (!Number.isInteger(input.chunkIndex) || input.chunkIndex < 0) {
    throw new PgvectorError('chunkIndex must be a non-negative integer', 'PGVECTOR_INVALID_INPUT');
  }

  const vectorLiteral = serializeVector(input.embedding);

  const sql = `
INSERT INTO "DoorEmbeddingChunk" (
  "doorId",
  "sourceType",
  "sourceId",
  "chunkIndex",
  content,
  metadata,
  embedding
)
VALUES ($1, $2, $3, $4, $5, $6, $7::vector)
ON CONFLICT ("doorId", "sourceType", "sourceId", "chunkIndex")
DO UPDATE SET
  content = EXCLUDED.content,
  metadata = EXCLUDED.metadata,
  embedding = EXCLUDED.embedding,
  "updatedAt" = NOW()
`.trim();

  try {
    await executor.execute(sql, [
      doorId,
      sourceType,
      sourceId,
      input.chunkIndex,
      content,
      input.metadata ?? {},
      vectorLiteral,
    ]);
  } catch (error) {
    throw new PgvectorError('Failed to upsert door embedding chunk', 'PGVECTOR_UPSERT_FAILED', {
      cause: error,
    });
  }
}

export async function deleteDoorEmbeddingChunksBySource(input: {
  doorId: string;
  sourceType: string;
  sourceId: string;
}, options?: { executor?: PgvectorExecutor }): Promise<number> {
  const executor = options?.executor ?? defaultExecutor();

  const sql = `
DELETE FROM "DoorEmbeddingChunk"
WHERE "doorId" = $1 AND "sourceType" = $2 AND "sourceId" = $3
`.trim();

  try {
    return await executor.execute(sql, [
      sanitizeString(input.doorId, 'doorId'),
      sanitizeString(input.sourceType, 'sourceType'),
      sanitizeString(input.sourceId, 'sourceId'),
    ]);
  } catch (error) {
    throw new PgvectorError('Failed to delete door embedding chunks by source', 'PGVECTOR_DELETE_FAILED', {
      cause: error,
    });
  }
}
