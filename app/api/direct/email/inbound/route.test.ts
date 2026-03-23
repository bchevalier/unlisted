import { beforeEach, describe, expect, it, vi, afterAll } from 'vitest';
import { ZodError, z } from 'zod';

const { createEmailRequestMock, incrementMock } = vi.hoisted(() => ({
  createEmailRequestMock: vi.fn(),
  incrementMock: vi.fn(),
}));

vi.mock('../../../../../features/direct/server/requests', () => ({
  DirectValidationError: class DirectValidationError extends Error {
    statusCode: number;
    constructor(message: string, statusCode = 400) {
      super(message);
      this.statusCode = statusCode;
    }
  },
  createEmailRequest: createEmailRequestMock,
}));

vi.mock('../../../../../lib/logger', () => ({
  logger: vi.fn(() => ({ error: vi.fn(), info: vi.fn(), warn: vi.fn() })),
}));

vi.mock('../../../../../lib/error-tracking', () => ({
  captureException: vi.fn(),
}));

vi.mock('../../../../../lib/metrics', () => ({
  increment: incrementMock,
  METRIC: {
    EMAIL_INBOUND_RECEIVED: 'EMAIL_INBOUND_RECEIVED',
    EMAIL_INBOUND_REJECTED: 'EMAIL_INBOUND_REJECTED',
  },
}));

import { DirectValidationError } from '../../../../../features/direct/server/requests';
import { POST } from './route';

const originalInboundSecret = process.env.INBOUND_EMAIL_WEBHOOK_SECRET;

describe('POST /api/direct/email/inbound', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    delete process.env.INBOUND_EMAIL_WEBHOOK_SECRET;
    createEmailRequestMock.mockResolvedValue({ id: 'req_email_1', status: 'PENDING' });
  });

  afterAll(() => {
    if (originalInboundSecret === undefined) {
      delete process.env.INBOUND_EMAIL_WEBHOOK_SECRET;
    } else {
      process.env.INBOUND_EMAIL_WEBHOOK_SECRET = originalInboundSecret;
    }
  });

  it('accepts inbound email when no webhook secret is configured', async () => {
    const response = await POST(new Request('http://localhost/api/direct/email/inbound', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ alias: 'john', subject: 'Hello' }),
    }));
    const payload = await response.json();

    expect(response.status).toBe(201);
    expect(payload).toMatchObject({ ok: true, request: { id: 'req_email_1', status: 'PENDING' } });
    expect(createEmailRequestMock).toHaveBeenCalledWith({ alias: 'john', subject: 'Hello' });
    expect(incrementMock).toHaveBeenCalledWith('EMAIL_INBOUND_RECEIVED');
  });

  it('returns 401 when the inbound webhook secret is missing or wrong', async () => {
    process.env.INBOUND_EMAIL_WEBHOOK_SECRET = 'inbound-secret-123';

    const response = await POST(new Request('http://localhost/api/direct/email/inbound', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ alias: 'john', subject: 'Hello' }),
    }));
    const payload = await response.json();

    expect(response.status).toBe(401);
    expect(payload).toMatchObject({ ok: false, error: 'Unauthorized inbound webhook' });
    expect(createEmailRequestMock).not.toHaveBeenCalled();
    expect(incrementMock).toHaveBeenCalledWith('EMAIL_INBOUND_REJECTED');
  });

  it('accepts authorized inbound email with a matching webhook secret', async () => {
    process.env.INBOUND_EMAIL_WEBHOOK_SECRET = 'inbound-secret-123';

    const response = await POST(new Request('http://localhost/api/direct/email/inbound', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-knokio-inbound-secret': 'inbound-secret-123',
      },
      body: JSON.stringify({ alias: 'john', subject: 'Hello' }),
    }));
    const payload = await response.json();

    expect(response.status).toBe(201);
    expect(payload).toMatchObject({ ok: true, request: { id: 'req_email_1' } });
  });

  it('returns 400 for invalid inbound payloads', async () => {
    createEmailRequestMock.mockRejectedValue(new ZodError([
      {
        code: z.ZodIssueCode.invalid_type,
        expected: 'string',
        received: 'undefined',
        path: ['alias'],
        message: 'Required',
      },
    ]));

    const response = await POST(new Request('http://localhost/api/direct/email/inbound', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ subject: 'Hello' }),
    }));
    const payload = await response.json();

    expect(response.status).toBe(400);
    expect(payload.ok).toBe(false);
    expect(payload.error).toBe('Invalid payload');
    expect(payload.issues).toHaveLength(1);
    expect(incrementMock).toHaveBeenCalledWith('EMAIL_INBOUND_REJECTED');
  });

  it('preserves DirectValidationError status codes at the HTTP layer', async () => {
    createEmailRequestMock.mockRejectedValue(new DirectValidationError('Alias not found', 404));

    const response = await POST(new Request('http://localhost/api/direct/email/inbound', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ alias: 'john', subject: 'Hello' }),
    }));
    const payload = await response.json();

    expect(response.status).toBe(404);
    expect(payload).toMatchObject({ ok: false, error: 'Alias not found' });
    expect(incrementMock).toHaveBeenCalledWith('EMAIL_INBOUND_REJECTED');
  });
});
