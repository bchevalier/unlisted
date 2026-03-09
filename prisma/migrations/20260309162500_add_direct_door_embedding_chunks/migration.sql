-- Enable pgvector extension for semantic retrieval.
CREATE EXTENSION IF NOT EXISTS vector;

-- Embedding chunks scoped to Direct doors.
CREATE TABLE IF NOT EXISTS "DoorEmbeddingChunk" (
  "id" TEXT NOT NULL,
  "doorId" TEXT NOT NULL,
  "sourceType" TEXT NOT NULL,
  "sourceId" TEXT NOT NULL,
  "chunkIndex" INTEGER NOT NULL,
  "content" TEXT NOT NULL,
  "metadata" JSONB,
  "embedding" vector(1536) NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "DoorEmbeddingChunk_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "DoorEmbeddingChunk_doorId_fkey" FOREIGN KEY ("doorId") REFERENCES "Door"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- Keep one row per source chunk inside a door.
CREATE UNIQUE INDEX IF NOT EXISTS "DoorEmbeddingChunk_door_source_chunk_key"
  ON "DoorEmbeddingChunk"("doorId", "sourceType", "sourceId", "chunkIndex");

-- Fast metadata scoping before vector search.
CREATE INDEX IF NOT EXISTS "DoorEmbeddingChunk_door_source_idx"
  ON "DoorEmbeddingChunk"("doorId", "sourceType", "sourceId");

-- ANN index for cosine similarity retrieval.
CREATE INDEX IF NOT EXISTS "DoorEmbeddingChunk_embedding_hnsw_idx"
  ON "DoorEmbeddingChunk"
  USING hnsw ("embedding" vector_cosine_ops);
