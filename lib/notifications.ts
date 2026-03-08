/**
 * Outbound notification emails for request lifecycle events.
 *
 * Notifications are fire-and-forget: failures are logged but never
 * propagate to callers. This ensures the main request flow is never
 * blocked by email delivery issues.
 */

// ---------------------------------------------------------------------------
// Low-level email sender (reuses Resend, same pattern as auth-mailer)
// ---------------------------------------------------------------------------

type EmailPayload = {
  to: string;
  subject: string;
  text: string;
  html?: string;
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

  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      authorization: `Bearer ${apiKey}`,
      'content-type': 'application/json'
    },
    body: JSON.stringify({
      from: notificationFrom(),
      to: [payload.to],
      subject: payload.subject,
      text: payload.text,
      html: payload.html
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

  await safeSend({ to: input.keeperEmail, subject, text, html });
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

  await safeSend({ to: input.knockerEmail, subject, text, html });
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

  await safeSend({ to: input.knockerEmail, subject, text, html });
}
