import { BillingError, handleStripeWebhook } from '../../../../../features/direct/server/billing';
import { logger } from '../../../../../lib/logger';
import { captureException } from '../../../../../lib/error-tracking';

const log = logger('billing:webhook');

/**
 * Stripe webhook endpoint.
 *
 * IMPORTANT: This route receives raw request bodies for signature verification.
 * Next.js App Router passes the raw body through `request.arrayBuffer()`.
 */
export async function POST(request: Request) {
  const signature = request.headers.get('stripe-signature');

  if (!signature) {
    log.warn('Missing stripe-signature header');
    return Response.json({ ok: false, error: 'Missing stripe-signature header' }, { status: 400 });
  }

  try {
    const rawBody = Buffer.from(await request.arrayBuffer());
    await handleStripeWebhook(rawBody, signature);
    log.info('Stripe webhook processed');
    return Response.json({ ok: true, received: true });
  } catch (error) {
    if (error instanceof BillingError) {
      log.warn('Stripe webhook billing error', { error: error.message, status: error.statusCode });
      return Response.json(
        { ok: false, error: error.message },
        { status: error.statusCode }
      );
    }

    log.error('Stripe webhook processing failed', { error });
    await captureException(error, { component: 'billing:webhook' });
    return Response.json({ ok: false, error: 'Webhook processing failed' }, { status: 500 });
  }
}
