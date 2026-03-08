import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// ---------------------------------------------------------------------------
// Mock db before importing module — must use hoisted refs
// ---------------------------------------------------------------------------

const mockFns = vi.hoisted(() => ({
  reachWebhook: {
    findMany: vi.fn(),
    findUnique: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    count: vi.fn(),
  },
  reachWebhookDelivery: {
    create: vi.fn(),
    update: vi.fn(),
    findMany: vi.fn(),
    findUnique: vi.fn(),
  },
  reachActor: {
    findUnique: vi.fn(),
  },
  reachContract: {
    findUnique: vi.fn(),
  },
}));

vi.mock('../db', () => ({ db: mockFns }));

// Import after mocking
import {
  createWebhook,
  listWebhooks,
  updateWebhook,
  deleteWebhook,
  rotateWebhookSecret,
  dispatchWebhookEvent,
  listDeliveries,
  pingWebhook,
  retryDelivery,
  getWebhookHealthStats,
} from './webhooks';

// ---------------------------------------------------------------------------
// Tests: CRUD
// ---------------------------------------------------------------------------

describe('createWebhook', () => {
  beforeEach(() => vi.clearAllMocks());

  it('creates a webhook with a signing secret', async () => {
    mockFns.reachActor.findUnique.mockResolvedValue({ id: 'actor-1', isActive: true });
    mockFns.reachWebhook.count.mockResolvedValue(0);
    mockFns.reachWebhook.create.mockResolvedValue({
      id: 'wh-1',
      actorId: 'actor-1',
      url: 'https://example.com/webhook',
      events: [],
      description: null,
      isActive: true,
    });

    const result = await createWebhook('actor-1', {
      url: 'https://example.com/webhook',
    });

    expect(result.webhook.id).toBe('wh-1');
    expect(result.secret).toMatch(/^whsec_/);
    expect(mockFns.reachWebhook.create).toHaveBeenCalledOnce();

    // Verify secretHash is passed (SHA-256 of the secret).
    const createCall = mockFns.reachWebhook.create.mock.calls[0][0];
    expect(createCall.data.secretHash).toBeDefined();
    expect(createCall.data.secretHash.length).toBe(64); // hex SHA-256
  });

  it('rejects when actor not found', async () => {
    mockFns.reachActor.findUnique.mockResolvedValue(null);

    await expect(createWebhook('missing', { url: 'https://example.com/hook' }))
      .rejects.toThrow('Actor not found');
  });

  it('rejects when actor is inactive', async () => {
    mockFns.reachActor.findUnique.mockResolvedValue({ id: 'actor-1', isActive: false });

    await expect(createWebhook('actor-1', { url: 'https://example.com/hook' }))
      .rejects.toThrow('Actor is inactive');
  });

  it('enforces max webhooks per actor', async () => {
    mockFns.reachActor.findUnique.mockResolvedValue({ id: 'actor-1', isActive: true });
    mockFns.reachWebhook.count.mockResolvedValue(10);

    await expect(createWebhook('actor-1', { url: 'https://example.com/hook' }))
      .rejects.toThrow('Maximum');
  });

  it('validates URL format', async () => {
    mockFns.reachActor.findUnique.mockResolvedValue({ id: 'actor-1', isActive: true });
    mockFns.reachWebhook.count.mockResolvedValue(0);

    await expect(createWebhook('actor-1', { url: 'not-a-url' }))
      .rejects.toThrow();
  });
});

describe('listWebhooks', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns active webhooks by default', async () => {
    mockFns.reachWebhook.findMany.mockResolvedValue([
      { id: 'wh-1', url: 'https://example.com/hook', events: [], isActive: true },
    ]);

    const result = await listWebhooks('actor-1');
    expect(result).toHaveLength(1);
    expect(mockFns.reachWebhook.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { actorId: 'actor-1', isActive: true },
      }),
    );
  });

  it('includes inactive when requested', async () => {
    mockFns.reachWebhook.findMany.mockResolvedValue([]);

    await listWebhooks('actor-1', true);
    expect(mockFns.reachWebhook.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { actorId: 'actor-1' },
      }),
    );
  });
});

