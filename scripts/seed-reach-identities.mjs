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
const EMBEDDING_BATCH_SIZE = Number(process.env.REACH_IDENTITY_EMBEDDING_BATCH_SIZE ?? 100);
const OPENAI_BASE_URL = (
  process.env.EMBEDDINGS_OPENAI_BASE_URL ?? 'https://api.openai.com/v1'
).replace(/\/+$/, '');

function parseArgs() {
  const args = process.argv.slice(2);
  const dirFlagIndex = args.findIndex((arg) => arg === '--dir');
  const dir = dirFlagIndex >= 0 ? args[dirFlagIndex + 1] : undefined;
  const fileFlagIndex = args.findIndex((arg) => arg === '--file');
  const file = fileFlagIndex >= 0 ? args[fileFlagIndex + 1] : undefined;

  return {
    dir: dir ? path.resolve(process.cwd(), dir) : DEFAULT_IDENTITIES_DIR,
    file: file ? path.resolve(process.cwd(), file) : null,
  };
}

function parseList(value) {
  return (value ?? '')
    .split(',')
    .map((item) => item.trim().toLowerCase())
    .filter(Boolean);
}

function parseIdentityBlock(raw) {
  const lines = raw.split(/\r?\n/);
  const fields = new Map();
  const body = [];
  const HEADER_KEYS = new Set(['name', 'role', 'organization', 'location', 'tags']);
  let inHeader = true;
  let sawHeader = false;

  for (const line of lines) {
    if (inHeader) {
      const trimmed = line.trim();
      if (!trimmed) {
        if (sawHeader) inHeader = false;
        continue;
      }

      const separatorIndex = line.indexOf(':');
      if (separatorIndex > 0) {
        const key = line.slice(0, separatorIndex).trim().toLowerCase();
        if (HEADER_KEYS.has(key)) {
          const value = line.slice(separatorIndex + 1).trim();
          fields.set(key, value);
          sawHeader = true;
          continue;
        }
      }

      inHeader = false;
    }

    body.push(line);
  }

  if (!fields.has('name')) {
    const fallbackName = lines
      .find((line) => line.toLowerCase().startsWith('name:'))
      ?.slice('name:'.length)
      .trim();
    if (fallbackName) {
      fields.set('name', fallbackName);
    }
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

function parseIdentityFile(raw, file) {
  const blocks = raw
    .split(/\n---+\n/g)
    .map((block) => block.trim())
    .filter(Boolean);

  if (blocks.length === 0) {
    throw new Error(`Identity file is empty: ${file}`);
  }

  return blocks.map(parseIdentityBlock);
}

async function listIdentityFiles(dir, file = null) {
  if (file) {
    const stats = await fs.stat(file);
    if (!stats.isFile() || !file.endsWith('.txt')) {
      throw new Error(`Identity file must be a .txt file: ${file}`);
    }
    return [file];
  }

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

function isPgvectorUnavailable(error) {
  const message = error instanceof Error ? error.message : String(error);
  return (
    message.includes('extension "vector" is not available') ||
    message.includes('type "vector" does not exist') ||
    message.includes('operator class "vector_cosine_ops" does not exist')
  );
}

async function ensurePgvectorStorage() {
  const availability = await prisma.$queryRawUnsafe(
    `SELECT EXISTS (SELECT 1 FROM pg_available_extensions WHERE name = 'vector') AS available`
  );
  if (!availability[0]?.available) {
    throw new Error('extension "vector" is not available');
  }

  await prisma.$executeRawUnsafe('CREATE EXTENSION IF NOT EXISTS vector');
  await prisma.$executeRawUnsafe(
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
  await prisma.$executeRawUnsafe(
    `
CREATE UNIQUE INDEX IF NOT EXISTS "ReachIdentityEmbedding_source_key"
  ON "ReachIdentityEmbedding"("sourceFile", "sourceId")
`.trim()
  );
  await prisma.$executeRawUnsafe(
    `
CREATE INDEX IF NOT EXISTS "ReachIdentityEmbedding_tags_idx"
  ON "ReachIdentityEmbedding" USING gin ("tags")
`.trim()
  );
  await prisma.$executeRawUnsafe(
    `
CREATE INDEX IF NOT EXISTS "ReachIdentityEmbedding_embedding_hnsw_idx"
  ON "ReachIdentityEmbedding"
  USING hnsw ("embedding" vector_cosine_ops)
`.trim()
  );
}

async function ensureArrayStorage() {
  await prisma.$executeRawUnsafe(
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
  await prisma.$executeRawUnsafe(
    `
CREATE UNIQUE INDEX IF NOT EXISTS "ReachIdentityEmbeddingArray_source_key"
  ON "ReachIdentityEmbeddingArray"("sourceFile", "sourceId")
`.trim()
  );
  await prisma.$executeRawUnsafe(
    `
CREATE INDEX IF NOT EXISTS "ReachIdentityEmbeddingArray_tags_idx"
  ON "ReachIdentityEmbeddingArray" USING gin ("tags")
`.trim()
  );
}

async function ensureStorage() {
  try {
    await ensurePgvectorStorage();
    return 'pgvector';
  } catch (error) {
    if (!isPgvectorUnavailable(error)) throw error;
    await ensureArrayStorage();
    return 'array';
  }
}

async function embedTexts(contents) {
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
      input: contents,
      dimensions: EMBEDDING_DIMENSIONS,
    }),
  });

  const payload = await response.json();
  if (!response.ok) {
    const message =
      payload?.error?.message ??
      payload?.message ??
      `OpenAI embeddings request failed (${response.status})`;
    throw new Error(message);
  }

  const records = payload?.data;
  if (!Array.isArray(records) || records.length !== contents.length) {
    throw new Error('OpenAI returned an unexpected embedding response');
  }

  const embeddings = [...records]
    .sort((a, b) => Number(a.index ?? 0) - Number(b.index ?? 0))
    .map((record) => record.embedding);

  for (const embedding of embeddings) {
    if (!Array.isArray(embedding)) {
      throw new Error('OpenAI returned no embedding vector');
    }
  }

  return {
    provider: 'openai',
    model: payload.model ?? EMBEDDING_MODEL,
    dimensions: embeddings[0]?.length ?? 0,
    embeddings,
  };
}

async function upsertIdentity(identity, storageMode, embeddingResult, embedding) {
  const embeddingValue = storageMode === 'pgvector' ? serializeVector(embedding) : embedding;
  const tableName =
    storageMode === 'pgvector' ? '"ReachIdentityEmbedding"' : '"ReachIdentityEmbeddingArray"';
  const embeddingCast = storageMode === 'pgvector' ? '$11::vector' : '$11::DOUBLE PRECISION[]';

  await prisma.$executeRawUnsafe(
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

async function seedIdentityBatch(identities, storageMode) {
  const embeddingResult = await embedTexts(identities.map((identity) => identity.content));

  for (let index = 0; index < identities.length; index += 1) {
    const embedding = embeddingResult.embeddings[index];
    if (!embedding) {
      throw new Error(`Missing embedding for ${identities[index]?.name ?? `identity ${index}`}`);
    }
    await upsertIdentity(identities[index], storageMode, embeddingResult, embedding);
  }
}

async function main() {
  const { dir, file } = parseArgs();
  const files = await listIdentityFiles(dir, file);

  if (files.length === 0) {
    throw new Error(`No .txt identity files found in ${dir}`);
  }

  console.log(`Preparing Reach demo identity storage in ${dir}`);
  const storageMode = await ensureStorage();
  console.log(
    `Found ${files.length} identity file${files.length === 1 ? '' : 's'}; storage=${storageMode}.`
  );

  const identities = [];
  for (const file of files) {
    const raw = await fs.readFile(file, 'utf8');
    const parsedIdentities = parseIdentityFile(raw, file);
    const relativeFile = path.relative(process.cwd(), file);

    for (let index = 0; index < parsedIdentities.length; index += 1) {
      const parsed = parsedIdentities[index];
      const isSingleIdentityFile = parsedIdentities.length === 1;
      identities.push({
        ...parsed,
        sourceFile: relativeFile,
        sourceId: isSingleIdentityFile
          ? path.basename(file, '.txt')
          : `${path.basename(file, '.txt')}-${String(index + 1).padStart(4, '0')}`,
      });
    }
  }

  console.log(`Parsed ${identities.length} Reach demo identities.`);

  let seeded = 0;
  for (let start = 0; start < identities.length; start += EMBEDDING_BATCH_SIZE) {
    const batch = identities.slice(start, start + EMBEDDING_BATCH_SIZE);
    console.log(
      `Embedding Reach identities ${start + 1}-${start + batch.length} of ${identities.length}`
    );
    await seedIdentityBatch(batch, storageMode);
    seeded += batch.length;
    console.log(`Seeded ${seeded}/${identities.length} Reach demo identities.`);
  }

  console.log(`Seeded ${seeded} Reach demo ${seeded === 1 ? 'identity' : 'identities'}.`);
}

main()
  .catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
