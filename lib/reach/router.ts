/**
 * Reach routing orchestrator — dispatches routed contracts to targets.
 *
 * After the policy engine decides an action (ACCEPT/ROUTE/ESCALATE), the
 * orchestrator delivers the contract to the target actor via the appropriate
 * channel:
 *
 *   - AI_AGENT / ORGANIZATION targets → multi-webhook system (per-actor webhooks
 *     with individual signing secrets and delivery logging), with fallback to
 *     the legacy single endpoint on actor.endpoint
 *   - HUMAN targets → email notification to the linked user
 *
 * Delivery is fire-and-forget from the caller's perspective: failures are
 * recorded as events but never block the contract flow.
 *
 * ## Circuit Breaker
 *
 * Webhooks that accumulate consecutive failures are automatically disabled
 * to prevent wasting delivery attempts on dead endpoints. The breaker tracks
 * per-webhook failure counts and trips after CIRCUIT_BREAKER_THRESHOLD
 * consecutive failures, pausing the webhook for CIRCUIT_BREAKER_COOLDOWN_MS.
 */

import crypto from 'node:crypto';
import { db } from '../db';
import type { ReachContractEventActor, ReachContractEventType } from './contracts';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface DeliveryTarget {
  actorId: string;
  actorType: string;
  handle: string;
  displayName: string;
  endpoint: string | null;
  userId: string | null;
}

export interface ContractPayload {
  contractId: string;
  type: string;
  status: string;
  purpose: string;
  message: string | null;
  structuredData: unknown;
  initiator: {
    handle: string;
    displayName: string;
    type: string;
  };
  target: {
    handle: string;
    displayName: string;
    type: string;
  };
  policyAction: string;
  createdAt: string;
  expiresAt: string | null;
}

export interface WebhookPayload {
  event: 'contract.routed' | 'contract.accepted' | 'contract.escalated';
  contract: ContractPayload;
  timestamp: string;
  /** HMAC-SHA256 of the payload body, keyed on the webhook's signing secret hash */
  signature?: string;
}

export interface DeliveryResult {
  channel: 'webhook' | 'email' | 'none';
  success: boolean;
  statusCode?: number;
  error?: string;
  attempts: number;
  /** Number of webhooks that received delivery (multi-webhook fan-out). */
  webhooksFired?: number;
  /** Number of webhooks that succeeded. */
  webhooksSucceeded?: number;
}

/** Per-contract delivery status summary (for the delivery status API). */
export interface ContractDeliveryStatus {
  contractId: string;
  deliveries: Array<{
    channel: string;
    success: boolean;
    statusCode: number | null;
    error: string | null;
    attempts: number;
    timestamp: string;
    policyAction: string;
  }>;
  webhookDeliveries: Array<{
    webhookId: string;
    event: string;
    status: string;
    httpStatus: number | null;
    attempts: number;
    lastError: string | null;
    deliveredAt: string | null;
    createdAt: string;
  }>;
}

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

const WEBHOOK_TIMEOUT_MS = 10_000;
const WEBHOOK_MAX_RETRIES = 2; // total attempts = 1 + retries
const WEBHOOK_RETRY_DELAY_MS = 1_000;

/** After this many consecutive failures, a webhook is auto-disabled. */
const CIRCUIT_BREAKER_THRESHOLD = 5;
/** How long (ms) before a tripped webhook is eligible for a probe attempt. */
const CIRCUIT_BREAKER_COOLDOWN_MS = 30 * 60 * 1000; // 30 minutes

// ---------------------------------------------------------------------------
// Circuit breaker state (in-memory, per-process)
// ---------------------------------------------------------------------------

interface CircuitState {
  consecutiveFailures: number;
  lastFailureAt: number;
  tripped: boolean;
}

/** In-memory circuit breaker state keyed by webhook ID. */
const circuitBreakers = new Map<string, CircuitState>();

