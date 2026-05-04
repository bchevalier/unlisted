-- Reach demo identity vectors for local semantic matching.
CREATE EXTENSION IF NOT EXISTS vector;

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
);

CREATE UNIQUE INDEX IF NOT EXISTS "ReachIdentityEmbedding_source_key"
  ON "ReachIdentityEmbedding"("sourceFile", "sourceId");

CREATE INDEX IF NOT EXISTS "ReachIdentityEmbedding_tags_idx"
  ON "ReachIdentityEmbedding" USING gin ("tags");

CREATE INDEX IF NOT EXISTS "ReachIdentityEmbedding_embedding_hnsw_idx"
  ON "ReachIdentityEmbedding"
  USING hnsw ("embedding" vector_cosine_ops);
