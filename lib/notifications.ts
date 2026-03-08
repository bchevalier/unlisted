/**
 * Outbound notification emails for request lifecycle events.
 *
 * Notifications are fire-and-forget: failures are logged but never
 * propagate to callers. This ensures the main request flow is never
 * blocked by email delivery issues.
 */

import crypto from 'node:crypto';

// ---------------------------------------------------------------------------
// Low-level email sender (reuses Resend, same pattern as auth-mailer)
// ---------------------------------------------------------------------------

type EmailPayload = {
  to: string;
  subject: string;
  text: string;
  html?: string;
  headers?: Record<string, string>;
  /** Optional idempotency key to prevent duplicate sends on retries */
  idempotencyKey?: string;
};

function notificationFrom(): string {
  return process.env.NOTIFICATION_EMAIL_FROM ?? process.env.AUTH_EMAIL_FROM ?? 'Knokio <no-reply@knokio.io>';
}

function appUrl(): string {
  return process.env.APP_URL ?? 'http://localhost:3333';
}

async function sendEmail(payload: EmailPayload): Promise<boolean> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    console.info('[notification:fallback]', JSON.stringify({
      to: payload.to,
      subject: payload.subject
    }));
    return false;
  }

  const reqHeaders: Record<string, string> = {
    authorization: `Bearer ${apiKey}`,
    'content-type': 'application/json'
  };

  // Resend supports Idempotency-Key header to de-duplicate sends
  if (payload.idempotencyKey) {
    reqHeaders['Idempotency-Key'] = payload.idempotencyKey;
  }

  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: reqHeaders,
    body: JSON.stringify({
      from: notificationFrom(),
      to: [payload.to],
      subject: payload.subject,
      text: payload.text,
      html: payload.html,
      ...(payload.headers && { headers: payload.headers })
    })
  });

  if (!response.ok) {
    const body = await response.text();
    console.error('[notification:send-failed]', response.status, body);
    return false;
  }

  return true;
}

/**
 * Fire-and-forget wrapper. Swallows all errors and logs them.
 */
async function safeSend(payload: EmailPayload): Promise<void> {
  try {
    await sendEmail(payload);
  } catch (error) {
    console.error('[notification:error]', error);
  }
}

/**
 * Generate a deterministic idempotency key from notification context.
 * Uses a hash of the key parts to produce a stable, unique identifier.
 */
function idempotencyKey(...parts: string[]): string {
  return crypto.createHash('sha256').update(parts.join('|')).digest('hex').slice(0, 48);
}

// ---------------------------------------------------------------------------
// Batch send helper — runs sends with bounded concurrency to avoid
// overwhelming the email provider rate limit.
// ---------------------------------------------------------------------------

const DEFAULT_SEND_CONCURRENCY = 5;

export async function sendBatch(
  tasks: Array<() => Promise<void>>,
  concurrency = DEFAULT_SEND_CONCURRENCY
): Promise<{ succeeded: number; failed: number }> {
  let succeeded = 0;
  let failed = 0;
  let cursor = 0;

  async function runNext() {
    while (cursor < tasks.length) {
      const idx = cursor++;
      try {
        await tasks[idx]();
        succeeded++;
      } catch {
        failed++;
      }
    }
  }

  const workers = Array.from({ length: Math.min(concurrency, tasks.length) }, () => runNext());
  await Promise.all(workers);

  return { succeeded, failed };
}

// ---------------------------------------------------------------------------
// Template helpers
// ---------------------------------------------------------------------------

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function truncate(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  return text.slice(0, maxLength).trimEnd() + '…';
}

/**
 * Build List-Unsubscribe headers for keeper notification emails.
 * Points to the keeper's settings page where they can toggle preferences.
 * Follows RFC 2369 (List-Unsubscribe) and RFC 8058 (List-Unsubscribe-Post).
 */
function keeperUnsubscribeHeaders(doorSlug: string): Record<string, string> {
  const settingsUrl = `${appUrl()}/direct/settings?slug=${encodeURIComponent(doorSlug)}`;
  return {
    'List-Unsubscribe': `<${settingsUrl}>`,
    'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click'
  };
}