/**
 * Check whether a webhook's circuit breaker allows delivery.
 * If tripped, allows a single probe attempt after the cooldown window.
 */
export function isCircuitOpen(webhookId: string): boolean {
  const state = circuitBreakers.get(webhookId);
  if (!state || !state.tripped) return false;

  // Allow a probe attempt after cooldown.
  if (Date.now() - state.lastFailureAt >= CIRCUIT_BREAKER_COOLDOWN_MS) {
    return false; // half-open: allow one attempt
  }

  return true; // circuit is open, block delivery
}

/**
 * Record a delivery outcome for circuit breaker tracking.
 */
export function recordCircuitOutcome(webhookId: string, success: boolean): void {
  if (success) {
    // Reset on success.
    circuitBreakers.delete(webhookId);
    return;
  }

  const state = circuitBreakers.get(webhookId) ?? {
    consecutiveFailures: 0,
    lastFailureAt: 0,
    tripped: false,
  };

  state.consecutiveFailures++;
  state.lastFailureAt = Date.now();

  if (state.consecutiveFailures >= CIRCUIT_BREAKER_THRESHOLD) {
    state.tripped = true;
  }

  circuitBreakers.set(webhookId, state);
}

/** Get circuit breaker state (for diagnostics / testing). */
export function getCircuitState(webhookId: string): CircuitState | undefined {
  return circuitBreakers.get(webhookId);
}

/** Reset all circuit breakers (for testing). */
export function resetCircuitBreakers(): void {
  circuitBreakers.clear();
}

// ---------------------------------------------------------------------------
// Main orchestrator
// ---------------------------------------------------------------------------

/**
 * Dispatch a contract to the target actor after routing.
 *
 * Called internally by `proposeContract()` after the policy engine has
 * matched and the contract is created. Delivery is async and non-blocking.
 *
 * For AI_AGENT and ORGANIZATION targets, prefers the multi-webhook system
 * (per-actor webhooks with individual signing). Falls back to the legacy
 * single endpoint on actor.endpoint only when no webhooks are configured.
 *
 * @param contractId   - the contract to deliver
 * @param policyAction - the action decided by the policy engine (ACCEPT/ROUTE/ESCALATE)
 */
export async function dispatchContract(
  contractId: string,
  policyAction: string,
): Promise<DeliveryResult> {
  const contract = await db.reachContract.findUnique({
    where: { id: contractId },
    include: {
      initiator: { select: { id: true, handle: true, displayName: true, type: true } },
      target: {
        select: {
          id: true,
          handle: true,
          displayName: true,
          type: true,
          endpoint: true,
          userId: true,
        },
      },
    },
  });

  if (!contract) {
    return { channel: 'none', success: false, error: 'Contract not found', attempts: 0 };
  }

  const target: DeliveryTarget = {
    actorId: contract.target.id,
    actorType: contract.target.type,
    handle: contract.target.handle,
    displayName: contract.target.displayName,
    endpoint: contract.target.endpoint,
    userId: contract.target.userId,
  };

  const eventName = policyActionToEvent(policyAction);

  const payload: ContractPayload = {
    contractId: contract.id,
    type: contract.type,
    status: contract.status,
    purpose: contract.purpose,
    message: contract.message,
    structuredData: contract.structuredData,
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
    policyAction,
    createdAt: contract.createdAt.toISOString(),
    expiresAt: contract.expiresAt?.toISOString() ?? null,
  };

  let result: DeliveryResult;

  // AI_AGENT and ORGANIZATION actors: prefer multi-webhook system.
  if (target.actorType === 'AI_AGENT' || target.actorType === 'ORGANIZATION') {
    result = await deliverViaWebhooks(target, eventName, payload);
  }
  // HUMAN actors with linked user get email notification.
  else if (target.actorType === 'HUMAN' && target.userId) {
    result = await deliverHumanNotification(target, payload, policyAction);
  }
  // No delivery channel available.
  else {
    result = { channel: 'none', success: false, error: 'No delivery channel', attempts: 0 };
  }

  // Record delivery outcome as a contract event.
  await recordDeliveryEvent(contractId, result, policyAction);

  return result;
}

