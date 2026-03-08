/**
 * Reach routing orchestrator — dispatches routed contracts to targets.
 *
 * After the policy engine decides an action (ACCEPT/ROUTE/ESCALATE), the
 * orchestrator delivers the contract to the target actor via the appropriate
 * channel:
 *
 *   - HUMAN targets → email notification to the linked user
 *   - AI_AGENT / ORGANIZATION targets → webhook POST to registered endpoint
 *
 * Delivery is fire-and-forget from the caller's perspective: failures are
 * recorded as events but never block the contract flow.
 */

import crypto from 'node:crypto';
import { db } from '../db';
import type { ReachContractEventActor } from './contracts';

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
  /** HMAC-SHA256 of the payload body, keyed on the target actor's API key hash */
  signature?: string;
}

export interface DeliveryResult {
  channel: 'webhook' | 'email' | 'none';
  success: boolean;
  statusCode?: number;
  error?: string;
  attempts: number;
}

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

const WEBHOOK_TIMEOUT_MS = 10_000;
const WEBHOOK_MAX_RETRIES = 2; // total attempts = 1 + retries
const WEBHOOK_RETRY_DELAY_MS = 1_000;

// ---------------------------------------------------------------------------
// Main orchestrator
// ---------------------------------------------------------------------------

/**
 * Dispatch a contract to the target actor after routing.
 *
 * Called internally by `proposeContract()` after the policy engine has
 * matched and the contract is created. Delivery is async and non-blocking.
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

  // AI_AGENT and ORGANIZATION actors with endpoints get webhook delivery.
  if ((target.actorType === 'AI_AGENT' || target.actorType === 'ORGANIZATION') && target.endpoint) {
    result = await deliverWebhook(target.endpoint, eventName, payload);
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
// Webhook delivery (AI_AGENT / ORGANIZATION)
// ---------------------------------------------------------------------------

/**
 * POST a webhook payload to the target's registered endpoint.
 * Retries on transient failures (5xx, network errors).
 */
export async function deliverWebhook(
  endpoint: string,
  event: string,
  contract: ContractPayload,
): Promise<DeliveryResult> {
  const webhookPayload: WebhookPayload = {
    event: event as WebhookPayload['event'],
    contract,
    timestamp: new Date().toISOString(),
  };

  // Sign the payload body.
  const body = JSON.stringify(webhookPayload);
  const webhookSecret = process.env.REACH_WEBHOOK_SECRET;
  if (webhookSecret) {
    webhookPayload.signature = crypto
      .createHmac('sha256', webhookSecret)
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
  try {
    await db.reachContractEvent.create({
      data: {
        contractId,
        type: 'ROUTED' as const,
        actor: 'SYSTEM' as ReachContractEventActor,
        note: result.success
          ? `Delivered via ${result.channel} (${result.attempts} attempt${result.attempts === 1 ? '' : 's'})`
          : `Delivery failed via ${result.channel}: ${result.error}`,
        metadata: {
          deliveryChannel: result.channel,
          deliverySuccess: result.success,
          deliveryAttempts: result.attempts,
          deliveryStatusCode: result.statusCode ?? null,
          deliveryError: result.error ?? null,
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
