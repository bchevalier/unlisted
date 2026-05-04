import { randomUUID } from 'node:crypto';
import { db } from '../db';
import { generateEmbeddings } from './embeddings';
import { serializeVector } from '../vector/pgvector';

const DEMO_EMBEDDING_DIMENSIONS = 1536;
const DEMO_EMBEDDING_MODEL =
  process.env.REACH_EMBEDDINGS_OPENAI_MODEL ??
  process.env.EMBEDDINGS_OPENAI_MODEL ??
  'text-embedding-3-small';

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

export async function ensureReachDemoIdentityStorage(): Promise<void> {
  await db.$executeRawUnsafe('CREATE EXTENSION IF NOT EXISTS vector');
  await db.$executeRawUnsafe(`
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
`.trim());
  await db.$executeRawUnsafe(`
CREATE UNIQUE INDEX IF NOT EXISTS "ReachIdentityEmbedding_source_key"
  ON "ReachIdentityEmbedding"("sourceFile", "sourceId")
`.trim());
  await db.$executeRawUnsafe(`
CREATE INDEX IF NOT EXISTS "ReachIdentityEmbedding_tags_idx"
  ON "ReachIdentityEmbedding" USING gin ("tags")
`.trim());
  await db.$executeRawUnsafe(`
CREATE INDEX IF NOT EXISTS "ReachIdentityEmbedding_embedding_hnsw_idx"
  ON "ReachIdentityEmbedding"
  USING hnsw ("embedding" vector_cosine_ops)
`.trim());
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
    { providerOrder: ['openai'] },
  );
}

export async function upsertReachDemoIdentity(input: ReachDemoIdentityInput): Promise<void> {
  const identity = normalizeIdentity(input);
  const embeddingResult = await embedText(identity.content);
  const embedding = embeddingResult.data[0]?.embedding;

  if (!embedding) {
    throw new Error('OpenAI returned no embedding for Reach demo identity');
  }

  const vectorLiteral = serializeVector(embedding);

  await db.$executeRawUnsafe(
    `
INSERT INTO "ReachIdentityEmbedding" (
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
VALUES ($1, $2, $3, $4, $5, $6, $7, $8::TEXT[], $9, $10::JSONB, $11::vector, $12, $13, $14)
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
    vectorLiteral,
    embeddingResult.provider,
    embeddingResult.model,
    embeddingResult.dimensions,
  );
}

export async function searchReachDemoIdentities(input: {
  request: string;
  topK?: number;
}): Promise<{ hits: ReachDemoIdentityHit[]; debug: { model: string; dimensions: number } }> {
  const requestText = input.request.trim();
  if (!requestText) throw new Error('Request text is required');

  const topK = Math.min(Math.max(input.topK ?? 5, 1), 10);
  const embeddingResult = await embedText(requestText);
  const embedding = embeddingResult.data[0]?.embedding;

  if (!embedding) {
    throw new Error('OpenAI returned no embedding for Reach demo request');
  }

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
    topK,
  );

  return {
    hits: rows.map((row) => ({
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
    })),
    debug: {
      model: embeddingResult.model,
      dimensions: embeddingResult.dimensions,
    },
  };
}