// ---------------------------------------------------------------------------
// Multi-webhook delivery (AI_AGENT / ORGANIZATION)
// ---------------------------------------------------------------------------

/**
 * Deliver a contract via the multi-webhook system.
 *
 * Loads all active webhooks for the target actor that subscribe to the
 * relevant event, delivers in parallel with per-webhook signing and
 * circuit breaker protection, and logs delivery outcomes.
 *
 * Falls back to the legacy single endpoint if no webhooks are configured.
 */
async function deliverViaWebhooks(
  target: DeliveryTarget,
  event: string,
  payload: ContractPayload,
): Promise<DeliveryResult> {
  // Load active webhooks for this actor.
  const webhooks = await db.reachWebhook.findMany({
    where: {
      actorId: target.actorId,
      isActive: true,
    },
    select: {
      id: true,
      url: true,
      secretHash: true,
      events: true,
    },
  });

  // Map the routing event name to the event type stored in webhook subscriptions.
  const eventType = routingEventToEventType(event);

  // Filter to webhooks that subscribe to this event (empty events = all).
  const matching = webhooks.filter(
    (wh) => wh.events.length === 0 || (eventType && wh.events.includes(eventType)),
  );

  // If no multi-webhooks configured, fall back to legacy single endpoint.
  if (matching.length === 0) {
    if (target.endpoint) {
      return deliverWebhook(target.endpoint, event, payload);
    }
    return { channel: 'none', success: false, error: 'No delivery channel (no webhooks or endpoint)', attempts: 0 };
  }

  // Fan-out delivery to all matching webhooks.
  const results = await Promise.allSettled(
    matching.map((wh) => deliverToWebhookWithCircuitBreaker(wh, event, payload)),
  );

  let totalAttempts = 0;
  let succeeded = 0;
  let lastError: string | undefined;
  let lastStatus: number | undefined;

  for (const r of results) {
    if (r.status === 'fulfilled') {
      totalAttempts += r.value.attempts;
      if (r.value.success) {
        succeeded++;
        lastStatus = r.value.statusCode;
      } else {
        lastError = r.value.error;
        lastStatus = r.value.statusCode;
      }
    } else {
      lastError = r.reason instanceof Error ? r.reason.message : String(r.reason);
    }
  }

  return {
    channel: 'webhook',
    success: succeeded > 0,
    statusCode: lastStatus,
    error: succeeded === 0 ? lastError : undefined,
    attempts: totalAttempts,
    webhooksFired: matching.length,
    webhooksSucceeded: succeeded,
  };
}

/**
 * Deliver to a single webhook with circuit breaker protection.
 * Skips delivery if the circuit is open, records outcome for breaker tracking.
 */
async function deliverToWebhookWithCircuitBreaker(
  webhook: { id: string; url: string; secretHash: string | null },
  event: string,
  contract: ContractPayload,
): Promise<DeliveryResult> {
  // Circuit breaker check.
  if (isCircuitOpen(webhook.id)) {
    return {
      channel: 'webhook',
      success: false,
      error: `Circuit breaker open for webhook ${webhook.id}`,
      attempts: 0,
    };
  }

  const result = await deliverWebhookWithSecret(
    webhook.url,
    event,
    contract,
    webhook.secretHash,
  );

  // Record outcome for circuit breaker.
  recordCircuitOutcome(webhook.id, result.success);

  return result;
}

/**
 * POST a webhook payload to an endpoint with per-webhook signing.
 * Retries on transient failures (5xx, network errors).
 */
