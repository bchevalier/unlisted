import { randomUUID } from 'node:crypto';
import { db } from '../db';
import { generateEmbeddings } from './embeddings';
import { serializeVector } from '../vector/pgvector';

const DEMO_EMBEDDING_DIMENSIONS = 1536;
const DEMO_EMBEDDING_MODEL =
  process.env.REACH_EMBEDDINGS_OPENAI_MODEL ??
  process.env.EMBEDDINGS_OPENAI_MODEL ??
  'text-embedding-3-small';

type ReachDemoStorageMode = 'pgvector' | 'array';

export interface ReachDemoIdentityInput {
  sourceFile: string;
  sourceId: string;
  name: string;
  role?: string | null;
  organization?: string | null;
  location?: string | null;
  tags?: string[];
  content: string;
  metadata?: Record<string, unknown>;
}

export interface ReachDemoIdentityHit {
  id: string;
  sourceFile: string;
  sourceId: string;
  name: string;
  role: string | null;
  organization: string | null;
  location: string | null;
  tags: string[];
  content: string;
  score: number;
  metadata: Record<string, unknown>;
}

interface ReachDemoIdentityRow {
  id: string;
  sourceFile: string;
  sourceId: string;
  name: string;
  role: string | null;
  organization: string | null;
  location: string | null;
  tags: string[];
  content: string;
  metadata: unknown;
  score: number | string;
}

interface ReachDemoIdentityArrayRow extends ReachDemoIdentityRow {
  embedding: number[];
}

interface ExtensionAvailabilityRow {
  available: boolean;
}

function isPgvectorUnavailable(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  return (
    message.includes('extension "vector" is not available') ||
    message.includes('type "vector" does not exist') ||
    message.includes('operator class "vector_cosine_ops" does not exist')
  );
}

async function ensurePgvectorStorage(): Promise<void> {
  const availability = await db.$queryRawUnsafe<ExtensionAvailabilityRow[]>(
    `SELECT EXISTS (SELECT 1 FROM pg_available_extensions WHERE name = 'vector') AS available`
  );
  if (!availability[0]?.available) {
    throw new Error('extension "vector" is not available');
  }

  await db.$executeRawUnsafe('CREATE EXTENSION IF NOT EXISTS vector');
  await db.$executeRawUnsafe(
    `
CREATE TABLE IF NOT EXISTS "ReachIdentityEmbedding" (
  "id" TEXT NOT NULL,
  "sourceFile" TEXT NOT NULL,
  "sourceId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "role" TEXT,
  "organization" TEXT,
  "location" TEXT,
  "tags" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "content" TEXT NOT NULL,
  "metadata" JSONB,
  "embedding" vector(1536) NOT NULL,
  "embeddingProvider" TEXT NOT NULL,
  "embeddingModel" TEXT NOT NULL,
  "embeddingDimensions" INTEGER NOT NULL DEFAULT 1536,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "ReachIdentityEmbedding_pkey" PRIMARY KEY ("id")
)
`.trim()
  );
  await db.$executeRawUnsafe(
    `
CREATE UNIQUE INDEX IF NOT EXISTS "ReachIdentityEmbedding_source_key"
  ON "ReachIdentityEmbedding"("sourceFile", "sourceId")
`.trim()
  );
  await db.$executeRawUnsafe(
    `
CREATE INDEX IF NOT EXISTS "ReachIdentityEmbedding_tags_idx"
  ON "ReachIdentityEmbedding" USING gin ("tags")
`.trim()
  );
  await db.$executeRawUnsafe(
    `
CREATE INDEX IF NOT EXISTS "ReachIdentityEmbedding_embedding_hnsw_idx"
  ON "ReachIdentityEmbedding"
  USING hnsw ("embedding" vector_cosine_ops)
`.trim()
  );
}

