import Stripe from 'stripe';
import { DoorPlan } from '@prisma/client';
import { db } from '../../../lib/db';
import { stripe, getStripePriceId, getStripeWebhookSecret, getAppUrl } from '../../../lib/stripe';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Ensure the user has a Stripe customer record. Creates one if missing.
 */
async function ensureStripeCustomer(userId: string): Promise<string> {
  const user = await db.user.findUniqueOrThrow({
    where: { id: userId },
    select: { id: true, email: true, name: true, stripeCustomerId: true }
  });

  if (user.stripeCustomerId) {
    return user.stripeCustomerId;
  }

  const customer = await stripe().customers.create({
    email: user.email,
    name: user.name ?? undefined,
    metadata: { knokioUserId: user.id }
  });

  await db.user.update({
    where: { id: userId },
    data: { stripeCustomerId: customer.id }
  });

  return customer.id;
}

// ---------------------------------------------------------------------------
// Checkout session
// ---------------------------------------------------------------------------

export async function createCheckoutSession(userId: string, doorSlug: string): Promise<string> {
  const door = await db.door.findFirst({
    where: { userId, slug: doorSlug },
    select: { id: true, plan: true, stripeSubscriptionId: true }
  });

  if (!door) {
    throw new BillingError('Door not found', 404);
  }

  if (door.plan === DoorPlan.PAID && door.stripeSubscriptionId) {
    throw new BillingError('Door already has an active subscription', 400);
  }

  const customerId = await ensureStripeCustomer(userId);
  const priceId = getStripePriceId();
  const appUrl = getAppUrl();

  const session = await stripe().checkout.sessions.create({
    customer: customerId,
    mode: 'subscription',
    line_items: [{ price: priceId, quantity: 1 }],
    success_url: `${appUrl}/direct/settings?slug=${doorSlug}&billing=success`,
    cancel_url: `${appUrl}/direct/settings?slug=${doorSlug}&billing=cancel`,
    subscription_data: {
      metadata: { doorId: door.id, doorSlug }
    },
    metadata: { doorId: door.id, userId }
  });

  if (!session.url) {
    throw new BillingError('Failed to create checkout session', 500);
  }

  return session.url;
}

// ---------------------------------------------------------------------------
// Customer portal
// ---------------------------------------------------------------------------

export async function createBillingPortalSession(userId: string, doorSlug: string): Promise<string> {
  const user = await db.user.findUniqueOrThrow({
    where: { id: userId },
    select: { stripeCustomerId: true }
  });

  if (!user.stripeCustomerId) {
    throw new BillingError('No billing account found', 400);
  }

  const appUrl = getAppUrl();

  const session = await stripe().billingPortal.sessions.create({
    customer: user.stripeCustomerId,
    return_url: `${appUrl}/direct/settings?slug=${doorSlug}`
  });

  return session.url;
}

// ---------------------------------------------------------------------------
// Billing status
// ---------------------------------------------------------------------------

export type BillingStatus = {
  plan: 'FREE' | 'PAID';
  stripeSubscriptionStatus: string | null;
  stripePriceId: string | null;
  currentPeriodEnd: string | null;
  hasStripeCustomer: boolean;
};

export async function getBillingStatus(userId: string, doorSlug: string): Promise<BillingStatus> {
  const door = await db.door.findFirst({
    where: { userId, slug: doorSlug },
    select: {
      plan: true,
      stripeSubscriptionStatus: true,
      stripePriceId: true,
      stripeCurrentPeriodEnd: true,
      user: { select: { stripeCustomerId: true } }
    }
  });

  if (!door) {
    throw new BillingError('Door not found', 404);
  }

  return {
    plan: door.plan,
    stripeSubscriptionStatus: door.stripeSubscriptionStatus,
    stripePriceId: door.stripePriceId,
    currentPeriodEnd: door.stripeCurrentPeriodEnd?.toISOString() ?? null,
    hasStripeCustomer: Boolean(door.user.stripeCustomerId)
  };
}

// ---------------------------------------------------------------------------
// Webhook handling
// ---------------------------------------------------------------------------

/**
 * Map Stripe subscription status string to our enum value.
 */