export async function deliverWebhookWithSecret(
  endpoint: string,
  event: string,
  contract: ContractPayload,
  secretHash: string | null,
): Promise<DeliveryResult> {
  const webhookPayload: WebhookPayload = {
    event: event as WebhookPayload['event'],
    contract,
    timestamp: new Date().toISOString(),
  };

  // Sign the payload body with the per-webhook secret hash.
  const body = JSON.stringify(webhookPayload);
  if (secretHash) {
    webhookPayload.signature = crypto
      .createHmac('sha256', secretHash)
      .update(body)
      .digest('hex');
  }

  const signedBody = JSON.stringify(webhookPayload);

  let lastError: string | undefined;
  let lastStatus: number | undefined;

  for (let attempt = 0; attempt <= WEBHOOK_MAX_RETRIES; attempt++) {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), WEBHOOK_TIMEOUT_MS);

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': 'Knokio-Reach/1.0',
          'X-Knokio-Event': event,
          ...(webhookPayload.signature
            ? { 'X-Knokio-Signature': webhookPayload.signature }
            : {}),
        },
        body: signedBody,
        signal: controller.signal,
      });

      clearTimeout(timeout);
      lastStatus = response.status;

      // 2xx = success.
      if (response.ok) {
        return {
          channel: 'webhook',
          success: true,
          statusCode: response.status,
          attempts: attempt + 1,
        };
      }

      // 4xx = permanent failure, don't retry.
      if (response.status >= 400 && response.status < 500) {
        const responseBody = await response.text().catch(() => '');
        return {
          channel: 'webhook',
          success: false,
          statusCode: response.status,
          error: `HTTP ${response.status}: ${responseBody.slice(0, 200)}`,
          attempts: attempt + 1,
        };
      }

      // 5xx = transient, retry.
      lastError = `HTTP ${response.status}`;
    } catch (err) {
      lastError = err instanceof Error ? err.message : String(err);
    }

    // Wait before retrying (except on last attempt).
    if (attempt < WEBHOOK_MAX_RETRIES) {
      await sleep(WEBHOOK_RETRY_DELAY_MS * (attempt + 1));
    }
  }

  return {
    channel: 'webhook',
    success: false,
    statusCode: lastStatus,
    error: `Failed after ${WEBHOOK_MAX_RETRIES + 1} attempts: ${lastError}`,
    attempts: WEBHOOK_MAX_RETRIES + 1,
  };
}

/**
 * Legacy single-endpoint webhook delivery (backward compatibility).
 * Used when an AI_AGENT/ORGANIZATION has no multi-webhooks configured
 * but has a single endpoint on the actor record.
 */
export async function deliverWebhook(
  endpoint: string,
  event: string,
  contract: ContractPayload,
): Promise<DeliveryResult> {
  return deliverWebhookWithSecret(endpoint, event, contract, null);
}

// ---------------------------------------------------------------------------
// Human email notification
// ---------------------------------------------------------------------------

/**
 * Notify a human target about a routed contract via email.
 * Looks up the linked user's email and sends a notification.
 */
async function deliverHumanNotification(
  target: DeliveryTarget,
  contract: ContractPayload,
  policyAction: string,
): Promise<DeliveryResult> {
  if (!target.userId) {
    return { channel: 'none', success: false, error: 'No linked user', attempts: 0 };
  }

  const user = await db.user.findUnique({
    where: { id: target.userId },
    select: { email: true },
  });

  if (!user?.email) {
    return { channel: 'email', success: false, error: 'User has no email', attempts: 1 };
  }

  try {
    await sendReachNotificationEmail(user.email, target, contract, policyAction);
    return { channel: 'email', success: true, attempts: 1 };
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    console.error('[reach:router:email]', errorMsg);
    return { channel: 'email', success: false, error: errorMsg, attempts: 1 };
  }
}

/**
 * Build and send a Reach contract notification email.
 */