// ---------------------------------------------------------------------------
// Notification: New request → Keeper
// ---------------------------------------------------------------------------

export type NewRequestNotification = {
  keeperEmail: string;
  doorName: string;
  doorSlug: string;
  categoryLabel: string | null;
  senderName: string | null;
  senderEmail: string | null;
  title: string | null;
  messagePreview: string;
};

export async function notifyKeeperNewRequest(input: NewRequestNotification): Promise<void> {
  const inboxUrl = `${appUrl()}/direct/inbox?slug=${encodeURIComponent(input.doorSlug)}`;
  const sender = input.senderName ?? input.senderEmail ?? 'Anonymous';
  const preview = truncate(input.messagePreview, 200);
  const category = input.categoryLabel ?? 'General';

  const subject = `New request on ${input.doorName}`;

  const text = [
    `You have a new request on your Knokio door "${input.doorName}".`,
    '',
    `From: ${sender}`,
    `Category: ${category}`,
    input.title ? `Subject: ${input.title}` : null,
    '',
    `"${preview}"`,
    '',
    `Review it in your inbox:`,
    inboxUrl,
    '',
    '— Knokio'
  ].filter((line) => line !== null).join('\n');

  const html = `
<div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 520px; margin: 0 auto; color: #1a1a1a;">
  <p>You have a new request on your Knokio door <strong>${escapeHtml(input.doorName)}</strong>.</p>
  <table style="width: 100%; border-collapse: collapse; margin: 16px 0;">
    <tr><td style="padding: 4px 8px; color: #666;">From</td><td style="padding: 4px 8px;">${escapeHtml(sender)}</td></tr>
    <tr><td style="padding: 4px 8px; color: #666;">Category</td><td style="padding: 4px 8px;">${escapeHtml(category)}</td></tr>
    ${input.title ? `<tr><td style="padding: 4px 8px; color: #666;">Subject</td><td style="padding: 4px 8px;">${escapeHtml(input.title)}</td></tr>` : ''}
  </table>
  <blockquote style="margin: 16px 0; padding: 12px 16px; background: #f5f5f5; border-left: 3px solid #ccc; color: #444;">
    ${escapeHtml(preview)}
  </blockquote>
  <p><a href="${escapeHtml(inboxUrl)}" style="display: inline-block; padding: 10px 20px; background: #111; color: #fff; text-decoration: none; border-radius: 6px;">Review in Inbox</a></p>
  <p style="margin-top: 24px; color: #999; font-size: 13px;">— Knokio</p>
</div>`.trim();

  await safeSend({
    to: input.keeperEmail,
    subject,
    text,
    html,
    headers: keeperUnsubscribeHeaders(input.doorSlug),
    idempotencyKey: idempotencyKey('new-request', input.doorSlug, input.keeperEmail, input.messagePreview.slice(0, 100))
  });
}

// ---------------------------------------------------------------------------
// Notification: Request accepted → Knocker
// ---------------------------------------------------------------------------

export type RequestAcceptedNotification = {
  knockerEmail: string;
  doorName: string;
  requestToken: string;
  revealMethod: 'NONE' | 'EMAIL' | 'URL';
  revealValue: string | null;
  keeperNote: string | null;
};