function mapSubscriptionStatus(
  status: string
): 'ACTIVE' | 'PAST_DUE' | 'CANCELED' | 'INCOMPLETE' | 'INCOMPLETE_EXPIRED' | 'TRIALING' | 'UNPAID' | 'PAUSED' {
  const map: Record<string, string> = {
    active: 'ACTIVE',
    past_due: 'PAST_DUE',
    canceled: 'CANCELED',
    incomplete: 'INCOMPLETE',
    incomplete_expired: 'INCOMPLETE_EXPIRED',
    trialing: 'TRIALING',
    unpaid: 'UNPAID',
    paused: 'PAUSED'
  };
  return (map[status] ?? 'INCOMPLETE') as ReturnType<typeof mapSubscriptionStatus>;
}

/**
 * Derive DoorPlan from Stripe subscription status.
 * Only ACTIVE and TRIALING grant PAID access.
 */
function planFromSubStatus(status: string): DoorPlan {
  return status === 'active' || status === 'trialing' ? DoorPlan.PAID : DoorPlan.FREE;
}

export async function handleStripeWebhook(rawBody: Buffer, signature: string): Promise<void> {
  const webhookSecret = getStripeWebhookSecret();

  let event: Stripe.Event;
  try {
    event = stripe().webhooks.constructEvent(rawBody, signature, webhookSecret);
  } catch (err) {
    throw new BillingError('Invalid webhook signature', 400);
  }

  switch (event.type) {
    case 'customer.subscription.created':
    case 'customer.subscription.updated': {
      const subscription = event.data.object as Stripe.Subscription;
      await syncSubscription(subscription);
      break;
    }

    case 'customer.subscription.deleted': {
      const subscription = event.data.object as Stripe.Subscription;
      await handleSubscriptionCanceled(subscription);
      break;
    }

    case 'invoice.payment_succeeded': {
      const invoice = event.data.object as Stripe.Invoice;
      await recordPayment(invoice);
      break;
    }

    default:
      // Unhandled event types are silently ignored
      break;
  }
}

/**
 * Sync a Stripe subscription to the local Door record.
 * Finds the door via subscription metadata (doorId) or customer lookup.
 */
async function syncSubscription(subscription: Stripe.Subscription): Promise<void> {
  const doorId = subscription.metadata?.doorId;

  if (!doorId) {
    console.warn(`[billing] subscription ${subscription.id} has no doorId metadata, skipping`);
    return;
  }

  const firstItem = subscription.items.data[0];
  const priceId = firstItem?.price?.id ?? null;
  const periodEndUnix = firstItem?.current_period_end ?? null;
  const currentPeriodEnd = periodEndUnix ? new Date(periodEndUnix * 1000) : null;

  await db.door.update({
    where: { id: doorId },
    data: {
      plan: planFromSubStatus(subscription.status),
      stripeSubscriptionId: subscription.id,
      stripeSubscriptionStatus: mapSubscriptionStatus(subscription.status),
      stripePriceId: priceId,
      stripeCurrentPeriodEnd: currentPeriodEnd
    }
  });
}

async function handleSubscriptionCanceled(subscription: Stripe.Subscription): Promise<void> {
  const doorId = subscription.metadata?.doorId;

  if (!doorId) {
    console.warn(`[billing] canceled subscription ${subscription.id} has no doorId metadata, skipping`);
    return;
  }

  await db.door.update({
    where: { id: doorId },
    data: {
      plan: DoorPlan.FREE,
      stripeSubscriptionStatus: 'CANCELED',
      stripeCurrentPeriodEnd: null
    }
  });
}

async function recordPayment(invoice: Stripe.Invoice): Promise<void> {
  if (!invoice.customer || !invoice.id) return;

  const customerStripeId =
    typeof invoice.customer === 'string' ? invoice.customer : invoice.customer.id;

  const user = await db.user.findUnique({
    where: { stripeCustomerId: customerStripeId },
    select: { id: true }
  });

  if (!user) {
    console.warn(`[billing] no user for Stripe customer ${customerStripeId}`);
    return;
  }

  // Upsert to avoid duplicates on redelivery
  await db.payment.upsert({
    where: { stripePaymentId: invoice.id },
    create: {
      userId: user.id,
      stripePaymentId: invoice.id,
      amount: invoice.amount_paid ?? 0,
      currency: invoice.currency ?? 'usd',
      status: 'succeeded',
      description: invoice.description ?? `Invoice ${invoice.number ?? invoice.id}`
    },
    update: {
      status: 'succeeded',
      amount: invoice.amount_paid ?? 0
    }
  });
}

// ---------------------------------------------------------------------------
// Error class
// ---------------------------------------------------------------------------

export class BillingError extends Error {
  public statusCode: number;
  constructor(message: string, statusCode: number) {
    super(message);
    this.name = 'BillingError';
    this.statusCode = statusCode;
  }
}
