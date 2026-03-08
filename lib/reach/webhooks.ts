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

  for (let attempt = 0; attempt <= WEBHOOK_MAX_RETRIES; attempt++) {
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

  // Update delivery record.
  await db.reachWebhookDelivery.update({
    where: { id: delivery.id },
    data: {
      status: success ? 'success' : 'failed',
      httpStatus: lastStatus ?? null,
      attempts: Math.min(WEBHOOK_MAX_RETRIES + 1, WEBHOOK_MAX_RETRIES + 1),
      lastError: success ? null : (lastError ?? null),
      deliveredAt: success ? new Date() : null,
    },
  }).catch((err) => {
    console.error('[reach:webhooks:delivery:update]', err);
  });
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
