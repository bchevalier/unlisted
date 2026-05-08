import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ZodError, z } from 'zod';

const { createAbuseReportMock } = vi.hoisted(() => ({
  createAbuseReportMock: vi.fn(),
}));

vi.mock('../../../../features/direct/server/abuse-reports', () => ({
  AbuseReportError: class AbuseReportError extends Error {
    statusCode: number;
    constructor(message: string, statusCode = 400) {
      super(message);
      this.statusCode = statusCode;
    }
  },
  createAbuseReport: createAbuseReportMock,
}));

vi.mock('../../../../lib/logger', () => ({
  logger: vi.fn(() => ({ error: vi.fn(), info: vi.fn(), warn: vi.fn() })),
}));

vi.mock('../../../../lib/error-tracking', () => ({
  captureException: vi.fn(),
}));

import { AbuseReportError } from '../../../../features/direct/server/abuse-reports';
import { POST } from './route';

describe('POST /api/direct/abuse-reports', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    createAbuseReportMock.mockResolvedValue({ id: 'report_1', requestId: 'req_1' });
  });

  it('creates an abuse report with the extracted client ip', async () => {
    const response = await POST(new Request('http://localhost/api/direct/abuse-reports', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-forwarded-for': '203.0.113.44, 10.0.0.1',
      },
      body: JSON.stringify({ requestId: 'req_1', reason: 'spam' }),
    }));
    const payload = await response.json();

    expect(response.status).toBe(201);
    expect(payload).toMatchObject({ ok: true, report: { id: 'report_1', requestId: 'req_1' } });
    expect(createAbuseReportMock).toHaveBeenCalledWith({ requestId: 'req_1', reason: 'spam' }, { ipAddress: '203.0.113.44' });
  });

  it('returns 400 for invalid abuse report payloads', async () => {
    createAbuseReportMock.mockRejectedValue(new ZodError([
      {
        code: z.ZodIssueCode.invalid_type,
        expected: 'string',
        received: 'undefined',
        path: ['requestId'],
        message: 'Required',
      },
    ]));

    const response = await POST(new Request('http://localhost/api/direct/abuse-reports', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ reason: 'spam' }),
    }));
    const payload = await response.json();

    expect(response.status).toBe(400);
    expect(payload.ok).toBe(false);
    expect(payload.error).toBe('Invalid payload');
    expect(payload.issues).toHaveLength(1);
  });

  it('preserves AbuseReportError status codes at the HTTP layer', async () => {
    createAbuseReportMock.mockRejectedValue(new AbuseReportError('Request not found', 404));

    const response = await POST(new Request('http://localhost/api/direct/abuse-reports', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ requestId: 'req_missing', reason: 'spam' }),
    }));
    const payload = await response.json();

    expect(response.status).toBe(404);
    expect(payload).toMatchObject({ ok: false, error: 'Request not found' });
  });
});