describe('updateWebhook', () => {
  beforeEach(() => vi.clearAllMocks());

  it('updates webhook fields', async () => {
    mockFns.reachWebhook.findUnique.mockResolvedValue({ id: 'wh-1' });
    mockFns.reachWebhook.update.mockResolvedValue({
      id: 'wh-1',
      url: 'https://new-url.com/hook',
      events: ['ACCEPTED'],
      isActive: true,
    });

    const result = await updateWebhook('wh-1', {
      url: 'https://new-url.com/hook',
      events: ['ACCEPTED'],
    });

    expect(result.url).toBe('https://new-url.com/hook');
  });

  it('rejects when webhook not found', async () => {
    mockFns.reachWebhook.findUnique.mockResolvedValue(null);

    await expect(updateWebhook('missing', { url: 'https://example.com' }))
      .rejects.toThrow('Webhook not found');
  });
});

describe('deleteWebhook', () => {
  beforeEach(() => vi.clearAllMocks());

  it('deletes an existing webhook', async () => {
    mockFns.reachWebhook.findUnique.mockResolvedValue({ id: 'wh-1' });
    mockFns.reachWebhook.delete.mockResolvedValue({});

    const result = await deleteWebhook('wh-1');
    expect(result.deleted).toBe(true);
  });

  it('rejects when not found', async () => {
    mockFns.reachWebhook.findUnique.mockResolvedValue(null);

    await expect(deleteWebhook('missing')).rejects.toThrow('Webhook not found');
  });
});

describe('rotateWebhookSecret', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns a new secret', async () => {
    mockFns.reachWebhook.findUnique.mockResolvedValue({ id: 'wh-1' });
    mockFns.reachWebhook.update.mockResolvedValue({});

    const result = await rotateWebhookSecret('wh-1');
    expect(result.secret).toMatch(/^whsec_/);
  });
});

// ---------------------------------------------------------------------------
// Tests: Lifecycle event dispatcher
// ---------------------------------------------------------------------------

describe('dispatchWebhookEvent', () => {
  let originalFetch: typeof globalThis.fetch;

  beforeEach(() => {
    vi.clearAllMocks();
    originalFetch = globalThis.fetch;
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it('does nothing when no webhooks exist', async () => {
    mockFns.reachWebhook.findMany.mockResolvedValue([]);

    await dispatchWebhookEvent('contract-1', 'ACCEPTED', 'actor-1');

    expect(mockFns.reachContract.findUnique).not.toHaveBeenCalled();
  });

  it('filters webhooks by event type', async () => {
    // Webhook only subscribes to ACCEPTED events.
    mockFns.reachWebhook.findMany.mockResolvedValue([
      { id: 'wh-1', url: 'https://example.com/hook', secretHash: null, events: ['ACCEPTED'] },
    ]);

    // Dispatch a REJECTED event — should not match.
    await dispatchWebhookEvent('contract-1', 'REJECTED', 'actor-1');

    // Contract should NOT be loaded since no webhooks match.
    expect(mockFns.reachContract.findUnique).not.toHaveBeenCalled();
  });

  it('delivers to matching webhooks', async () => {
    mockFns.reachWebhook.findMany.mockResolvedValue([
      { id: 'wh-1', url: 'https://example.com/hook', secretHash: 'abc123', events: [] },
    ]);

    mockFns.reachContract.findUnique.mockResolvedValue({
      id: 'contract-1',
      type: 'HUMAN_HUMAN',
      status: 'ACTIVE',
      purpose: 'Test',
      message: null,
      initiator: { handle: 'alice', displayName: 'Alice', type: 'HUMAN' },
      target: { handle: 'bob', displayName: 'Bob', type: 'HUMAN' },
      events: [{ type: 'ACCEPTED', actor: 'TARGET', note: null }],
    });

    mockFns.reachWebhookDelivery.create.mockResolvedValue({ id: 'del-1' });
    mockFns.reachWebhookDelivery.update.mockResolvedValue({});

    // Mock fetch to succeed.
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
    }) as unknown as typeof fetch;

    await dispatchWebhookEvent('contract-1', 'ACCEPTED', 'actor-1');

    expect(globalThis.fetch).toHaveBeenCalledOnce();
    const fetchCall = (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(fetchCall[0]).toBe('https://example.com/hook');
    expect(fetchCall[1].headers['X-Knokio-Event']).toBe('contract.accepted');
    expect(fetchCall[1].headers['X-Knokio-Webhook-Id']).toBe('wh-1');

    // Delivery should be recorded as success.
    expect(mockFns.reachWebhookDelivery.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: 'success' }),
      }),
    );
  });

  it('records failed delivery on 4xx', async () => {
    mockFns.reachWebhook.findMany.mockResolvedValue([
      { id: 'wh-1', url: 'https://example.com/hook', secretHash: null, events: [] },
    ]);

    mockFns.reachContract.findUnique.mockResolvedValue({
      id: 'contract-1',
      type: 'AI_HUMAN',
      status: 'PROPOSED',
      purpose: 'Test',
      message: null,
      initiator: { handle: 'bot', displayName: 'Bot', type: 'AI_AGENT' },
      target: { handle: 'bob', displayName: 'Bob', type: 'HUMAN' },
      events: [{ type: 'CREATED', actor: 'SYSTEM', note: null }],
    });

    mockFns.reachWebhookDelivery.create.mockResolvedValue({ id: 'del-1' });
    mockFns.reachWebhookDelivery.update.mockResolvedValue({});

    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 404,
      text: async () => 'Not Found',
    }) as unknown as typeof fetch;

    await dispatchWebhookEvent('contract-1', 'CREATED', 'actor-1');

    expect(mockFns.reachWebhookDelivery.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: 'failed' }),
      }),
    );
  });

  it('includes HMAC signature when webhook has secretHash', async () => {
    mockFns.reachWebhook.findMany.mockResolvedValue([
      { id: 'wh-1', url: 'https://example.com/hook', secretHash: 'mysecret', events: [] },
    ]);

    mockFns.reachContract.findUnique.mockResolvedValue({
      id: 'contract-1',
      type: 'HUMAN_HUMAN',
      status: 'ACTIVE',
      purpose: 'Test',
      message: null,
      initiator: { handle: 'alice', displayName: 'Alice', type: 'HUMAN' },
      target: { handle: 'bob', displayName: 'Bob', type: 'HUMAN' },
      events: [{ type: 'ACCEPTED', actor: 'TARGET', note: null }],
    });

    mockFns.reachWebhookDelivery.create.mockResolvedValue({ id: 'del-1' });
    mockFns.reachWebhookDelivery.update.mockResolvedValue({});

    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
    }) as unknown as typeof fetch;

    await dispatchWebhookEvent('contract-1', 'ACCEPTED', 'actor-1');

    const fetchCall = (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(fetchCall[1].headers['X-Knokio-Signature']).toBeDefined();
  });
});

