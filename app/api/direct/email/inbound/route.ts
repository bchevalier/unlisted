import crypto from 'node:crypto';
import { ZodError } from 'zod';
import { createEmailRequest, DirectValidationError } from '../../../../../features/direct/server/requests';
import { logger } from '../../../../../lib/logger';
import { captureException } from '../../../../../lib/error-tracking';
import { increment } from '../../../../../lib/metrics';
import { METRIC } from '../../../../../lib/metrics';

const log = logger('email:inbound');

/**
 * Timing-safe webhook secret comparison.
 * Uses crypto.timingSafeEqual to prevent timing attacks on the shared secret.
 */
function isAuthorized(request: Request): boolean {
  const expectedSecret = process.env.INBOUND_EMAIL_WEBHOOK_SECRET;
  if (!expectedSecret) {
    log.warn('INBOUND_EMAIL_WEBHOOK_SECRET not configured — allowing all inbound requests');
    return true;
  }

  const receivedSecret = request.headers.get('x-knokio-inbound-secret');
  if (!receivedSecret) return false;

  // Constant-time comparison to prevent timing attacks
  const expected = Buffer.from(expectedSecret, 'utf-8');
  const received = Buffer.from(receivedSecret, 'utf-8');

  if (expected.length !== received.length) return false;
  return crypto.timingSafeEqual(expected, received);
}

export async function POST(request: Request) {
  if (!isAuthorized(request)) {
    log.warn('Rejected unauthorized inbound webhook request');
    increment(METRIC.EMAIL_INBOUND_REJECTED);
    return Response.json({ ok: false, error: 'Unauthorized inbound webhook' }, { status: 401 });
  }

  try {
    increment(METRIC.EMAIL_INBOUND_RECEIVED);
    const payload = await request.json();
    const created = await createEmailRequest(payload);

    log.info('Inbound email processed', { requestId: created.id });
    return Response.json({ ok: true, request: created }, { status: 201 });
  } catch (error) {
    if (error instanceof ZodError) {
      log.warn('Invalid inbound email payload', { issues: error.issues });
      increment(METRIC.EMAIL_INBOUND_REJECTED);
      return Response.json({ ok: false, error: 'Invalid payload', issues: error.issues }, { status: 400 });
    }

    if (error instanceof DirectValidationError) {
      log.info('Inbound email rejected by validation', { error: error.message, status: error.statusCode });
      increment(METRIC.EMAIL_INBOUND_REJECTED);
      return Response.json({ ok: false, error: error.message }, { status: error.statusCode });
    }

    log.error('Inbound email processing failed', { error });
    await captureException(error, { component: 'email:inbound' });
    return Response.json({ ok: false, error: 'Internal server error' }, { status: 500 });
  }
}