export async function notifyKnockerAccepted(input: RequestAcceptedNotification): Promise<void> {
  const statusUrl = `${appUrl()}/r/${encodeURIComponent(input.requestToken)}`;

  const subject = `Your request to ${input.doorName} was accepted`;

  const revealLine = (() => {
    if (input.revealMethod === 'EMAIL' && input.revealValue) {
      return `Contact: ${input.revealValue}`;
    }
    if (input.revealMethod === 'URL' && input.revealValue) {
      return `Next step: ${input.revealValue}`;
    }
    return null;
  })();

  const text = [
    `Good news — your request to "${input.doorName}" has been accepted.`,
    '',
    revealLine,
    input.keeperNote ? `Note from keeper: "${input.keeperNote}"` : null,
    '',
    `View your request status:`,
    statusUrl,
    '',
    '— Knokio'
  ].filter((line) => line !== null).join('\n');

  const revealHtml = (() => {
    if (input.revealMethod === 'EMAIL' && input.revealValue) {
      return `<p><strong>Contact:</strong> <a href="mailto:${escapeHtml(input.revealValue)}">${escapeHtml(input.revealValue)}</a></p>`;
    }
    if (input.revealMethod === 'URL' && input.revealValue) {
      return `<p><strong>Next step:</strong> <a href="${escapeHtml(input.revealValue)}">${escapeHtml(input.revealValue)}</a></p>`;
    }
    return '';
  })();

  const html = `
<div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 520px; margin: 0 auto; color: #1a1a1a;">
  <p>Good news — your request to <strong>${escapeHtml(input.doorName)}</strong> has been accepted.</p>
  ${revealHtml}
  ${input.keeperNote ? `<p style="color: #444;"><em>"${escapeHtml(input.keeperNote)}"</em></p>` : ''}
  <p><a href="${escapeHtml(statusUrl)}" style="display: inline-block; padding: 10px 20px; background: #111; color: #fff; text-decoration: none; border-radius: 6px;">View Request Status</a></p>
  <p style="margin-top: 24px; color: #999; font-size: 13px;">— Knokio</p>
</div>`.trim();

  await safeSend({
    to: input.knockerEmail,
    subject,
    text,
    html,
    idempotencyKey: idempotencyKey('accepted', input.requestToken)
  });
}

// ---------------------------------------------------------------------------
// Notification: Completion required → Knocker (email sender)
// ---------------------------------------------------------------------------

export type CompletionRequiredNotification = {
  knockerEmail: string;
  doorName: string;
  completionUrl: string;
  subject: string | null;
};

export async function notifyKnockerCompletionRequired(input: CompletionRequiredNotification): Promise<void> {
  const emailSubject = input.subject
    ? `Re: ${input.subject}`
    : `Your message to ${input.doorName} — additional info needed`;

  const text = [
    `Thanks for reaching out to "${input.doorName}" via Knokio.`,
    '',
    `This door requires a bit more information before your request can be reviewed.`,
    `Please complete the short form below:`,
    '',
    input.completionUrl,
    '',
    `This link expires in 72 hours.`,
    '',
    '— Knokio'
  ].join('\n');

  const html = `
<div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 520px; margin: 0 auto; color: #1a1a1a;">
  <p>Thanks for reaching out to <strong>${escapeHtml(input.doorName)}</strong> via Knokio.</p>
  <p>This door requires a bit more information before your request can be reviewed. Please complete the short form below:</p>
  <p style="margin: 20px 0;">
    <a href="${escapeHtml(input.completionUrl)}" style="display: inline-block; padding: 10px 20px; background: #111; color: #fff; text-decoration: none; border-radius: 6px;">Complete Your Request</a>
  </p>
  <p style="color: #666; font-size: 13px;">This link expires in 72 hours.</p>
  <p style="margin-top: 24px; color: #999; font-size: 13px;">— Knokio</p>
</div>`.trim();

  await safeSend({ to: input.knockerEmail, subject: emailSubject, text, html });
}

// ---------------------------------------------------------------------------
// Notification: Auto-reply acknowledgment → Knocker (email sender)
// ---------------------------------------------------------------------------

export type AutoReplyNotification = {
  knockerEmail: string;
  doorName: string;
  autoReplyMessage: string | null;
  subject: string | null;
};

export async function notifyKnockerAutoReply(input: AutoReplyNotification): Promise<void> {
  const emailSubject = input.subject
    ? `Re: ${input.subject}`
    : `Your message to ${input.doorName} was received`;

  const customMessage = input.autoReplyMessage?.trim();

  const text = [
    customMessage
      ? customMessage
      : `Your message to "${input.doorName}" has been received and is now pending review.`,
    '',
    '— Knokio'
  ].join('\n');

  const bodyHtml = customMessage
    ? `<p>${escapeHtml(customMessage).replace(/\n/g, '<br>')}</p>`
    : `<p>Your message to <strong>${escapeHtml(input.doorName)}</strong> has been received and is now pending review.</p>`;

  const html = `
<div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 520px; margin: 0 auto; color: #1a1a1a;">
  ${bodyHtml}
  <p style="margin-top: 24px; color: #999; font-size: 13px;">— Knokio</p>
</div>`.trim();

  await safeSend({ to: input.knockerEmail, subject: emailSubject, text, html });
}