// ---------------------------------------------------------------------------
// Tests: Ping
// ---------------------------------------------------------------------------

describe('pingWebhook', () => {
  let originalFetch: typeof globalThis.fetch;

  beforeEach(() => {
    vi.clearAllMocks();
    originalFetch = globalThis.fetch;
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it('returns success on 200 response', async () => {
    mockFns.reachWebhook.findUnique.mockResolvedValue({
      id: 'wh-1',
      url: 'https://example.com/hook',
      secretHash: null,
      isActive: true,
    });

    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
    }) as unknown as typeof fetch;

    const result = await pingWebhook('wh-1');
    expect(result.success).toBe(true);
    expect(result.statusCode).toBe(200);
    expect(result.latencyMs).toBeGreaterThanOrEqual(0);

    const fetchCall = (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(fetchCall[1].headers['X-Knokio-Event']).toBe('ping');
  });

  it('returns failure on non-2xx response', async () => {
    mockFns.reachWebhook.findUnique.mockResolvedValue({
      id: 'wh-1',
      url: 'https://example.com/hook',
      secretHash: null,
      isActive: true,
    });

    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 503,
    }) as unknown as typeof fetch;

    const result = await pingWebhook('wh-1');
    expect(result.success).toBe(false);
    expect(result.statusCode).toBe(503);
    expect(result.error).toBe('HTTP 503');
  });

  it('returns failure on network error', async () => {
    mockFns.reachWebhook.findUnique.mockResolvedValue({
      id: 'wh-1',
      url: 'https://example.com/hook',
      secretHash: null,
      isActive: true,
    });

    globalThis.fetch = vi.fn().mockRejectedValue(
      new Error('Connection refused'),
    ) as unknown as typeof fetch;

    const result = await pingWebhook('wh-1');
    expect(result.success).toBe(false);
    expect(result.error).toBe('Connection refused');
    expect(result.latencyMs).toBeGreaterThanOrEqual(0);
  });

  it('includes HMAC signature when webhook has secretHash', async () => {
    mockFns.reachWebhook.findUnique.mockResolvedValue({
      id: 'wh-1',
      url: 'https://example.com/hook',
      secretHash: 'mysecret',
      isActive: true,
    });

    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
    }) as unknown as typeof fetch;

    await pingWebhook('wh-1');

    const fetchCall = (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(fetchCall[1].headers['X-Knokio-Signature']).toBeDefined();
  });

  it('throws when webhook not found', async () => {
    mockFns.reachWebhook.findUnique.mockResolvedValue(null);

    await expect(pingWebhook('missing')).rejects.toThrow('Webhook not found');
  });
});

