import Stripe from 'stripe';

// ---------------------------------------------------------------------------
// Stripe client singleton
// ---------------------------------------------------------------------------

function getStripeClient(): Stripe {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) {
    throw new Error('STRIPE_SECRET_KEY is not set');
  }
  return new Stripe(key, { apiVersion: '2026-02-25.clover' as Stripe.LatestApiVersion });
}

let _stripe: Stripe | null = null;

export function stripe(): Stripe {
  if (!_stripe) {
    _stripe = getStripeClient();
  }
  return _stripe;
}

// ---------------------------------------------------------------------------
// Product / Price configuration
// ---------------------------------------------------------------------------

/**
 * These values come from the Stripe dashboard after product creation.
 * Set them via environment variables. The app checks at checkout time.
 */
export function getStripePriceId(): string {
  const priceId = process.env.STRIPE_PRICE_ID;
  if (!priceId) {
    throw new Error('STRIPE_PRICE_ID is not configured');
  }
  return priceId;
}

export function getStripeWebhookSecret(): string {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secret) {
    throw new Error('STRIPE_WEBHOOK_SECRET is not configured');
  }
  return secret;
}

export function getAppUrl(): string {
  return process.env.APP_URL ?? 'http://localhost:3333';
}
