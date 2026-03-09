import { BillingError, handleStripeWebhook } from '../../../../../features/direct/server/billing';

/**
 * Stripe webhook endpoint.
 *
 * IMPORTANT: This route receives raw request bodies for signature verification.
 * Next.js App Router passes the raw body through `request.arrayBuffer()`.
 */
export async function POST(request: Request) {
  const signature = request.headers.get('stripe-signature');

  if (!signature) {
    return Response.json({ ok: false, error: 'Missing stripe-signature header' }, { status: 400 });
  }

  try {
    const rawBody = Buffer.from(await request.arrayBuffer());
    await handleStripeWebhook(rawBody, signature);
    return Response.json({ ok: true, received: true });
  } catch (error) {
    if (error instanceof BillingError) {
      return Response.json(
        { ok: false, error: error.message },
        { status: error.statusCode }
      );
    }

    console.error('[billing/webhook]', error);
    return Response.json({ ok: false, error: 'Webhook processing failed' }, { status: 500 });
  }
}
