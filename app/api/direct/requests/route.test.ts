import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ZodError, z } from 'zod';

const { createFormRequestMock, incrementMock } = vi.hoisted(() => ({
  createFormRequestMock: vi.fn(),
  incrementMock: vi.fn(),
}));

vi.mock('../../../../features/direct/server/requests', () => ({
  DirectValidationError: class DirectValidationError extends Error {
    statusCode: number;
    constructor(message: string, statusCode = 400) {
      super(message);
      this.statusCode = statusCode;
    }
  },
  createFormRequest: createFormRequestMock,
}));

vi.mock('../../../../lib/logger', () => ({
  logger: vi.fn(() => ({ error: vi.fn(), info: vi.fn(), warn: vi.fn() })),
}));

vi.mock('../../../../lib/error-tracking', () => ({
  captureException: vi.fn(),
}));

vi.mock('../../../../lib/metrics', () => ({
  increment: incrementMock,
  METRIC: { REQUEST_FORM_CREATED: 'REQUEST_FORM_CREATED' },
}));

import { DirectValidationError } from '../../../../features/direct/server/requests';
import { POST } from './route';

describe('POST /api/direct/requests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    createFormRequestMock.mockResolvedValue({ id: 'req_1', status: 'PENDING' });
  });

  it('creates a public form request with extracted ip, turnstile token, and honeypot', async () => {
    const response = await POST(new Request('http://localhost/api/direct/requests', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-forwarded-for': '203.0.113.10, 10.0.0.1',
      },
      body: JSON.stringify({
        doorSlug: 'john',
        categoryKey: 'brand-deals',
        message: 'Hello',
        senderEmail: 'maya@example.com',
        'cf-turnstile-response': 'turnstile_token',
        _hp_website: '',
      }),
    }));
    const payload = await response.json();

    expect(response.status).toBe(201);
    expect(payload).toMatchObject({ ok: true, request: { id: 'req_1', status: 'PENDING' } });
    expect(createFormRequestMock).toHaveBeenCalledWith(
      expect.objectContaining({ doorSlug: 'john', categoryKey: 'brand-deals' }),
      {
        ipAddress: '203.0.113.10',
        cfTurnstileToken: 'turnstile_token',
        honeypot: '',
      }
    );
    expect(incrementMock).toHaveBeenCalledWith('REQUEST_FORM_CREATED');
  });

  it('returns 400 for invalid payloads', async () => {
    createFormRequestMock.mockRejectedValue(new ZodError([
      {
        code: z.ZodIssueCode.invalid_type,
        expected: 'string',
        received: 'undefined',
        path: ['doorSlug'],
        message: 'Required',
      },
    ]));

    const response = await POST(new Request('http://localhost/api/direct/requests', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ message: 'Hello' }),
    }));
    const payload = await response.json();

    expect(response.status).toBe(400);
    expect(payload.ok).toBe(false);
    expect(payload.error).toBe('Invalid payload');
    expect(payload.issues).toHaveLength(1);
  });

  it('preserves DirectValidationError status codes at the HTTP layer', async () => {
    createFormRequestMock.mockRejectedValue(new DirectValidationError('Unable to submit request at this time.', 403));

    const response = await POST(new Request('http://localhost/api/direct/requests', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ doorSlug: 'john', message: 'Hello' }),
    }));
    const payload = await response.json();

    expect(response.status).toBe(403);
    expect(payload).toMatchObject({ ok: false, error: 'Unable to submit request at this time.' });
  });
});