describe('listDeliveries', () => {
  beforeEach(() => vi.clearAllMocks());

  it('queries deliveries for a webhook', async () => {
    mockFns.reachWebhookDelivery.findMany.mockResolvedValue([]);

    await listDeliveries('wh-1', 10, 0);

    expect(mockFns.reachWebhookDelivery.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { webhookId: 'wh-1' },
        take: 10,
        skip: 0,
      }),
    );
  });
});

// ---------------------------------------------------------------------------
// Tests: Delivery retry
// ---------------------------------------------------------------------------

describe('retryDelivery', () => {
  let originalFetch: typeof globalThis.fetch;

  beforeEach(() => {
    vi.clearAllMocks();
    originalFetch = globalThis.fetch;
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it('retries a failed delivery and succeeds', async () => {
    mockFns.reachWebhookDelivery.findUnique.mockResolvedValue({
      id: 'del-1',
      webhookId: 'wh-1',
      contractId: 'contract-1',
      event: 'ACCEPTED',
      status: 'failed',
      payload: { event: 'contract.accepted', contractId: 'contract-1' },
    });

    mockFns.reachWebhook.findUnique.mockResolvedValue({
      id: 'wh-1',
      url: 'https://example.com/hook',
      secretHash: null,
      isActive: true,
    });

    mockFns.reachWebhookDelivery.create.mockResolvedValue({ id: 'del-retry-1' });
    mockFns.reachWebhookDelivery.update.mockResolvedValue({});

    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
    }) as unknown as typeof fetch;

    const result = await retryDelivery('del-1');

    expect(result.success).toBe(true);
    expect(result.newDeliveryId).toBe('del-retry-1');
    expect(result.httpStatus).toBe(200);
    expect(globalThis.fetch).toHaveBeenCalledOnce();

    // Verify retry header is sent.
    const fetchCall = (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(fetchCall[1].headers['X-Knokio-Retry-Of']).toBe('del-1');
  });

  it('rejects when delivery not found', async () => {
    mockFns.reachWebhookDelivery.findUnique.mockResolvedValue(null);

    await expect(retryDelivery('missing')).rejects.toThrow('Delivery not found');
  });

  it('rejects when delivery already succeeded', async () => {
    mockFns.reachWebhookDelivery.findUnique.mockResolvedValue({
      id: 'del-1',
      webhookId: 'wh-1',
      contractId: 'contract-1',
      event: 'ACCEPTED',
      status: 'success',
      payload: {},
    });

    await expect(retryDelivery('del-1')).rejects.toThrow('already succeeded');
  });

  it('rejects when webhook is inactive', async () => {
    mockFns.reachWebhookDelivery.findUnique.mockResolvedValue({
      id: 'del-1',
      webhookId: 'wh-1',
      contractId: 'contract-1',
      event: 'ACCEPTED',
      status: 'failed',
      payload: {},
    });

    mockFns.reachWebhook.findUnique.mockResolvedValue({
      id: 'wh-1',
      url: 'https://example.com/hook',
      secretHash: null,
      isActive: false,
    });

    await expect(retryDelivery('del-1')).rejects.toThrow('inactive');
  });

  it('rebuilds payload from contract when stored payload is empty', async () => {
    mockFns.reachWebhookDelivery.findUnique.mockResolvedValue({
      id: 'del-1',
      webhookId: 'wh-1',
      contractId: 'contract-1',
      event: 'ACCEPTED',
      status: 'failed',
      payload: {},
    });

    mockFns.reachWebhook.findUnique.mockResolvedValue({
      id: 'wh-1',
      url: 'https://example.com/hook',
      secretHash: null,
      isActive: true,
    });

    mockFns.reachContract.findUnique.mockResolvedValue({
      id: 'contract-1',
      type: 'HUMAN_HUMAN',
      status: 'ACTIVE',
      purpose: 'Test',
      message: null,
      initiator: { handle: 'alice', displayName: 'Alice', type: 'HUMAN' },
      target: { handle: 'bob', displayName: 'Bob', type: 'HUMAN' },
      events: [{ type: 'ACCEPTED', actor: 'TARGET', note: null }],
    });

    mockFns.reachWebhookDelivery.create.mockResolvedValue({ id: 'del-retry-1' });
    mockFns.reachWebhookDelivery.update.mockResolvedValue({});

    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
    }) as unknown as typeof fetch;

    const result = await retryDelivery('del-1');
    expect(result.success).toBe(true);

    // Payload should have been rebuilt from contract.
    const fetchCall = (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls[0];
    const body = JSON.parse(fetchCall[1].body);
    expect(body.contractId).toBe('contract-1');
    expect(body.event).toBe('contract.accepted');
  });

  it('records failure on retry when endpoint returns 500', async () => {
    mockFns.reachWebhookDelivery.findUnique.mockResolvedValue({
      id: 'del-1',
      webhookId: 'wh-1',
      contractId: 'contract-1',
      event: 'CREATED',
      status: 'failed',
      payload: { event: 'contract.created', contractId: 'contract-1' },
    });

    mockFns.reachWebhook.findUnique.mockResolvedValue({
      id: 'wh-1',
      url: 'https://example.com/hook',
      secretHash: null,
      isActive: true,
    });

    mockFns.reachWebhookDelivery.create.mockResolvedValue({ id: 'del-retry-1' });
    mockFns.reachWebhookDelivery.update.mockResolvedValue({});

    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 502,
    }) as unknown as typeof fetch;

    const result = await retryDelivery('del-1');
    expect(result.success).toBe(false);
    expect(result.error).toContain('502');

    // Delivery record should be updated as failed.
    expect(mockFns.reachWebhookDelivery.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: 'failed' }),
      }),
    );
  });
});

