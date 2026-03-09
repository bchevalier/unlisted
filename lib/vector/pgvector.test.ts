import { describe, expect, it, vi } from 'vitest';
import {
  PgvectorError,
  buildDoorEmbeddingSearchQuery,
  createDoorPgvectorAdapter,
  deleteDoorEmbeddingChunksBySource,
  serializeVector,
  upsertDoorEmbeddingChunk,
  type PgvectorExecutor,
} from './pgvector';

function makeExecutor(): PgvectorExecutor {
  return {
    query: vi.fn(),
    execute: vi.fn(),
  };
}

describe('serializeVector', () => {
  it('serializes valid vectors to pgvector literal', () => {
    expect(serializeVector([0.1, -0.2, 3])).toBe('[0.1,-0.2,3]');
  });

  it('rejects empty vectors', () => {
    expect(() => serializeVector([])).toThrow(PgvectorError);
  });

  it('rejects non-finite vector values', () => {
    expect(() => serializeVector([1, Number.NaN])).toThrow(PgvectorError);
    expect(() => serializeVector([1, Number.POSITIVE_INFINITY])).toThrow(PgvectorError);
  });
});

describe('buildDoorEmbeddingSearchQuery', () => {
  it('builds SQL with optional filters and stable parameter ordering', () => {
    const built = buildDoorEmbeddingSearchQuery({
      vectorLiteral: '[0.1,0.2]',
      doorId: 'door_1',
      topK: 5,
      sourceType: 'REQUEST',
      sourceId: 'req_1',
      minScore: 0.7,
    });

    expect(built.sql).toContain('FROM "DoorEmbeddingChunk"');
    expect(built.sql).toContain('ORDER BY embedding <=> $1::vector');
    expect(built.sql).toContain('"doorId" = $2');
    expect(built.sql).toContain('"sourceType" = $3');
    expect(built.sql).toContain('"sourceId" = $4');
    expect(built.sql).toContain('>= $5');
    expect(built.sql).toContain('LIMIT $6');
    expect(built.params).toEqual(['[0.1,0.2]', 'door_1', 'REQUEST', 'req_1', 0.7, 5]);
  });
});

describe('createDoorPgvectorAdapter', () => {
  it('searches and maps rows into retrieval hits', async () => {
    const executor = makeExecutor();
    (executor.query as ReturnType<typeof vi.fn>).mockResolvedValue([
      {
        id: 'chunk_1',
        doorId: 'door_1',
        sourceType: 'REQUEST',
        sourceId: 'req_1',
        chunkIndex: 0,
        content: 'hello',
        metadata: { lane: 'direct' },
        score: '0.88',
      },
    ]);

    const adapter = createDoorPgvectorAdapter({ doorId: 'door_1', executor });

    const hits = await adapter.search({
      query: 'hello',
      queryEmbedding: [0.1, 0.2],
      topK: 3,
    });

    expect(hits).toHaveLength(1);
    expect(hits[0]).toMatchObject({
      id: 'chunk_1',
      score: 0.88,
      content: 'hello',
    });
    expect(hits[0]?.metadata).toMatchObject({
      lane: 'direct',
      doorId: 'door_1',
      sourceType: 'REQUEST',
      sourceId: 'req_1',
      chunkIndex: 0,
    });
  });

  it('requires a doorId either in adapter options or filters', async () => {
    const executor = makeExecutor();
    (executor.query as ReturnType<typeof vi.fn>).mockResolvedValue([]);

    const adapter = createDoorPgvectorAdapter({ executor });

    await expect(
      adapter.search({
        query: 'hello',
        queryEmbedding: [0.1],
        topK: 1,
      }),
    ).rejects.toBeInstanceOf(PgvectorError);
  });

  it('uses filter doorId when provided', async () => {
    const executor = makeExecutor();
    (executor.query as ReturnType<typeof vi.fn>).mockResolvedValue([]);

    const adapter = createDoorPgvectorAdapter({ executor });

    await adapter.search({
      query: 'hello',
      queryEmbedding: [0.1],
      topK: 2,
      filters: { doorId: 'door_dynamic' },
    });

    expect(executor.query).toHaveBeenCalledTimes(1);
    const [, params] = (executor.query as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(params).toContain('door_dynamic');
  });
});

describe('upsert/delete helpers', () => {
  it('upserts a chunk with vector cast parameter', async () => {
    const executor = makeExecutor();
    (executor.execute as ReturnType<typeof vi.fn>).mockResolvedValue(1);

    await upsertDoorEmbeddingChunk(
      {
        doorId: 'door_1',
        sourceType: 'REQUEST',
        sourceId: 'req_1',
        chunkIndex: 0,
        content: 'chunk text',
        metadata: { tokenCount: 42 },
        embedding: [0.1, 0.2, 0.3],
      },
      { executor },
    );

    const [sql, params] = (executor.execute as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(sql).toContain('$7::vector');
    expect(params[6]).toBe('[0.1,0.2,0.3]');
  });

  it('deletes chunks by source', async () => {
    const executor = makeExecutor();
    (executor.execute as ReturnType<typeof vi.fn>).mockResolvedValue(3);

    const deleted = await deleteDoorEmbeddingChunksBySource(
      {
        doorId: 'door_1',
        sourceType: 'REQUEST',
        sourceId: 'req_1',
      },
      { executor },
    );

    expect(deleted).toBe(3);
    expect(executor.execute).toHaveBeenCalledTimes(1);
  });
});
