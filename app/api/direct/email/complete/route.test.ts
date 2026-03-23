import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ZodError, z } from 'zod';

const { completeEmailRequestMock, incrementMock } = vi.hoisted(() => ({
  completeEmailRequestMock: vi.fn(),
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
  completeEmailRequest: completeEmailRequestMock,
}));

vi.mock('../../../../../lib/logger', () => ({
  logger: vi.fn(() => ({ error: vi.fn(), info: vi.fn(), warn: vi.fn() })),
}));

vi.mock('../../../../../lib/error-tracking', () => ({
  captureException: vi.fn(),
}));

vi.mock('../../../../../lib/metrics', () => ({
  increment: incrementMock,
  METRIC: { REQUEST_COMPLETION_CREATED: 'REQUEST_COMPLETION_CREATED' },
}));

import { DirectValidationError } from '../../../../../features/direct/server/requests';
import { POST } from './route';

describe('POST /api/direct/email/complete', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    completeEmailRequestMock.mockResolvedValue({ id: 'req_1', status: 'ACCEPTED' });
  });

  it('completes an email request with extracted ip, turnstile token, and honeypot', async () => {
    const response = await POST(new Request('http://localhost/api/direct/email/complete', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-real-ip': '198.51.100.12',
      },
      body: JSON.stringify({
        token: 'complete_token_12345',
        message: 'Completed request body',
        'cf-turnstile-response': 'turnstile_token',
        _hp_website: '',
      }),
    }));
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload).toMatchObject({ ok: true, request: { id: 'req_1', status: 'ACCEPTED' } });
    expect(completeEmailRequestMock).toHaveBeenCalledWith(
      expect.objectContaining({ token: 'complete_token_12345', message: 'Completed request body' }),
      {
        ipAddress: '198.51.100.12',
        cfTurnstileToken: 'turnstile_token',
        honeypot: '',
      }
    );
    expect(incrementMock).toHaveBeenCalledWith('REQUEST_COMPLETION_CREATED');
  });

  it('returns 400 for invalid completion payloads', async () => {
    completeEmailRequestMock.mockRejectedValue(new ZodError([
      {
        code: z.ZodIssueCode.invalid_type,
        expected: 'string',
        received: 'undefined',
        path: ['token'],
        message: 'Required',
      },
    ]));

    const response = await POST(new Request('http://localhost/api/direct/email/complete', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ message: 'Completed request body' }),
    }));
    const payload = await response.json();

    expect(response.status).toBe(400);
    expect(payload.ok).toBe(false);
    expect(payload.error).toBe('Invalid payload');
    expect(payload.issues).toHaveLength(1);
  });

  it('preserves DirectValidationError status codes at the HTTP layer', async () => {
    completeEmailRequestMock.mockRejectedValue(new DirectValidationError('Invalid or expired completion token', 410));

    const response = await POST(new Request('http://localhost/api/direct/email/complete', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ token: 'complete_token_12345', message: 'Completed request body' }),
    }));
    const payload = await response.json();

    expect(response.status).toBe(410);
    expect(payload).toMatchObject({ ok: false, error: 'Invalid or expired completion token' });
  });
});
