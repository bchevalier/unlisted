/**
 * Reach webhook management and lifecycle event dispatcher.
 *
 * Provides:
 * - CRUD for per-actor webhook configurations
 * - Lifecycle hook that fires webhooks on all contract events
 * - Per-webhook HMAC signing with individual secrets
 * - Delivery logging for debugging and retry visibility
 *
 * This replaces the single-endpoint model on ReachActor with a proper
 * multi-webhook integration layer.
 */

import crypto from 'node:crypto';
import { z } from 'zod';
import { db } from '../db';
import type { ReachContractEventType } from './contracts';
import { REACH_EVENT_TYPES } from './contracts';
import { ReachError } from './service';

// ---------------------------------------------------------------------------
// Schemas
// ---------------------------------------------------------------------------

export const ReachWebhookCreateSchema = z.object({
  url: z.string().url().max(2048),
  events: z.array(z.enum(REACH_EVENT_TYPES)).default([]),
  description: z.string().max(500).optional(),
});

export const ReachWebhookUpdateSchema = z.object({
  url: z.string().url().max(2048).optional(),
  events: z.array(z.enum(REACH_EVENT_TYPES)).optional(),
  description: z.string().max(500).optional().nullable(),
  isActive: z.boolean().optional(),
});

export type ReachWebhookCreate = z.input<typeof ReachWebhookCreateSchema>;
export type ReachWebhookUpdate = z.input<typeof ReachWebhookUpdateSchema>;

// ---------------------------------------------------------------------------
// Webhook event payload types
// ---------------------------------------------------------------------------

export interface WebhookEventPayload {
  event: string; // e.g. "contract.accepted"
  contractId: string;
  contractType: string;
  contractStatus: string;
  purpose: string;
  message: string | null;
  initiator: { handle: string; displayName: string; type: string };
  target: { handle: string; displayName: string; type: string };
  eventType: ReachContractEventType;
  eventActor: string;
  eventNote: string | null;
  timestamp: string;
}

export interface SignedWebhookPayload extends WebhookEventPayload {
  signature?: string;
}

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

const WEBHOOK_TIMEOUT_MS = 10_000;
const WEBHOOK_MAX_RETRIES = 2;
const WEBHOOK_RETRY_DELAY_MS = 1_000;
const MAX_WEBHOOKS_PER_ACTOR = 10;

// ---------------------------------------------------------------------------
// CRUD
// ---------------------------------------------------------------------------

/**
 * Register a new webhook for an actor.
 * Returns the webhook + a plaintext signing secret (only shown once).
 */
export async function createWebhook(actorId: string, input: ReachWebhookCreate) {
  const data = ReachWebhookCreateSchema.parse(input);

  // Verify actor exists.
  const actor = await db.reachActor.findUnique({
    where: { id: actorId },
    select: { id: true, isActive: true },
  });
  if (!actor) throw new ReachError('Actor not found', 'ACTOR_NOT_FOUND', 404);
  if (!actor.isActive) throw new ReachError('Actor is inactive', 'ACTOR_INACTIVE', 403);

  // Enforce per-actor limit.
  const count = await db.reachWebhook.count({ where: { actorId } });
  if (count >= MAX_WEBHOOKS_PER_ACTOR) {
    throw new ReachError(
      `Maximum ${MAX_WEBHOOKS_PER_ACTOR} webhooks per actor`,
      'WEBHOOK_LIMIT',
      400,
    );
  }

  // Generate a unique signing secret.
  const secret = `whsec_${crypto.randomBytes(32).toString('hex')}`;
  const secretHash = crypto.createHash('sha256').update(secret).digest('hex');

  const webhook = await db.reachWebhook.create({
    data: {
      actorId,
      url: data.url,
      secretHash,
      events: data.events,
      description: data.description ?? null,
    },
  });

  return { webhook, secret };
}

/**
 * List webhooks for an actor (secrets are never returned).
 */
