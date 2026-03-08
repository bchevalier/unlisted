import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { ContractPayload, WebhookPayload } from './router';
import { deliverWebhook } from './router';

// ---------------------------------------------------------------------------
// deliverWebhook (unit tests — no DB, mocked fetch)
// ---------------------------------------------------------------------------

describe('deliverWebhook', () => {
  const mockContract: ContractPayload = {
    contractId: 'contract-1',
    type: 'AI_HUMAN',
    status: 'PROPOSED',
    purpose: 'Request advisory session',
    message: 'I need help with architecture.',
    structuredData: null,
    initiator: { handle: 'bot-alpha', displayName: 'Alpha Bot', type: 'AI_AGENT' },
    target: { handle: 'jane', displayName: 'Jane Doe', type: 'HUMAN' },
    policyAction: 'ROUTE',
    createdAt: '2026-03-09T00:00:00.000Z',
    expiresAt: null,
  };

  let fetchSpy: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.unstubAllEnvs();
    fetchSpy = vi.fn();
    vi.stubGlobal('fetch', fetchSpy);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('returns success on 200 response', async () => {
    fetchSpy.mockResolvedValueOnce({
      ok: true,
      status: 200,
    });

    const result = await deliverWebhook(
      'https://example.com/webhook',
      'contract.routed',
      mockContract,
    );

    expect(result.channel).toBe('webhook');
    expect(result.success).toBe(true);
    expect(result.statusCode).toBe(200);
    expect(result.attempts).toBe(1);

    // Verify fetch was called with correct args.
    expect(fetchSpy).toHaveBeenCalledTimes(1);
    const [url, opts] = fetchSpy.mock.calls[0];
    expect(url).toBe('https://example.com/webhook');
    expect(opts.method).toBe('POST');
    expect(opts.headers['Content-Type']).toBe('application/json');
    expect(opts.headers['X-Knokio-Event']).toBe('contract.routed');

    // Verify payload shape.
    const body: WebhookPayload = JSON.parse(opts.body);
    expect(body.event).toBe('contract.routed');
    expect(body.contract.contractId).toBe('contract-1');
    expect(body.timestamp).toBeTruthy();
  });

  it('returns failure on 400 response without retrying', async () => {
    fetchSpy.mockResolvedValueOnce({
      ok: false,
      status: 400,
      text: vi.fn().mockResolvedValue('Bad request'),
    });

    const result = await deliverWebhook(
      'https://example.com/webhook',
      'contract.routed',
      mockContract,
    );

    expect(result.success).toBe(false);
    expect(result.statusCode).toBe(400);
    expect(result.attempts).toBe(1); // no retry on 4xx
    expect(result.error).toContain('HTTP 400');
  });

  it('retries on 500 response and succeeds on second attempt', async () => {
    fetchSpy
      .mockResolvedValueOnce({ ok: false, status: 500 })
      .mockResolvedValueOnce({ ok: true, status: 200 });

    const result = await deliverWebhook(
      'https://example.com/webhook',
      'contract.routed',
      mockContract,
    );

    expect(result.success).toBe(true);
    expect(result.attempts).toBe(2);
    expect(fetchSpy).toHaveBeenCalledTimes(2);
  });

  it('fails after all retries exhausted on 500', async () => {
    fetchSpy.mockResolvedValue({ ok: false, status: 502 });

    const result = await deliverWebhook(
      'https://example.com/webhook',
      'contract.routed',
      mockContract,
    );

    expect(result.success).toBe(false);
    expect(result.attempts).toBe(3); // 1 initial + 2 retries
    expect(result.error).toContain('Failed after 3 attempts');
  });

  it('retries on network error and eventually fails', async () => {
    fetchSpy.mockRejectedValue(new Error('Connection refused'));

    const result = await deliverWebhook(
      'https://example.com/webhook',
      'contract.routed',
      mockContract,
    );

    expect(result.success).toBe(false);
    expect(result.channel).toBe('webhook');
    expect(result.attempts).toBe(3);
    expect(result.error).toContain('Connection refused');
  });

  it('includes HMAC signature when REACH_WEBHOOK_SECRET is set', async () => {
    vi.stubEnv('REACH_WEBHOOK_SECRET', 'test-secret-key');

    fetchSpy.mockResolvedValueOnce({ ok: true, status: 200 });

    await deliverWebhook(
      'https://example.com/webhook',
      'contract.accepted',
      mockContract,
    );

    const [, opts] = fetchSpy.mock.calls[0];
    expect(opts.headers['X-Knokio-Signature']).toBeTruthy();

    const body: WebhookPayload = JSON.parse(opts.body);
    expect(body.signature).toBeTruthy();
  });

  it('does not include signature when REACH_WEBHOOK_SECRET is not set', async () => {
    fetchSpy.mockResolvedValueOnce({ ok: true, status: 200 });

    await deliverWebhook(
      'https://example.com/webhook',
      'contract.routed',
      mockContract,
    );

    const [, opts] = fetchSpy.mock.calls[0];
    expect(opts.headers['X-Knokio-Signature']).toBeUndefined();
  });

  it('sends correct User-Agent header', async () => {
    fetchSpy.mockResolvedValueOnce({ ok: true, status: 200 });

    await deliverWebhook(
      'https://example.com/webhook',
      'contract.routed',
      mockContract,
    );

    const [, opts] = fetchSpy.mock.calls[0];
    expect(opts.headers['User-Agent']).toBe('Knokio-Reach/1.0');
  });
});

// ---------------------------------------------------------------------------
// policyActionToEvent mapping (tested indirectly via payload)
// ---------------------------------------------------------------------------

describe('webhook event naming', () => {
  let fetchSpy: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    fetchSpy = vi.fn().mockResolvedValue({ ok: true, status: 200 });
    vi.stubGlobal('fetch', fetchSpy);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  const contract: ContractPayload = {
    contractId: 'c-1',
    type: 'HUMAN_HUMAN',
    status: 'ACTIVE',
    purpose: 'test',
    message: null,
    structuredData: null,
    initiator: { handle: 'a', displayName: 'A', type: 'HUMAN' },
    target: { handle: 'b', displayName: 'B', type: 'HUMAN' },
    policyAction: 'ACCEPT',
    createdAt: new Date().toISOString(),
    expiresAt: null,
  };

  it.each([
    ['contract.accepted', 'contract.accepted'],
    ['contract.routed', 'contract.routed'],
    ['contract.escalated', 'contract.escalated'],
  ])('sends event %s in payload', async (event, expected) => {
    await deliverWebhook('https://example.com/hook', event, contract);
    const body: WebhookPayload = JSON.parse(fetchSpy.mock.calls[0][1].body);
    expect(body.event).toBe(expected);
  });
});