async function ensureArrayStorage(): Promise<void> {
  await db.$executeRawUnsafe(
    `
CREATE TABLE IF NOT EXISTS "ReachIdentityEmbeddingArray" (
  "id" TEXT NOT NULL,
  "sourceFile" TEXT NOT NULL,
  "sourceId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "role" TEXT,
  "organization" TEXT,
  "location" TEXT,
  "tags" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "content" TEXT NOT NULL,
  "metadata" JSONB,
  "embedding" DOUBLE PRECISION[] NOT NULL,
  "embeddingProvider" TEXT NOT NULL,
  "embeddingModel" TEXT NOT NULL,
  "embeddingDimensions" INTEGER NOT NULL DEFAULT 1536,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "ReachIdentityEmbeddingArray_pkey" PRIMARY KEY ("id")
)
`.trim()
  );
  await db.$executeRawUnsafe(
    `
CREATE UNIQUE INDEX IF NOT EXISTS "ReachIdentityEmbeddingArray_source_key"
  ON "ReachIdentityEmbeddingArray"("sourceFile", "sourceId")
`.trim()
  );
  await db.$executeRawUnsafe(
    `
CREATE INDEX IF NOT EXISTS "ReachIdentityEmbeddingArray_tags_idx"
  ON "ReachIdentityEmbeddingArray" USING gin ("tags")
`.trim()
  );
}

export async function ensureReachDemoIdentityStorage(): Promise<ReachDemoStorageMode> {
  try {
    await ensurePgvectorStorage();
    return 'pgvector';
  } catch (error) {
    if (!isPgvectorUnavailable(error)) throw error;
    await ensureArrayStorage();
    return 'array';
  }
}

function normalizeOptional(value: string | null | undefined): string | null {
  const normalized = value?.trim();
  return normalized ? normalized : null;
}

function normalizeTags(tags: string[] | undefined): string[] {
  return [...new Set((tags ?? []).map((tag) => tag.trim().toLowerCase()).filter(Boolean))];
}

function normalizeIdentity(input: ReachDemoIdentityInput): ReachDemoIdentityInput {
  const name = input.name.trim();
  const sourceFile = input.sourceFile.trim();
  const sourceId = input.sourceId.trim();
  const content = input.content.trim();

  if (!name) throw new Error('Reach demo identity name is required');
  if (!sourceFile) throw new Error('Reach demo identity sourceFile is required');
  if (!sourceId) throw new Error('Reach demo identity sourceId is required');
  if (!content) throw new Error('Reach demo identity content is required');

  return {
    ...input,
    sourceFile,
    sourceId,
    name,
    role: normalizeOptional(input.role),
    organization: normalizeOptional(input.organization),
    location: normalizeOptional(input.location),
    tags: normalizeTags(input.tags),
    content,
    metadata: input.metadata ?? {},
  };
}

async function embedText(input: string) {
  return generateEmbeddings(
    {
      input,
      model: DEMO_EMBEDDING_MODEL,
      dimensions: DEMO_EMBEDDING_DIMENSIONS,
    },
    { providerOrder: ['openai'] }
  );
}

export async function upsertReachDemoIdentity(input: ReachDemoIdentityInput): Promise<void> {
  const identity = normalizeIdentity(input);
  const storageMode = await ensureReachDemoIdentityStorage();
  const embeddingResult = await embedText(identity.content);
  const embedding = embeddingResult.data[0]?.embedding;

  if (!embedding) {
    throw new Error('OpenAI returned no embedding for Reach demo identity');
  }

  const embeddingValue = storageMode === 'pgvector' ? serializeVector(embedding) : embedding;
  const tableName =
    storageMode === 'pgvector' ? '"ReachIdentityEmbedding"' : '"ReachIdentityEmbeddingArray"';
  const embeddingCast = storageMode === 'pgvector' ? '$11::vector' : '$11::DOUBLE PRECISION[]';

  await db.$executeRawUnsafe(
    `
INSERT INTO ${tableName} (
  "id",
  "sourceFile",
  "sourceId",
  "name",
  "role",
  "organization",
  "location",
  "tags",
  "content",
  "metadata",
  "embedding",
  "embeddingProvider",
  "embeddingModel",
  "embeddingDimensions"
)
VALUES ($1, $2, $3, $4, $5, $6, $7, $8::TEXT[], $9, $10::JSONB, ${embeddingCast}, $12, $13, $14)
ON CONFLICT ("sourceFile", "sourceId")
DO UPDATE SET
  "name" = EXCLUDED."name",
  "role" = EXCLUDED."role",
  "organization" = EXCLUDED."organization",
  "location" = EXCLUDED."location",
  "tags" = EXCLUDED."tags",
  "content" = EXCLUDED."content",
  "metadata" = EXCLUDED."metadata",
  "embedding" = EXCLUDED."embedding",
  "embeddingProvider" = EXCLUDED."embeddingProvider",
  "embeddingModel" = EXCLUDED."embeddingModel",
  "embeddingDimensions" = EXCLUDED."embeddingDimensions",
  "updatedAt" = NOW()
`.trim(),
    randomUUID(),
    identity.sourceFile,
    identity.sourceId,
    identity.name,
    identity.role,
    identity.organization,
    identity.location,
    identity.tags,
    identity.content,
    JSON.stringify(identity.metadata ?? {}),
    embeddingValue,
    embeddingResult.provider,
    embeddingResult.model,
    embeddingResult.dimensions
  );
}