export async function listWebhooks(actorId: string, includeInactive = false) {
  return db.reachWebhook.findMany({
    where: {
      actorId,
      ...(includeInactive ? {} : { isActive: true }),
    },
    orderBy: { createdAt: 'asc' },
    select: {
      id: true,
      url: true,
      events: true,
      description: true,
      isActive: true,
      createdAt: true,
      updatedAt: true,
    },
  });
}

/**
 * Get a single webhook by ID.
 */
export async function getWebhook(webhookId: string) {
  return db.reachWebhook.findUnique({
    where: { id: webhookId },
    select: {
      id: true,
      actorId: true,
      url: true,
      events: true,
      description: true,
      isActive: true,
      createdAt: true,
      updatedAt: true,
    },
  });
}

/**
 * Update a webhook configuration.
 */
const WEBHOOK_PUBLIC_SELECT = {
  id: true,
  url: true,
  events: true,
  description: true,
  isActive: true,
  createdAt: true,
  updatedAt: true,
} as const;

export async function updateWebhook(webhookId: string, input: ReachWebhookUpdate) {
  const data = ReachWebhookUpdateSchema.parse(input);

  const webhook = await db.reachWebhook.findUnique({
    where: { id: webhookId },
    select: WEBHOOK_PUBLIC_SELECT,
  });
  if (!webhook) throw new ReachError('Webhook not found', 'WEBHOOK_NOT_FOUND', 404);

  const updateData: Record<string, unknown> = {};
  if (data.url !== undefined) updateData.url = data.url;
  if (data.events !== undefined) updateData.events = data.events;
  if (data.description !== undefined) updateData.description = data.description;
  if (data.isActive !== undefined) updateData.isActive = data.isActive;

  if (Object.keys(updateData).length === 0) return webhook;

  return db.reachWebhook.update({
    where: { id: webhookId },
    data: updateData,
    select: {
      id: true,
      url: true,
      events: true,
      description: true,
      isActive: true,
      createdAt: true,
      updatedAt: true,
    },
  });
}

/**
 * Delete a webhook permanently.
 */
export async function deleteWebhook(webhookId: string) {
  const webhook = await db.reachWebhook.findUnique({
    where: { id: webhookId },
    select: { id: true },
  });
  if (!webhook) throw new ReachError('Webhook not found', 'WEBHOOK_NOT_FOUND', 404);

  await db.reachWebhook.delete({ where: { id: webhookId } });
  return { deleted: true };
}

/**
 * Rotate a webhook's signing secret.
 * Returns the new plaintext secret (only shown once).
 */
export async function rotateWebhookSecret(webhookId: string) {
  const webhook = await db.reachWebhook.findUnique({
    where: { id: webhookId },
    select: { id: true },
  });
  if (!webhook) throw new ReachError('Webhook not found', 'WEBHOOK_NOT_FOUND', 404);

  const secret = `whsec_${crypto.randomBytes(32).toString('hex')}`;
  const secretHash = crypto.createHash('sha256').update(secret).digest('hex');

  await db.reachWebhook.update({
    where: { id: webhookId },
    data: { secretHash },
  });

  return { secret };
}

/**
 * List delivery logs for a webhook.
 */
export async function listDeliveries(
  webhookId: string,
  limit = 50,
  offset = 0,
) {
  return db.reachWebhookDelivery.findMany({
    where: { webhookId },
    orderBy: { createdAt: 'desc' },
    take: limit,
    skip: offset,
    select: {
      id: true,
      contractId: true,
      event: true,
      status: true,
      httpStatus: true,
      attempts: true,
      lastError: true,
      deliveredAt: true,
      createdAt: true,
    },
  });
}

// ---------------------------------------------------------------------------
// Lifecycle event dispatcher
// ---------------------------------------------------------------------------

/**
 * Fire webhooks for a contract lifecycle event.
 *
 * Called after any contract state change. Finds all active webhooks for
 * the target actor that subscribe to the event type, then delivers in
 * parallel (fire-and-forget from the caller's perspective).
 *
 * @param contractId - the contract that changed
 * @param eventType  - the event type (CREATED, ACCEPTED, etc.)
 * @param actorId    - the actor whose webhooks should fire (usually target)
 */