async function sendReachNotificationEmail(
  recipientEmail: string,
  target: DeliveryTarget,
  contract: ContractPayload,
  policyAction: string,
): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.NOTIFICATION_EMAIL_FROM ?? process.env.AUTH_EMAIL_FROM ?? 'Knokio <no-reply@knokio.io>';
  const appUrl = process.env.APP_URL ?? 'http://localhost:3333';

  const actionLabel = policyAction === 'ESCALATE'
    ? 'needs your review (escalated)'
    : 'has been routed to you';

  const subject = `Reach: ${contract.initiator.displayName} ${actionLabel}`;

  const purposePreview = contract.purpose.length > 200
    ? contract.purpose.slice(0, 200) + '…'
    : contract.purpose;

  const reviewUrl = `${appUrl}/reach/contracts/${contract.contractId}`;

  const text = [
    `A new Reach contract ${actionLabel}.`,
    '',
    `From: ${contract.initiator.displayName} (@${contract.initiator.handle})`,
    `Purpose: ${purposePreview}`,
    contract.message ? `Message: ${contract.message.slice(0, 300)}` : null,
    '',
    `Review it:`,
    reviewUrl,
    '',
    '— Knokio Reach',
  ].filter(Boolean).join('\n');

  const escapedPurpose = escapeHtml(purposePreview);
  const escapedSender = escapeHtml(contract.initiator.displayName);
  const escapedHandle = escapeHtml(contract.initiator.handle);

  const html = `
<div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 520px; margin: 0 auto; color: #1a1a1a;">
  <p>A new Reach contract ${escapeHtml(actionLabel)}.</p>
  <table style="width: 100%; border-collapse: collapse; margin: 16px 0;">
    <tr><td style="padding: 4px 8px; color: #666;">From</td><td style="padding: 4px 8px;">${escapedSender} (@${escapedHandle})</td></tr>
    <tr><td style="padding: 4px 8px; color: #666;">Purpose</td><td style="padding: 4px 8px;">${escapedPurpose}</td></tr>
    <tr><td style="padding: 4px 8px; color: #666;">Type</td><td style="padding: 4px 8px;">${escapeHtml(contract.type)}</td></tr>
  </table>
  ${contract.message ? `<blockquote style="margin: 16px 0; padding: 12px 16px; background: #f5f5f5; border-left: 3px solid #ccc; color: #444;">${escapeHtml(contract.message.slice(0, 300))}</blockquote>` : ''}
  <p><a href="${escapeHtml(reviewUrl)}" style="display: inline-block; padding: 10px 20px; background: #111; color: #fff; text-decoration: none; border-radius: 6px;">Review Contract</a></p>
  <p style="margin-top: 24px; color: #999; font-size: 13px;">— Knokio Reach</p>
</div>`.trim();

  if (!apiKey) {
    console.info('[reach:router:email:fallback]', JSON.stringify({ to: recipientEmail, subject }));
    return;
  }

  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      authorization: `Bearer ${apiKey}`,
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      from,
      to: [recipientEmail],
      subject,
      text,
      html,
    }),
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Email send failed: ${response.status} ${body}`);
  }
}

// ---------------------------------------------------------------------------
// Delivery status query
// ---------------------------------------------------------------------------

/**
 * Get a unified delivery status for a contract.
 *
 * Combines:
 *   - Contract events with delivery metadata (from `recordDeliveryEvent`)
 *   - Webhook delivery records from the multi-webhook system
 *
 * Useful for debugging and for operators to see why a contract
 * wasn't delivered or which webhooks succeeded/failed.
 */
export async function getContractDeliveryStatus(
  contractId: string,
): Promise<ContractDeliveryStatus | null> {
  const contract = await db.reachContract.findUnique({
    where: { id: contractId },
    select: { id: true },
  });

  if (!contract) return null;

  // 1. Get delivery events from contract event log.
  const events = await db.reachContractEvent.findMany({
    where: {
      contractId,
      type: 'ROUTED',
    },
    orderBy: { createdAt: 'desc' },
    select: {
      metadata: true,
      createdAt: true,
    },
  });

  const deliveries = events
    .filter((e) => e.metadata && typeof e.metadata === 'object')
    .map((e) => {
      const m = e.metadata as Record<string, unknown>;
      return {
        channel: String(m.deliveryChannel ?? 'unknown'),
        success: Boolean(m.deliverySuccess),
        statusCode: typeof m.deliveryStatusCode === 'number' ? m.deliveryStatusCode : null,
        error: typeof m.deliveryError === 'string' ? m.deliveryError : null,
        attempts: typeof m.deliveryAttempts === 'number' ? m.deliveryAttempts : 0,
        timestamp: e.createdAt.toISOString(),
        policyAction: String(m.policyAction ?? 'unknown'),
      };
    });

  // 2. Get webhook delivery records from the multi-webhook system.
  const webhookDeliveries = await db.reachWebhookDelivery.findMany({
    where: { contractId },
    orderBy: { createdAt: 'desc' },
    select: {
      webhookId: true,
      event: true,
      status: true,
      httpStatus: true,
      attempts: true,
      lastError: true,
      deliveredAt: true,
      createdAt: true,
    },
  });

  return {
    contractId,
    deliveries,
    webhookDeliveries: webhookDeliveries.map((wd) => ({
      webhookId: wd.webhookId,
      event: wd.event,
      status: wd.status,
      httpStatus: wd.httpStatus,
      attempts: wd.attempts,
      lastError: wd.lastError,
      deliveredAt: wd.deliveredAt?.toISOString() ?? null,
      createdAt: wd.createdAt.toISOString(),
    })),
  };
}

// ---------------------------------------------------------------------------
// Delivery event recording
// ---------------------------------------------------------------------------

/**
 * Record a delivery outcome event on the contract.
 *
 * Uses ROUTED event type — the note and metadata distinguish success from failure.
 * We intentionally keep a single event type rather than inventing non-lifecycle
 * event types, since ROUTED already represents the delivery step.
 */
async function recordDeliveryEvent(
  contractId: string,
  result: DeliveryResult,
  policyAction: string,
): Promise<void> {
  const channelDetail = result.webhooksFired !== undefined
    ? `${result.channel} (${result.webhooksSucceeded}/${result.webhooksFired} webhooks)`
    : `${result.channel} (${result.attempts} attempt${result.attempts === 1 ? '' : 's'})`;

  try {
    await db.reachContractEvent.create({
      data: {
        contractId,
        type: 'ROUTED' as const,
        actor: 'SYSTEM' as ReachContractEventActor,
        note: result.success
          ? `Delivered via ${channelDetail}`
          : `Delivery failed via ${channelDetail}: ${result.error}`,
        metadata: {
          deliveryChannel: result.channel,
          deliverySuccess: result.success,
          deliveryAttempts: result.attempts,
          deliveryStatusCode: result.statusCode ?? null,
          deliveryError: result.error ?? null,
          webhooksFired: result.webhooksFired ?? null,
          webhooksSucceeded: result.webhooksSucceeded ?? null,
          policyAction,
        } as Parameters<typeof db.reachContractEvent.create>[0]['data']['metadata'],
      },
    });
  } catch (err) {
    console.error('[reach:router:event]', err);
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function policyActionToEvent(action: string): string {
  switch (action) {
    case 'ACCEPT':
      return 'contract.accepted';
    case 'ROUTE':
      return 'contract.routed';
    case 'ESCALATE':
      return 'contract.escalated';
    default:
      return 'contract.routed';
  }
}

/**
 * Map a routing event name (e.g. 'contract.accepted') to a ReachContractEventType
 * for matching against webhook subscriptions.
 */
function routingEventToEventType(event: string): ReachContractEventType | null {
  const map: Record<string, ReachContractEventType> = {
    'contract.accepted': 'ACCEPTED',
    'contract.routed': 'ROUTED',
    'contract.escalated': 'ESCALATED',
    'contract.created': 'CREATED',
  };
  return map[event] ?? null;
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