function cosineSimilarity(a: number[], b: number[]): number {
  const length = Math.min(a.length, b.length);
  let dot = 0;
  let normA = 0;
  let normB = 0;

  for (let index = 0; index < length; index += 1) {
    const aValue = a[index] ?? 0;
    const bValue = b[index] ?? 0;
    dot += aValue * bValue;
    normA += aValue * aValue;
    normB += bValue * bValue;
  }

  if (normA === 0 || normB === 0) return 0;
  return dot / (Math.sqrt(normA) * Math.sqrt(normB));
}

function mapReachDemoIdentityRow(row: ReachDemoIdentityRow): ReachDemoIdentityHit {
  return {
    id: row.id,
    sourceFile: row.sourceFile,
    sourceId: row.sourceId,
    name: row.name,
    role: row.role,
    organization: row.organization,
    location: row.location,
    tags: row.tags ?? [],
    content: row.content,
    score: Number(row.score),
    metadata:
      row.metadata && typeof row.metadata === 'object'
        ? (row.metadata as Record<string, unknown>)
        : {},
  };
}

export async function searchReachDemoIdentities(input: {
  request: string;
  topK?: number;
}): Promise<{ hits: ReachDemoIdentityHit[]; debug: { model: string; dimensions: number } }> {
  const requestText = input.request.trim();
  if (!requestText) throw new Error('Request text is required');

  const topK = Math.min(Math.max(input.topK ?? 5, 1), 10);
  const storageMode = await ensureReachDemoIdentityStorage();
  const embeddingResult = await embedText(requestText);
  const embedding = embeddingResult.data[0]?.embedding;

  if (!embedding) {
    throw new Error('OpenAI returned no embedding for Reach demo request');
  }

  let hits: ReachDemoIdentityHit[];

  if (storageMode === 'pgvector') {
    const vectorLiteral = serializeVector(embedding);
    const rows = await db.$queryRawUnsafe<ReachDemoIdentityRow[]>(
      `
SELECT
  "id",
  "sourceFile",
  "sourceId",
  "name",
  "role",
  "organization",
  "location",
  "tags",
  "content",
  "metadata",
  (1 - ("embedding" <=> $1::vector)) AS "score"
FROM "ReachIdentityEmbedding"
ORDER BY "embedding" <=> $1::vector
LIMIT $2
`.trim(),
      vectorLiteral,
      topK
    );
    hits = rows.map(mapReachDemoIdentityRow);
  } else {
    const rows = await db.$queryRawUnsafe<ReachDemoIdentityArrayRow[]>(
      `
SELECT
  "id",
  "sourceFile",
  "sourceId",
  "name",
  "role",
  "organization",
  "location",
  "tags",
  "content",
  "metadata",
  "embedding",
  0 AS "score"
FROM "ReachIdentityEmbeddingArray"
`.trim()
    );

    hits = rows
      .map((row) =>
        mapReachDemoIdentityRow({
          ...row,
          score: cosineSimilarity(embedding, row.embedding),
        })
      )
      .sort((a, b) => b.score - a.score)
      .slice(0, topK);
  }

  return {
    hits,
    debug: {
      model: embeddingResult.model,
      dimensions: embeddingResult.dimensions,
    },
  };
}
