import { randomUUID } from 'node:crypto';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const DEFAULT_IDENTITIES_DIR = path.join(process.cwd(), 'data', 'reach-identities');
const EMBEDDING_DIMENSIONS = 1536;
const EMBEDDING_MODEL =
  process.env.REACH_EMBEDDINGS_OPENAI_MODEL ??
  process.env.EMBEDDINGS_OPENAI_MODEL ??
  'text-embedding-3-small';
const OPENAI_BASE_URL = (process.env.EMBEDDINGS_OPENAI_BASE_URL ?? 'https://api.openai.com/v1').replace(/\/+$/, '');

function parseArgs() {
  const args = process.argv.slice(2);
  const dirFlagIndex = args.findIndex((arg) => arg === '--dir');
  const dir = dirFlagIndex >= 0 ? args[dirFlagIndex + 1] : undefined;

  return {
    dir: dir ? path.resolve(process.cwd(), dir) : DEFAULT_IDENTITIES_DIR,
  };
}

function parseList(value) {
  return (value ?? '')
    .split(',')
    .map((item) => item.trim().toLowerCase())
    .filter(Boolean);
}

function parseIdentityFile(raw) {
  const lines = raw.split(/\r?\n/);
  const fields = new Map();
  const body = [];
  let inBody = false;

  for (const line of lines) {
    const separatorIndex = line.indexOf(':');
    if (!inBody && separatorIndex > 0) {
      const key = line.slice(0, separatorIndex).trim().toLowerCase();
      const value = line.slice(separatorIndex + 1).trim();
      fields.set(key, value);
      continue;
    }

    if (line.trim()) inBody = true;
    body.push(line);
  }

  const name = fields.get('name')?.trim();
  if (!name) {
    throw new Error('Identity file is missing a Name field');
  }

  const content = body.join('\n').trim();
  if (!content) {
    throw new Error(`Identity file for ${name} is missing body content`);
  }

  return {
    name,
    role: fields.get('role')?.trim() || null,
    organization: fields.get('organization')?.trim() || null,
    location: fields.get('location')?.trim() || null,
    tags: [...new Set(parseList(fields.get('tags')))],
    content,
    metadata: {
      sourceFormat: 'local-text',
    },
  };
}

async function listIdentityFiles(dir) {
  const entries = await fs.readdir(dir, { withFileTypes: true });
  return entries
    .filter((entry) => entry.isFile() && entry.name.endsWith('.txt'))
    .map((entry) => path.join(dir, entry.name))
    .sort();
}

function serializeVector(vector) {
  if (!Array.isArray(vector) || vector.length === 0) {
    throw new Error('Embedding vector must contain at least one value');
  }

  for (const value of vector) {
    if (!Number.isFinite(value)) {
      throw new Error('Embedding vector contains a non-finite value');
    }
  }

  return `[${vector.join(',')}]`;
}

async function ensureStorage() {
  await prisma.$executeRawUnsafe('CREATE EXTENSION IF NOT EXISTS vector');
  await prisma.$executeRawUnsafe(`
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
  await prisma.$executeRawUnsafe(`
CREATE UNIQUE INDEX IF NOT EXISTS "ReachIdentityEmbedding_source_key"
  ON "ReachIdentityEmbedding"("sourceFile", "sourceId")
`.trim());
  await prisma.$executeRawUnsafe(`
CREATE INDEX IF NOT EXISTS "ReachIdentityEmbedding_tags_idx"
  ON "ReachIdentityEmbedding" USING gin ("tags")
`.trim());
  await prisma.$executeRawUnsafe(`
CREATE INDEX IF NOT EXISTS "ReachIdentityEmbedding_embedding_hnsw_idx"
  ON "ReachIdentityEmbedding"
  USING hnsw ("embedding" vector_cosine_ops)
`.trim());
}

async function embedText(content) {
  const apiKey = process.env.OPENAI_API_KEY?.trim();
  if (!apiKey) {
    throw new Error('OPENAI_API_KEY is not configured in .env.local');
  }

  const response = await fetch(`${OPENAI_BASE_URL}/embeddings`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: EMBEDDING_MODEL,
      input: content,
      dimensions: EMBEDDING_DIMENSIONS,
    }),
  });

  const payload = await response.json();
  if (!response.ok) {
    const message = payload?.error?.message ?? payload?.message ?? `OpenAI embeddings request failed (${response.status})`;
    throw new Error(message);
  }

  const embedding = payload?.data?.[0]?.embedding;
  if (!Array.isArray(embedding)) {
    throw new Error('OpenAI returned no embedding vector');
  }

  return {
    provider: 'openai',
    model: payload.model ?? EMBEDDING_MODEL,
    dimensions: embedding.length,
    embedding,
  };
}

async function upsertIdentity(identity) {
  const embeddingResult = await embedText(identity.content);
  const vectorLiteral = serializeVector(embeddingResult.embedding);

  await prisma.$executeRawUnsafe(
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

async function main() {
  const { dir } = parseArgs();
  const files = await listIdentityFiles(dir);

  if (files.length === 0) {
    throw new Error(`No .txt identity files found in ${dir}`);
  }

  console.log(`Preparing Reach demo identity storage in ${dir}`);
  await ensureStorage();
  console.log(`Found ${files.length} identity file${files.length === 1 ? '' : 's'}.`);

  let seeded = 0;
  for (const file of files) {
    const raw = await fs.readFile(file, 'utf8');
    const parsed = parseIdentityFile(raw);
    const relativeFile = path.relative(process.cwd(), file);

    console.log(`Embedding Reach identity: ${parsed.name} (${relativeFile})`);
    await upsertIdentity({
      ...parsed,
      sourceFile: relativeFile,
      sourceId: path.basename(file, '.txt'),
    });

    seeded += 1;
    console.log(`Seeded Reach identity: ${parsed.name} (${relativeFile})`);
  }

  console.log(`Seeded ${seeded} Reach demo identity${seeded === 1 ? '' : 'ies'}.`);
}

main()
  .catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