// ---------------------------------------------------------------------------
// Tests: Webhook health stats
// ---------------------------------------------------------------------------

describe('getWebhookHealthStats', () => {
  beforeEach(() => vi.clearAllMocks());

  it('computes correct stats from delivery records', async () => {
    const now = new Date();
    const recent = new Date(now.getTime() - 1000 * 60 * 60); // 1 hour ago

    mockFns.reachWebhookDelivery.findMany.mockResolvedValue([
      { status: 'success', attempts: 1, deliveredAt: recent, createdAt: recent },
      { status: 'success', attempts: 1, deliveredAt: recent, createdAt: recent },
      { status: 'failed', attempts: 3, deliveredAt: null, createdAt: recent },
      { status: 'success', attempts: 2, deliveredAt: recent, createdAt: recent },
      { status: 'pending', attempts: 0, deliveredAt: null, createdAt: now },
    ]);

    const stats = await getWebhookHealthStats('wh-1', 7);

    expect(stats.webhookId).toBe('wh-1');
    expect(stats.totalDeliveries).toBe(5);
    expect(stats.successCount).toBe(3);
    expect(stats.failedCount).toBe(1);
    expect(stats.pendingCount).toBe(1);
    expect(stats.successRate).toBe(0.75); // 3 / (3+1)
    expect(stats.avgAttempts).toBe(7 / 5); // (1+1+3+2+0) / 5
    expect(stats.lastDeliveryAt).toBeTruthy();
    expect(stats.lastSuccessAt).toBeTruthy();
    expect(stats.lastFailureAt).toBeTruthy();
  });

  it('returns zero stats when no deliveries exist', async () => {
    mockFns.reachWebhookDelivery.findMany.mockResolvedValue([]);

    const stats = await getWebhookHealthStats('wh-1');

    expect(stats.totalDeliveries).toBe(0);
    expect(stats.successCount).toBe(0);
    expect(stats.failedCount).toBe(0);
    expect(stats.successRate).toBe(0);
    expect(stats.lastDeliveryAt).toBeNull();
    expect(stats.lastSuccessAt).toBeNull();
    expect(stats.lastFailureAt).toBeNull();
  });

  it('returns 100% success rate when all deliveries succeed', async () => {
    const recent = new Date();
    mockFns.reachWebhookDelivery.findMany.mockResolvedValue([
      { status: 'success', attempts: 1, deliveredAt: recent, createdAt: recent },
      { status: 'success', attempts: 1, deliveredAt: recent, createdAt: recent },
    ]);

    const stats = await getWebhookHealthStats('wh-1');
    expect(stats.successRate).toBe(1);
    expect(stats.lastFailureAt).toBeNull();
  });
});