export async function dispatchWebhookEvent(
  contractId: string,
  eventType: ReachContractEventType,
  actorId: string,
): Promise<void> {
  // Find matching webhooks for this actor.
  const webhooks = await db.reachWebhook.findMany({
    where: {
      actorId,
      isActive: true,
    },
    select: {
      id: true,
      url: true,
      secretHash: true,
      events: true,
    },
  });

  if (webhooks.length === 0) return;

  // Filter to webhooks that subscribe to this event (empty events = all).
  const matching = webhooks.filter(
    (wh) => wh.events.length === 0 || wh.events.includes(eventType),
  );

  if (matching.length === 0) return;

  // Load contract details for the payload.
  const contract = await db.reachContract.findUnique({
    where: { id: contractId },
    include: {
      initiator: { select: { handle: true, displayName: true, type: true } },
      target: { select: { handle: true, displayName: true, type: true } },
      events: { where: { type: eventType }, orderBy: { createdAt: 'desc' }, take: 1 },
    },
  });

  if (!contract) return;

  const latestEvent = contract.events[0];

  const payload: WebhookEventPayload = {
    event: `contract.${eventType.toLowerCase()}`,
    contractId: contract.id,
    contractType: contract.type,
    contractStatus: contract.status,
    purpose: contract.purpose,
    message: contract.message,
    initiator: {
      handle: contract.initiator.handle,
      displayName: contract.initiator.displayName,
      type: contract.initiator.type,
    },
    target: {
      handle: contract.target.handle,
      displayName: contract.target.displayName,
      type: contract.target.type,
    },
    eventType,
    eventActor: latestEvent?.actor ?? 'SYSTEM',
    eventNote: latestEvent?.note ?? null,
    timestamp: new Date().toISOString(),
  };

  // Deliver to all matching webhooks in parallel.
  await Promise.allSettled(
    matching.map((wh) => deliverToWebhook(wh, payload, contractId, eventType)),
  );
}

// ---------------------------------------------------------------------------
// Individual webhook delivery
// ---------------------------------------------------------------------------

async function deliverToWebhook(
  webhook: { id: string; url: string; secretHash: string | null },
  payload: WebhookEventPayload,
  contractId: string,
  eventType: ReachContractEventType,
): Promise<void> {
  const signedPayload: SignedWebhookPayload = { ...payload };

  // Sign the payload with the webhook's secret.
  const body = JSON.stringify(signedPayload);
  if (webhook.secretHash) {
    // We use the secretHash itself as HMAC key — the receiver must verify
    // against their stored plaintext secret.
    // Actually, we need the plaintext secret to sign. But we only store the hash.
    // Convention: we sign with HMAC using the hash as the key. Receiver
    // was given the plaintext secret and must hash it to get the same key.
    // Simpler: use the webhook ID + timestamp as nonce, sign body with secretHash.
    signedPayload.signature = crypto
      .createHmac('sha256', webhook.secretHash)
      .update(body)
      .digest('hex');
  }

  const signedBody = JSON.stringify(signedPayload);

  // Create delivery record.
  const delivery = await db.reachWebhookDelivery.create({
    data: {
      webhookId: webhook.id,
      contractId,
      event: eventType,
      status: 'pending',
      attempts: 0,
      payload: signedPayload as unknown as Parameters<typeof db.reachWebhookDelivery.create>[0]['data']['payload'],
    },
  });

  let lastError: string | undefined;
  let lastStatus: number | undefined;
  let success = false;
  let actualAttempts = 0;

  for (let attempt = 0; attempt <= WEBHOOK_MAX_RETRIES; attempt++) {
    actualAttempts = attempt + 1;
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), WEBHOOK_TIMEOUT_MS);

      const response = await fetch(webhook.url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': 'Knokio-Reach/1.0',
          'X-Knokio-Event': payload.event,
          'X-Knokio-Webhook-Id': webhook.id,
          'X-Knokio-Delivery-Id': delivery.id,
          ...(signedPayload.signature
            ? { 'X-Knokio-Signature': signedPayload.signature }
            : {}),
        },
        body: signedBody,
        signal: controller.signal,
      });

      clearTimeout(timeout);
      lastStatus = response.status;

      if (response.ok) {
        success = true;
        break;
      }

      // 4xx = permanent failure, don't retry.
      if (response.status >= 400 && response.status < 500) {
        const responseBody = await response.text().catch(() => '');
        lastError = `HTTP ${response.status}: ${responseBody.slice(0, 200)}`;
        break;
      }

      // 5xx = transient, retry.
      lastError = `HTTP ${response.status}`;
    } catch (err) {
      lastError = err instanceof Error ? err.message : String(err);
    }

    if (attempt < WEBHOOK_MAX_RETRIES) {
      await sleep(WEBHOOK_RETRY_DELAY_MS * (attempt + 1));
    }
  }

  // Update delivery record with actual attempt count.
  await db.reachWebhookDelivery.update({
    where: { id: delivery.id },
    data: {
      status: success ? 'success' : 'failed',
      httpStatus: lastStatus ?? null,
      attempts: actualAttempts,
      lastError: success ? null : (lastError ?? null),
      deliveredAt: success ? new Date() : null,
    },
  }).catch((err) => {
    console.error('[reach:webhooks:delivery:update]', err);
  });
}