// ---------------------------------------------------------------------------
// Notification: Digest summary → Keeper
// ---------------------------------------------------------------------------

export type DigestNotification = {
  keeperEmail: string;
  doorName: string;
  doorSlug: string;
  pendingCount: number;
  newSinceLastDigest: number;
  sampleSenders: string[];
};

export async function notifyKeeperDigest(input: DigestNotification): Promise<void> {
  const inboxUrl = `${appUrl()}/direct/inbox?slug=${encodeURIComponent(input.doorSlug)}`;
  const senderList = input.sampleSenders.length > 0
    ? input.sampleSenders.join(', ')
    : 'anonymous senders';

  const subject = `${input.doorName}: ${input.newSinceLastDigest} new request${input.newSinceLastDigest === 1 ? '' : 's'} waiting`;

  const text = [
    `Your Knokio door "${input.doorName}" has ${input.pendingCount} pending request${input.pendingCount === 1 ? '' : 's'}.`,
    `${input.newSinceLastDigest} arrived since your last digest.`,
    '',
    `Recent senders: ${senderList}`,
    '',
    `Review them in your inbox:`,
    inboxUrl,
    '',
    '— Knokio'
  ].join('\n');

  const sendersHtml = input.sampleSenders.length > 0
    ? input.sampleSenders.map((s) => escapeHtml(s)).join(', ')
    : 'anonymous senders';

  const html = `
<div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 520px; margin: 0 auto; color: #1a1a1a;">
  <p>Your Knokio door <strong>${escapeHtml(input.doorName)}</strong> has <strong>${input.pendingCount}</strong> pending request${input.pendingCount === 1 ? '' : 's'}.</p>
  <p>${input.newSinceLastDigest} arrived since your last digest.</p>
  <p style="color: #666;">Recent senders: ${sendersHtml}</p>
  <p><a href="${escapeHtml(inboxUrl)}" style="display: inline-block; padding: 10px 20px; background: #111; color: #fff; text-decoration: none; border-radius: 6px;">Review in Inbox</a></p>
  <p style="margin-top: 24px; color: #999; font-size: 13px;">— Knokio</p>
</div>`.trim();

  await safeSend({
    to: input.keeperEmail,
    subject,
    text,
    html,
    headers: keeperUnsubscribeHeaders(input.doorSlug),
    idempotencyKey: idempotencyKey('digest', input.doorSlug, new Date().toISOString().slice(0, 13))
  });
}

// ---------------------------------------------------------------------------
// Notification: Request expired → Knocker
// ---------------------------------------------------------------------------

export type RequestExpiredNotification = {
  knockerEmail: string;
  doorName: string;
  requestToken: string;
};

export async function notifyKnockerExpired(input: RequestExpiredNotification): Promise<void> {
  const statusUrl = `${appUrl()}/r/${encodeURIComponent(input.requestToken)}`;

  const subject = `Your request to ${input.doorName} has expired`;

  const text = [
    `Your request to "${input.doorName}" has expired without a response.`,
    '',
    `This usually means the recipient didn't act within the review window.`,
    `No further action is needed on your part.`,
    '',
    `View your request status:`,
    statusUrl,
    '',
    '— Knokio'
  ].join('\n');

  const html = `
<div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 520px; margin: 0 auto; color: #1a1a1a;">
  <p>Your request to <strong>${escapeHtml(input.doorName)}</strong> has expired without a response.</p>
  <p style="color: #666;">This usually means the recipient didn't act within the review window. No further action is needed on your part.</p>
  <p><a href="${escapeHtml(statusUrl)}" style="display: inline-block; padding: 10px 20px; background: #111; color: #fff; text-decoration: none; border-radius: 6px;">View Request Status</a></p>
  <p style="margin-top: 24px; color: #999; font-size: 13px;">— Knokio</p>
</div>`.trim();

  await safeSend({
    to: input.knockerEmail,
    subject,
    text,
    html,
    idempotencyKey: idempotencyKey('expired', input.requestToken)
  });
}
