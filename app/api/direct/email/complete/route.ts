import { ZodError } from 'zod';
import { completeEmailRequest, DirectValidationError } from '../../../../../features/direct/server/requests';
import { logger } from '../../../../../lib/logger';
import { captureException } from '../../../../../lib/error-tracking';
import { increment, METRIC } from '../../../../../lib/metrics';

const log = logger('email:complete');

function extractClientIP(request: Request): string | null {
  const forwarded = request.headers.get('x-forwarded-for');
  if (forwarded) {
    return forwarded.split(',')[0]?.trim() ?? null;
  }

  return request.headers.get('x-real-ip')?.trim() || null;
}

export async function POST(request: Request) {
  try {
    const payload = await request.json();
    const ipAddress = extractClientIP(request);
    const result = await completeEmailRequest(payload, {
      ipAddress,
      cfTurnstileToken: typeof payload['cf-turnstile-response'] === 'string'
        ? payload['cf-turnstile-response']
        : null,
      honeypot: typeof payload._hp_website === 'string' ? payload._hp_website : null
    });

    increment(METRIC.REQUEST_COMPLETION_CREATED);
    log.info('Email request completed', { requestId: result.id });
    return Response.json({ ok: true, request: result }, { status: 200 });
  } catch (error) {
    if (error instanceof ZodError) {
      return Response.json({ ok: false, error: 'Invalid payload', issues: error.issues }, { status: 400 });
    }

    if (error instanceof DirectValidationError) {
      return Response.json({ ok: false, error: error.message }, { status: error.statusCode });
    }

    log.error('Email request completion failed', { error });
    await captureException(error, { component: 'email:complete' });
    return Response.json({ ok: false, error: 'Internal server error' }, { status: 500 });
  }
}