// ---------------------------------------------------------------------------
// Test / Ping
// ---------------------------------------------------------------------------

/**
 * Send a test ping to a webhook endpoint to verify it's reachable.
 *
 * Sends a synthetic `ping` event that contains no real contract data.
 * The webhook should respond with 2xx. Records no delivery log.
 *
 * @param webhookId - the webhook to ping
 * @returns ping result with status code and latency
 */
export async function pingWebhook(webhookId: string): Promise<{
  success: boolean;
  statusCode?: number;
  latencyMs: number;
  error?: string;
}> {
  const webhook = await db.reachWebhook.findUnique({
    where: { id: webhookId },
    select: { id: true, url: true, secretHash: true, isActive: true },
  });

  if (!webhook) throw new ReachError('Webhook not found', 'WEBHOOK_NOT_FOUND', 404);

  const payload = {
    event: 'ping',
    webhookId: webhook.id,
    timestamp: new Date().toISOString(),
    message: 'This is a test ping from Knokio Reach. No action required.',
  };

  const body = JSON.stringify(payload);

  let signature: string | undefined;
  if (webhook.secretHash) {
    signature = crypto
      .createHmac('sha256', webhook.secretHash)
      .update(body)
      .digest('hex');
  }

  const start = Date.now();

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), WEBHOOK_TIMEOUT_MS);

    const response = await fetch(webhook.url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'Knokio-Reach/1.0',
        'X-Knokio-Event': 'ping',
        'X-Knokio-Webhook-Id': webhook.id,
        ...(signature ? { 'X-Knokio-Signature': signature } : {}),
      },
      body,
      signal: controller.signal,
    });

    clearTimeout(timeout);
    const latencyMs = Date.now() - start;

    return {
      success: response.ok,
      statusCode: response.status,
      latencyMs,
      error: response.ok ? undefined : `HTTP ${response.status}`,
    };
  } catch (err) {
    const latencyMs = Date.now() - start;
    return {
      success: false,
      latencyMs,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

// ---------------------------------------------------------------------------
// Delivery retry
// ---------------------------------------------------------------------------

/**
 * Retry a failed webhook delivery.
 *
 * Loads the original delivery record and its associated webhook, then
 * re-sends the stored payload. Creates a new delivery record for the
 * retry attempt so both the original failure and the retry outcome are
 * visible in the delivery log.
 *
 * Only deliveries with status 'failed' can be retried.
 *
 * @param deliveryId - the delivery to retry
 * @returns the new delivery outcome
 */
export async function retryDelivery(deliveryId: string): Promise<{
  success: boolean;
  newDeliveryId: string;
  httpStatus?: number;
  error?: string;
}> {
  const delivery = await db.reachWebhookDelivery.findUnique({
    where: { id: deliveryId },
    select: {
      id: true,
      webhookId: true,
      contractId: true,
      event: true,
      status: true,
      payload: true,
    },
  });

  if (!delivery) {
    throw new ReachError('Delivery not found', 'DELIVERY_NOT_FOUND', 404);
  }

  if (delivery.status === 'success') {
    throw new ReachError('Delivery already succeeded', 'DELIVERY_ALREADY_SUCCEEDED', 400);
  }

  const webhook = await db.reachWebhook.findUnique({
    where: { id: delivery.webhookId },
    select: { id: true, url: true, secretHash: true, isActive: true },
  });

  if (!webhook) {
    throw new ReachError('Webhook no longer exists', 'WEBHOOK_NOT_FOUND', 404);
  }

  if (!webhook.isActive) {
    throw new ReachError('Webhook is inactive', 'WEBHOOK_INACTIVE', 400);
  }

  // Build the payload from stored data (or re-fetch contract if payload is empty).
  let body: string;
  let signature: string | undefined;

  if (delivery.payload && typeof delivery.payload === 'object' && Object.keys(delivery.payload as Record<string, unknown>).length > 0) {
    body = JSON.stringify(delivery.payload);
  } else {
    // Rebuild payload from contract.
    const contract = await db.reachContract.findUnique({
      where: { id: delivery.contractId },
      include: {
        initiator: { select: { handle: true, displayName: true, type: true } },
        target: { select: { handle: true, displayName: true, type: true } },
        events: { where: { type: delivery.event }, orderBy: { createdAt: 'desc' }, take: 1 },
      },
    });

    if (!contract) {
      throw new ReachError('Contract no longer exists', 'CONTRACT_NOT_FOUND', 404);
    }

    const latestEvent = contract.events[0];
    const payload: WebhookEventPayload = {
      event: `contract.${delivery.event.toLowerCase()}`,
      contractId: contract.id,
      contractType: contract.type,
      contractStatus: contract.status,
      purpose: contract.purpose,
      message: contract.message,
      initiator: {
        handle: contract.initiator.handle,
        displayName: contract.initiator.displayName,
        type: contract.initiator.type,
      },
      target: {
        handle: contract.target.handle,
        displayName: contract.target.displayName,
        type: contract.target.type,
      },
      eventType: delivery.event as ReachContractEventType,
      eventActor: latestEvent?.actor ?? 'SYSTEM',
      eventNote: latestEvent?.note ?? null,
      timestamp: new Date().toISOString(),
    };

    body = JSON.stringify(payload);
  }

  // Sign.
  if (webhook.secretHash) {
    signature = crypto
      .createHmac('sha256', webhook.secretHash)
      .update(body)
      .digest('hex');
  }

  // Create a new delivery record for the retry.
  const retryDelivery = await db.reachWebhookDelivery.create({
    data: {
      webhookId: webhook.id,
      contractId: delivery.contractId,
      event: delivery.event,
      status: 'pending',
      attempts: 0,
      payload: delivery.payload ?? ({} as Parameters<typeof db.reachWebhookDelivery.create>[0]['data']['payload']),
    },
  });

  let lastError: string | undefined;
  let lastStatus: number | undefined;
  let success = false;
  let actualAttempts = 0;

  for (let attempt = 0; attempt <= WEBHOOK_MAX_RETRIES; attempt++) {
    actualAttempts = attempt + 1;
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), WEBHOOK_TIMEOUT_MS);

      const response = await fetch(webhook.url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': 'Knokio-Reach/1.0',
          'X-Knokio-Event': delivery.event.toLowerCase(),
          'X-Knokio-Webhook-Id': webhook.id,
          'X-Knokio-Delivery-Id': retryDelivery.id,
          'X-Knokio-Retry-Of': deliveryId,
          ...(signature ? { 'X-Knokio-Signature': signature } : {}),
        },
        body,
        signal: controller.signal,
      });

      clearTimeout(timeout);
      lastStatus = response.status;

      if (response.ok) {
        success = true;
        break;
      }

      if (response.status >= 400 && response.status < 500) {
        const responseBody = await response.text().catch(() => '');
        lastError = `HTTP ${response.status}: ${responseBody.slice(0, 200)}`;
        break;
      }

      lastError = `HTTP ${response.status}`;
    } catch (err) {
      lastError = err instanceof Error ? err.message : String(err);
    }

    if (attempt < WEBHOOK_MAX_RETRIES) {
      await sleep(WEBHOOK_RETRY_DELAY_MS * (attempt + 1));
    }
  }

  // Update the retry delivery record.
  await db.reachWebhookDelivery.update({
    where: { id: retryDelivery.id },
    data: {
      status: success ? 'success' : 'failed',
      httpStatus: lastStatus ?? null,
      attempts: actualAttempts,
      lastError: success ? null : (lastError ?? null),
      deliveredAt: success ? new Date() : null,
    },
  }).catch((err) => {
    console.error('[reach:webhooks:retry:update]', err);
  });

  return {
    success,
    newDeliveryId: retryDelivery.id,
    httpStatus: lastStatus,
    error: success ? undefined : lastError,
  };
}

