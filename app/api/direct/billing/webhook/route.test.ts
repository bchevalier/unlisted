import { beforeEach, describe, expect, it, vi } from 'vitest';

const { handleStripeWebhookMock } = vi.hoisted(() => ({
  handleStripeWebhookMock: vi.fn(),
}));

vi.mock('../../../../../features/direct/server/billing', () => ({
  BillingError: class BillingError extends Error {
    statusCode: number;
    constructor(message: string, statusCode = 400) {
      super(message);
      this.statusCode = statusCode;
    }
  },
  handleStripeWebhook: handleStripeWebhookMock,
}));

vi.mock('../../../../../lib/logger', () => ({
  logger: vi.fn(() => ({ error: vi.fn(), info: vi.fn(), warn: vi.fn() })),
}));

vi.mock('../../../../../lib/error-tracking', () => ({
  captureException: vi.fn(),
}));

import { BillingError } from '../../../../../features/direct/server/billing';
import { POST } from './route';

describe('POST /api/direct/billing/webhook', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    handleStripeWebhookMock.mockResolvedValue(undefined);
  });

  it('returns 400 when the stripe-signature header is missing', async () => {
    const response = await POST(new Request('http://localhost/api/direct/billing/webhook', {
      method: 'POST',
      body: 'raw-body',
    }));
    const payload = await response.json();

    expect(response.status).toBe(400);
    expect(payload).toMatchObject({ ok: false, error: 'Missing stripe-signature header' });
    expect(handleStripeWebhookMock).not.toHaveBeenCalled();
  });

  it('passes the raw body and signature to the billing webhook handler', async () => {
    const response = await POST(new Request('http://localhost/api/direct/billing/webhook', {
      method: 'POST',
      headers: { 'stripe-signature': 'sig_test_123' },
      body: 'raw-body',
    }));
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload).toMatchObject({ ok: true, received: true });
    expect(handleStripeWebhookMock).toHaveBeenCalledWith(Buffer.from('raw-body'), 'sig_test_123');
  });

  it('preserves BillingError status codes at the HTTP layer', async () => {
    handleStripeWebhookMock.mockRejectedValue(new BillingError('Invalid signature', 400));

    const response = await POST(new Request('http://localhost/api/direct/billing/webhook', {
      method: 'POST',
      headers: { 'stripe-signature': 'sig_test_123' },
      body: 'raw-body',
    }));
    const payload = await response.json();

    expect(response.status).toBe(400);
    expect(payload).toMatchObject({ ok: false, error: 'Invalid signature' });
  });
});