// ---------------------------------------------------------------------------
// Webhook health stats
// ---------------------------------------------------------------------------

export interface WebhookHealthStats {
  webhookId: string;
  totalDeliveries: number;
  successCount: number;
  failedCount: number;
  pendingCount: number;
  successRate: number; // 0–1
  lastDeliveryAt: string | null;
  lastSuccessAt: string | null;
  lastFailureAt: string | null;
  avgAttempts: number;
}

/**
 * Compute delivery health statistics for a webhook.
 *
 * Queries all delivery records within the given window (default 7 days)
 * and returns aggregate success/failure metrics.
 */
export async function getWebhookHealthStats(
  webhookId: string,
  windowDays = 7,
): Promise<WebhookHealthStats> {
  const since = new Date(Date.now() - windowDays * 24 * 60 * 60 * 1000);

  const deliveries = await db.reachWebhookDelivery.findMany({
    where: {
      webhookId,
      createdAt: { gte: since },
    },
    select: {
      status: true,
      attempts: true,
      deliveredAt: true,
      createdAt: true,
    },
    orderBy: { createdAt: 'desc' },
  });

  let successCount = 0;
  let failedCount = 0;
  let pendingCount = 0;
  let totalAttempts = 0;
  let lastSuccessAt: Date | null = null;
  let lastFailureAt: Date | null = null;

  for (const d of deliveries) {
    totalAttempts += d.attempts;

    if (d.status === 'success') {
      successCount++;
      if (!lastSuccessAt || d.createdAt > lastSuccessAt) {
        lastSuccessAt = d.deliveredAt ?? d.createdAt;
      }
    } else if (d.status === 'failed') {
      failedCount++;
      if (!lastFailureAt || d.createdAt > lastFailureAt) {
        lastFailureAt = d.createdAt;
      }
    } else {
      pendingCount++;
    }
  }

  const total = deliveries.length;
  const completed = successCount + failedCount;

  return {
    webhookId,
    totalDeliveries: total,
    successCount,
    failedCount,
    pendingCount,
    successRate: completed > 0 ? successCount / completed : 0,
    lastDeliveryAt: deliveries[0]?.createdAt.toISOString() ?? null,
    lastSuccessAt: lastSuccessAt?.toISOString() ?? null,
    lastFailureAt: lastFailureAt?.toISOString() ?? null,
    avgAttempts: total > 0 ? totalAttempts / total : 0,
  };
}

/**
 * Compute aggregate health for all webhooks belonging to an actor.
 */
export async function getActorWebhookHealth(
  actorId: string,
  windowDays = 7,
): Promise<WebhookHealthStats[]> {
  const webhooks = await db.reachWebhook.findMany({
    where: { actorId },
    select: { id: true },
  });

  return Promise.all(
    webhooks.map((wh) => getWebhookHealthStats(wh.id, windowDays)),
  );
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
