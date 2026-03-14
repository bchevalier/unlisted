import crypto from 'node:crypto';
import {
  CategoryFieldType,
  ContactRevealMethod,
  DoorPlan,
  RequestEventActor,
  RequestEventType,
  RequestSource,
  RequestStatus
} from '@prisma/client';
import { z } from 'zod';
import { db } from '../../../lib/db';
import { logger } from '../../../lib/logger';
import { increment, startTimer, METRIC } from '../../../lib/metrics';
import {
  notifyKeeperNewRequest,
  notifyKnockerAccepted,
  notifyKnockerAutoReply,
  notifyKnockerCompletionRequired,
  notifyKnockerExpired,
  sendBatch
} from '../../../lib/notifications';
import { verifyTurnstileToken } from '../../../lib/turnstile';
import { computeVerificationStatus } from './verification';

const log = logger('requests');

const formRequestSchema = z.object({
  doorSlug: z.string().trim().min(1),
  categoryKey: z.string().trim().min(1),
  senderName: z.string().trim().max(120).optional(),
  senderEmail: z.string().trim().email().optional(),
  title: z.string().trim().max(180).optional(),
  message: z.string().trim().min(1).max(4000),
  fields: z.record(z.string(), z.string()).default({}),
  // Requester type / org fields (V1 verification)
  requesterType: z.enum(['INDIVIDUAL', 'ORGANIZATION']).default('INDIVIDUAL'),
  requesterOrgName: z.string().trim().max(200).optional(),
  requesterOrgWebsite: z.string().trim().max(500).optional(),
  requesterRoleTitle: z.string().trim().max(200).optional()
});

const emailRequestSchema = z.object({
  to: z.string().trim().min(1),
  from: z.string().trim().min(1),
  subject: z.string().trim().max(180).optional(),
  text: z.string().trim().min(1).max(10000),
  cc: z.array(z.string()).optional(),
  bcc: z.array(z.string()).optional(),
  attachments: z.array(z.unknown()).optional()
});

const updateStatusSchema = z.object({
  status: z.enum([RequestStatus.ACCEPTED, RequestStatus.DECLINED]),
  note: z.string().trim().max(500).optional()
});

const updateDoorSettingsSchema = z.object({
  doorSlug: z.string().trim().min(1),
  autoReplyEnabled: z.boolean(),
  autoReplyMessage: z.string().trim().max(1000).optional(),
  weeklyRequestCap: z.number().int().positive().max(5000).nullable(),
  revealMethod: z.enum([ContactRevealMethod.NONE, ContactRevealMethod.EMAIL, ContactRevealMethod.URL]),
  revealValue: z.string().trim().max(500).nullable(),
  notifyNewRequest: z.boolean().optional(),
  notifyDigest: z.boolean().optional(),
  // Paid door: quote configuration
  paidQuoteAmountCents: z.number().int().min(0).max(100_000_000).nullable().optional(),
  paidQuoteCurrency: z.string().trim().min(3).max(3).toUpperCase().nullable().optional(),
  paidQuoteNote: z.string().trim().max(1000).nullable().optional(),
  quoteVisibleToVerifiedOrgsOnly: z.boolean().optional(),
  openToNonTargetedPaidReach: z.boolean().optional()
});

const updateDoorPlanSchema = z.object({
  doorSlug: z.string().trim().min(1),
  plan: z.enum([DoorPlan.FREE, DoorPlan.PAID])
});

const updateCategorySchema = z.object({
  doorSlug: z.string().trim().min(1),
  categoryKey: z.string().trim().min(1),
  isEnabled: z.boolean(),
  weeklyCap: z.number().int().positive().max(5000).nullable()
});

const updateFieldSchema = z.object({
  doorSlug: z.string().trim().min(1),
  categoryKey: z.string().trim().min(1),
  fieldKey: z.string().trim().min(1),
  required: z.boolean()
});

export class DirectValidationError extends Error {
  readonly statusCode: number;

  constructor(message: string, statusCode = 400) {
    super(message);
    this.statusCode = statusCode;
  }
}

const FREE_DEFAULT_WEEKLY_REQUEST_CAP = 50;
const FREE_DEFAULT_CATEGORY_WEEKLY_CAP = 20;

function normalizeOptional(value?: string | null): string | null {
  if (!value) {
    return null;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function extractEmailAddress(raw: string): string {
  const trimmed = raw.trim();
  const match = trimmed.match(/<?([^<>\s]+@[^<>\s]+)>?/);
  return match?.[1]?.toLowerCase() ?? trimmed.toLowerCase();
}

function extractSenderName(raw: string): string | null {
  const trimmed = raw.trim();
  const match = trimmed.match(/^\s*"?([^"<]+)"?\s*<[^>]+>\s*$/);
  const value = match?.[1]?.trim();
  return value && value.length > 0 ? value : null;
}

function extractAlias(rawTo: string): string {
  const email = extractEmailAddress(rawTo);
  const [localPart] = email.split('@');
  return localPart?.toLowerCase() ?? '';
}

function validateFieldByType(type: CategoryFieldType, value: string): boolean {
  if (value.length === 0) {
    return true;
  }

  if (type === CategoryFieldType.URL) {
    return z.string().url().safeParse(value).success;
  }

  if (type === CategoryFieldType.EMAIL) {
    return z.string().email().safeParse(value).success;
  }

  if (type === CategoryFieldType.NUMBER) {
    return !Number.isNaN(Number(value));
  }

  return true;
}

function stripQuotedAndSignature(text: string): string {
  const lines = text.replace(/\r\n/g, '\n').split('\n');
  const result: string[] = [];

  for (const line of lines) {
    const trimmed = line.trim();

    if (/^On .+wrote:$/i.test(trimmed)) {
      break;
    }

    if (/^From:\s.+<.+>$/i.test(trimmed)) {
      break;
    }

    if (trimmed.startsWith('>')) {
      break;
    }

    if (trimmed === '--' || trimmed === '-- ') {
      break;
    }

    if (/^Sent from my (iPhone|Android|Pixel)/i.test(trimmed)) {
      break;
    }

    result.push(line);
  }

  return result.join('\n').trim();
}

async function enforceDoorWeeklyCap(doorId: string, weeklyCap: number | null | undefined) {
  if (!weeklyCap || weeklyCap <= 0) {
    return;
  }

  const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  const count = await db.request.count({
    where: {
      doorId,
      createdAt: {
        gte: since
      }
    }
  });

  if (count >= weeklyCap) {
    throw new DirectValidationError('Door weekly request cap reached', 429);
  }
}

async function enforceCategoryWeeklyCap(categoryId: string, weeklyCap: number | null | undefined) {
  if (!weeklyCap || weeklyCap <= 0) {
    return;
  }

  const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  const count = await db.request.count({
    where: {
      categoryId,
      createdAt: {
        gte: since
      }
    }
  });

  if (count >= weeklyCap) {
    throw new DirectValidationError('Category weekly request cap reached', 429);
  }
}

async function enforceInboundEmailSenderRateLimit(doorId: string, senderEmail: string) {
  const windowMinutes = Number(process.env.EMAIL_SENDER_RATE_LIMIT_WINDOW_MINUTES ?? 60);
  const maxRequests = Number(process.env.EMAIL_SENDER_RATE_LIMIT_MAX ?? 5);

  if (Number.isNaN(windowMinutes) || Number.isNaN(maxRequests) || windowMinutes <= 0 || maxRequests <= 0) {
    return;
  }

  const since = new Date(Date.now() - windowMinutes * 60 * 1000);
  const count = await db.request.count({
    where: {
      doorId,
      source: RequestSource.EMAIL,
      senderEmail,
      createdAt: {
        gte: since
      }
    }
  });

  if (count >= maxRequests) {
    throw new DirectValidationError('Inbound sender rate limit reached', 429);
  }
}

// ---------------------------------------------------------------------------
// Public entry abuse controls
// ---------------------------------------------------------------------------

const FORM_IP_RATE_LIMIT_WINDOW_MINUTES = 15;
const FORM_IP_RATE_LIMIT_MAX = 10;
const FORM_SENDER_RATE_LIMIT_WINDOW_MINUTES = 60;
const FORM_SENDER_RATE_LIMIT_MAX = 5;

// Global IP rate limit — prevents a single IP from fanning out across many doors
const GLOBAL_IP_RATE_LIMIT_WINDOW_MINUTES = 15;
const GLOBAL_IP_RATE_LIMIT_MAX = 30;

function hashForRateLimit(value: string): string {
  return crypto.createHash('sha256').update(value).digest('hex');
}

async function enforceFormIPRateLimit(doorId: string, ipHash: string) {
  const windowMinutes = Number(process.env.FORM_IP_RATE_LIMIT_WINDOW_MINUTES ?? FORM_IP_RATE_LIMIT_WINDOW_MINUTES);
  const maxRequests = Number(process.env.FORM_IP_RATE_LIMIT_MAX ?? FORM_IP_RATE_LIMIT_MAX);

  if (Number.isNaN(windowMinutes) || Number.isNaN(maxRequests) || windowMinutes <= 0 || maxRequests <= 0) {
    return;
  }

  const since = new Date(Date.now() - windowMinutes * 60 * 1000);
  const count = await db.request.count({
    where: {
      doorId,
      ipHash,
      createdAt: { gte: since }
    }
  });

  if (count >= maxRequests) {
    throw new DirectValidationError('Too many requests from this address. Try again later.', 429);
  }
}

async function enforceGlobalIPRateLimit(ipHash: string) {
  const windowMinutes = Number(process.env.GLOBAL_IP_RATE_LIMIT_WINDOW_MINUTES ?? GLOBAL_IP_RATE_LIMIT_WINDOW_MINUTES);
  const maxRequests = Number(process.env.GLOBAL_IP_RATE_LIMIT_MAX ?? GLOBAL_IP_RATE_LIMIT_MAX);

  if (Number.isNaN(windowMinutes) || Number.isNaN(maxRequests) || windowMinutes <= 0 || maxRequests <= 0) {
    return;
  }

  const since = new Date(Date.now() - windowMinutes * 60 * 1000);
  const count = await db.request.count({
    where: {
      ipHash,
      createdAt: { gte: since }
    }
  });

  if (count >= maxRequests) {
    throw new DirectValidationError('Too many requests from this address. Try again later.', 429);
  }
}

async function enforceFormSenderRateLimit(doorId: string, senderEmail: string) {
  const windowMinutes = Number(process.env.FORM_SENDER_RATE_LIMIT_WINDOW_MINUTES ?? FORM_SENDER_RATE_LIMIT_WINDOW_MINUTES);
  const maxRequests = Number(process.env.FORM_SENDER_RATE_LIMIT_MAX ?? FORM_SENDER_RATE_LIMIT_MAX);

  if (Number.isNaN(windowMinutes) || Number.isNaN(maxRequests) || windowMinutes <= 0 || maxRequests <= 0) {
    return;
  }

  const since = new Date(Date.now() - windowMinutes * 60 * 1000);
  const count = await db.request.count({
    where: {
      doorId,
      source: RequestSource.FORM,
      senderEmail: senderEmail.toLowerCase(),
      createdAt: { gte: since }
    }
  });

  if (count >= maxRequests) {
    throw new DirectValidationError('Too many requests from this email. Try again later.', 429);
  }
}

async function enforceBlocklist(doorId: string, senderEmail: string | null | undefined) {
  if (!senderEmail) {
    return;
  }

  const blocked = await db.doorBlockedSender.findUnique({
    where: {
      doorId_email: {
        doorId,
        email: senderEmail.toLowerCase()
      }
    },
    select: { id: true }
  });

  if (blocked) {
    // Return generic message — don't reveal blocklist existence
    throw new DirectValidationError('Unable to submit request at this time.', 403);
  }
}

// ---------------------------------------------------------------------------
// Notification helpers (fire-and-forget — never block the main flow)
// ---------------------------------------------------------------------------

type KeeperDoorInfo = {
  slug: string;
  displayName: string;
  keeperEmail: string | null;
  notifyNewRequest: boolean;
};

function sendNewRequestNotification(
  door: KeeperDoorInfo,
  request: {
    categoryLabel: string | null;
    senderName: string | null;
    senderEmail: string | null;
    title: string | null;
    messagePreview: string;
  }
) {
  if (!door.keeperEmail) return;
  // Respect keeper notification preference
  if (!door.notifyNewRequest) return;

  notifyKeeperNewRequest({
    keeperEmail: door.keeperEmail,
    doorName: door.displayName,
    doorSlug: door.slug,
    categoryLabel: request.categoryLabel,
    senderName: request.senderName,
    senderEmail: request.senderEmail,
    title: request.title,
    messagePreview: request.messagePreview
  }).catch((err) => {
    console.error('[notification:new-request-failed]', err);
  });
}

export async function createFormRequest(
  input: unknown,
  options?: { ipAddress?: string | null; cfTurnstileToken?: string | null; honeypot?: string | null }
) {
  const endTimer = startTimer(METRIC.REQUEST_CREATION_MS);

  // Honeypot check — bots auto-fill hidden fields, humans leave them empty
  if (options?.honeypot && options.honeypot.trim().length > 0) {
    increment(METRIC.HONEYPOT_TRIGGERED);
    throw new DirectValidationError('Unable to submit request at this time.', 403);
  }

  // Turnstile CAPTCHA verification (skipped when not configured)
  const turnstileResult = await verifyTurnstileToken(options?.cfTurnstileToken, options?.ipAddress);
  if (!turnstileResult.ok) {
    throw new DirectValidationError(turnstileResult.error, 403);
  }

  const payload = formRequestSchema.parse(input);

  const door = await db.door.findUnique({
    where: { slug: payload.doorSlug },
    select: {
      id: true,
      slug: true,
      displayName: true,
      isEnabled: true,
      plan: true,
      user: { select: { email: true } },
      settings: {
        select: { weeklyRequestCap: true, notifyNewRequest: true }
      },
      categories: {
        where: { key: payload.categoryKey, isEnabled: true },
        select: {
          id: true,
          key: true,
          weeklyCap: true,
          fields: {
            select: {
              key: true,
              label: true,
              type: true,
              required: true
            }
          }
        }
      }
    }
  });

  if (!door || !door.isEnabled) {
    throw new DirectValidationError('Door unavailable');
  }

  const category = door.categories[0];
  if (!category) {
    throw new DirectValidationError('Category unavailable');
  }

  // Paid doors require senderEmail for verification
  const normalizedSenderEmail = normalizeOptional(payload.senderEmail);
  if (door.plan === DoorPlan.PAID && !normalizedSenderEmail) {
    throw new DirectValidationError('Email is required for paid doors');
  }

  // Abuse controls: blocklist → IP rate limit → sender rate limit → caps
  await enforceBlocklist(door.id, normalizedSenderEmail);

  const ipHash = options?.ipAddress ? hashForRateLimit(options.ipAddress) : null;
  if (ipHash) {
    await enforceGlobalIPRateLimit(ipHash);
    await enforceFormIPRateLimit(door.id, ipHash);
  }

  if (normalizedSenderEmail) {
    await enforceFormSenderRateLimit(door.id, normalizedSenderEmail);
  }

  if (door.plan === DoorPlan.FREE) {
    await enforceDoorWeeklyCap(door.id, door.settings?.weeklyRequestCap);
    await enforceCategoryWeeklyCap(category.id, category.weeklyCap);
  }

  const sanitizedFields: Record<string, string> = {};
  for (const field of category.fields) {
    const value = (payload.fields[field.key] ?? '').trim();

    if (field.required && value.length === 0) {
      throw new DirectValidationError(`Missing required field: ${field.label}`);
    }

    if (!validateFieldByType(field.type, value)) {
      throw new DirectValidationError(`Invalid value for ${field.label}`);
    }

    if (value.length > 0) {
      sanitizedFields[field.key] = value;
    }
  }

  // Compute requester verification status (V1 — deterministic, no external KYC)
  const verification = await computeVerificationStatus({
    senderEmail: normalizedSenderEmail,
    requesterType: payload.requesterType,
    requesterOrgName: payload.requesterOrgName,
    requesterOrgWebsite: payload.requesterOrgWebsite,
    requesterRoleTitle: payload.requesterRoleTitle
  });

  const created = await db.request.create({
    data: {
      doorId: door.id,
      categoryId: category.id,
      source: RequestSource.FORM,
      status: RequestStatus.PENDING,
      senderName: normalizeOptional(payload.senderName),
      senderEmail: normalizedSenderEmail,
      ipHash,
      title: normalizeOptional(payload.title),
      message: payload.message,
      structuredData: sanitizedFields,
      requesterType: payload.requesterType,
      requesterOrgName: normalizeOptional(payload.requesterOrgName),
      requesterOrgWebsite: normalizeOptional(payload.requesterOrgWebsite),
      requesterRoleTitle: normalizeOptional(payload.requesterRoleTitle),
      requesterVerificationStatus: verification.status,
      requesterVerificationReason: verification.reason,
      events: {
        create: {
          type: RequestEventType.CREATED,
          actor: RequestEventActor.SYSTEM,
          note: 'Form submission created request'
        }
      }
    },
    select: {
      id: true,
      requestToken: true,
      status: true,
      requesterVerificationStatus: true
    }
  });

  increment(METRIC.REQUEST_FORM_CREATED);
  endTimer();
  log.info('Form request created', { requestId: created.id, door: door.slug, category: category.key });

  // Fire-and-forget: notify keeper of new request
  sendNewRequestNotification(
    {
      slug: door.slug,
      displayName: door.displayName,
      keeperEmail: door.user?.email ?? null,
      notifyNewRequest: door.settings?.notifyNewRequest ?? true
    },
    {
      categoryLabel: category.key,
      senderName: normalizeOptional(payload.senderName),
      senderEmail: normalizedSenderEmail,
      title: normalizeOptional(payload.title),
      messagePreview: payload.message
    }
  );

  return created;
}

const COMPLETION_TOKEN_EXPIRY_HOURS = 72;

function generateCompletionToken(): string {
  return crypto.randomBytes(32).toString('hex');
}

function hasRequiredFields(
  categories: Array<{
    fields: Array<{ required: boolean }>;
  }>
): boolean {
  return categories.some((cat) => cat.fields.some((f) => f.required));
}

export async function createEmailRequest(input: unknown) {
  const endTimer = startTimer(METRIC.REQUEST_CREATION_MS);
  increment(METRIC.EMAIL_INBOUND_RECEIVED);
  const payload = emailRequestSchema.parse(input);

  if ((payload.cc?.length ?? 0) > 0 || (payload.bcc?.length ?? 0) > 0) {
    increment(METRIC.EMAIL_INBOUND_REJECTED);
    throw new DirectValidationError('CC/BCC not supported');
  }

  if ((payload.attachments?.length ?? 0) > 0) {
    increment(METRIC.EMAIL_INBOUND_REJECTED);
    throw new DirectValidationError('Attachments not supported');
  }

  const alias = extractAlias(payload.to);
  if (!alias) {
    throw new DirectValidationError('Unable to resolve email alias');
  }

  const emailAlias = await db.emailAlias.findUnique({
    where: { alias },
    select: {
      alias: true,
      isEnabled: true,
      door: {
        select: {
          id: true,
          slug: true,
          isEnabled: true,
          plan: true,
          displayName: true,
          user: { select: { email: true } },
          settings: {
            select: {
              weeklyRequestCap: true,
              autoReplyEnabled: true,
              autoReplyMessage: true,
              notifyNewRequest: true
            }
          },
          categories: {
            where: { isEnabled: true },
            select: {
              id: true,
              key: true,
              label: true,
              fields: {
                select: {
                  key: true,
                  required: true
                }
              }
            }
          }
        }
      }
    }
  });

  if (!emailAlias?.isEnabled || !emailAlias.door.isEnabled) {
    throw new DirectValidationError('Alias unavailable');
  }

  const senderEmail = extractEmailAddress(payload.from);
  const senderName = extractSenderName(payload.from);

  // Abuse controls: blocklist first, then rate limits
  await enforceBlocklist(emailAlias.door.id, senderEmail);

  if (emailAlias.door.plan === DoorPlan.FREE) {
    await enforceDoorWeeklyCap(emailAlias.door.id, emailAlias.door.settings?.weeklyRequestCap);
    await enforceInboundEmailSenderRateLimit(emailAlias.door.id, senderEmail);
  }

  const cleanedMessage = stripQuotedAndSignature(payload.text);
  if (!cleanedMessage) {
    throw new DirectValidationError('Email body is empty after quote/signature stripping');
  }

  // Detect whether any enabled category has required fields
  const requiresCompletion = hasRequiredFields(emailAlias.door.categories);

  const completionToken = requiresCompletion ? generateCompletionToken() : null;
  const completionExpiresAt = requiresCompletion
    ? new Date(Date.now() + COMPLETION_TOKEN_EXPIRY_HOURS * 60 * 60 * 1000)
    : null;

  const status = requiresCompletion
    ? RequestStatus.AWAITING_COMPLETION
    : RequestStatus.PENDING;

  // Email requests are always INDIVIDUAL — run through full verification logic
  // to ensure free/disposable domain senders are correctly marked UNVERIFIED
  const emailVerification = await computeVerificationStatus({
    senderEmail: senderEmail || null,
    requesterType: 'INDIVIDUAL',
  });

  const created = await db.request.create({
    data: {
      doorId: emailAlias.door.id,
      source: RequestSource.EMAIL,
      status,
      senderName,
      senderEmail,
      title: normalizeOptional(payload.subject),
      message: cleanedMessage,
      completionToken,
      completionExpiresAt,
      requesterType: 'INDIVIDUAL',
      requesterVerificationStatus: emailVerification.status,
      requesterVerificationReason: emailVerification.reason,
      structuredData: {
        _emailMeta: {
          to: payload.to,
          from: payload.from,
          alias: emailAlias.alias
        }
      },
      events: {
        create: {
          type: RequestEventType.CREATED,
          actor: RequestEventActor.SYSTEM,
          note: requiresCompletion
            ? 'Inbound email created request — awaiting form completion'
            : 'Inbound email created request'
        }
      }
    },
    select: {
      id: true,
      requestToken: true,
      status: true,
      completionToken: true
    }
  });

  const appUrl = process.env.APP_URL ?? 'http://localhost:3000';
  const normalizedTitle = normalizeOptional(payload.subject);

  if (requiresCompletion) {
    // Fire-and-forget: email the sender with the completion link
    const completionUrl = `${appUrl}/complete/${completionToken}`;
    notifyKnockerCompletionRequired({
      knockerEmail: senderEmail,
      doorName: emailAlias.door.displayName,
      completionUrl,
      subject: normalizedTitle
    }).catch((err) => {
      console.error('[notification:completion-required-failed]', err);
    });
  } else {
    // Fire-and-forget: notify keeper of new email request
    sendNewRequestNotification(
      {
        slug: emailAlias.door.slug,
        displayName: emailAlias.door.displayName,
        keeperEmail: emailAlias.door.user?.email ?? null,
        notifyNewRequest: emailAlias.door.settings?.notifyNewRequest ?? true
      },
      {
        categoryLabel: null,
        senderName,
        senderEmail,
        title: normalizedTitle,
        messagePreview: cleanedMessage
      }
    );

    // Fire-and-forget: send auto-reply to sender if enabled
    if (emailAlias.door.settings?.autoReplyEnabled && senderEmail) {
      notifyKnockerAutoReply({
        knockerEmail: senderEmail,
        doorName: emailAlias.door.displayName,
        autoReplyMessage: emailAlias.door.settings.autoReplyMessage,
        subject: normalizedTitle
      }).catch((err) => {
        console.error('[notification:auto-reply-failed]', err);
      });
    }
  }

  increment(METRIC.REQUEST_EMAIL_CREATED);
  endTimer();
  log.info('Email request created', { requestId: created.id, alias, requiresCompletion });

  return {
    ...created,
    completionRequired: requiresCompletion,
    completionUrl: requiresCompletion
      ? `${appUrl}/complete/${completionToken}`
      : null
  };
}

// ---------------------------------------------------------------------------
// Email completion (required-field form submission via completion link)
// ---------------------------------------------------------------------------

const emailCompletionSchema = z.object({
  completionToken: z.string().trim().min(1),
  categoryKey: z.string().trim().min(1),
  fields: z.record(z.string(), z.string()).default({})
});

type CompletionLookupResult =
  | null
  | { status: 'expired'; reason: 'already_completed' | 'token_expired' }
  | {
      status: 'ready';
      request: {
        senderName: string | null;
        senderEmail: string | null;
        title: string | null;
        message: string;
        door: {
          slug: string;
          displayName: string;
          headline: string | null;
          categories: Array<{
            key: string;
            label: string;
            description: string | null;
            fields: Array<{
              key: string;
              label: string;
              type: 'TEXT' | 'TEXTAREA' | 'NUMBER' | 'URL' | 'EMAIL';
              required: boolean;
              placeholder: string | null;
            }>;
          }>;
        };
      };
    };

export async function getRequestForCompletion(completionToken: string): Promise<CompletionLookupResult> {
  const request = await db.request.findUnique({
    where: { completionToken },
    select: {
      id: true,
      status: true,
      senderName: true,
      senderEmail: true,
      title: true,
      message: true,
      completionExpiresAt: true,
      door: {
        select: {
          slug: true,
          displayName: true,
          headline: true,
          categories: {
            where: { isEnabled: true },
            orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
            select: {
              key: true,
              label: true,
              description: true,
              fields: {
                orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
                select: {
                  key: true,
                  label: true,
                  type: true,
                  required: true,
                  placeholder: true
                }
              }
            }
          }
        }
      }
    }
  });

  if (!request) {
    return null;
  }

  if (request.status !== RequestStatus.AWAITING_COMPLETION) {
    return { status: 'expired', reason: 'already_completed' };
  }

  if (request.completionExpiresAt && request.completionExpiresAt < new Date()) {
    return { status: 'expired', reason: 'token_expired' };
  }

  return {
    status: 'ready',
    request: {
      senderName: request.senderName,
      senderEmail: request.senderEmail,
      title: request.title,
      message: request.message,
      door: request.door
    }
  };
}

export async function completeEmailRequest(
  input: unknown,
  options?: { ipAddress?: string | null; cfTurnstileToken?: string | null; honeypot?: string | null }
) {
  // Honeypot check
  if (options?.honeypot && options.honeypot.trim().length > 0) {
    throw new DirectValidationError('Unable to submit request at this time.', 403);
  }

  // Turnstile CAPTCHA verification (skipped when not configured)
  const turnstileResult = await verifyTurnstileToken(options?.cfTurnstileToken, options?.ipAddress);
  if (!turnstileResult.ok) {
    throw new DirectValidationError(turnstileResult.error, 403);
  }

  const payload = emailCompletionSchema.parse(input);

  const request = await db.request.findUnique({
    where: { completionToken: payload.completionToken },
    select: {
      id: true,
      status: true,
      doorId: true,
      senderEmail: true,
      completionExpiresAt: true,
      structuredData: true,
      door: {
        select: {
          slug: true,
          displayName: true,
          plan: true,
          user: { select: { email: true } },
          settings: {
            select: {
              autoReplyEnabled: true,
              autoReplyMessage: true,
              notifyNewRequest: true,
              weeklyRequestCap: true
            }
          },
          categories: {
            where: { key: payload.categoryKey, isEnabled: true },
            select: {
              id: true,
              key: true,
              weeklyCap: true,
              fields: {
                select: {
                  key: true,
                  label: true,
                  type: true,
                  required: true
                }
              }
            }
          }
        }
      }
    }
  });

  if (!request) {
    throw new DirectValidationError('Invalid completion token');
  }

  if (request.status !== RequestStatus.AWAITING_COMPLETION) {
    throw new DirectValidationError('Request already completed', 409);
  }

  if (request.completionExpiresAt && request.completionExpiresAt < new Date()) {
    throw new DirectValidationError('Completion link has expired', 410);
  }

  // Re-check blocklist — sender may have been blocked since original email
  await enforceBlocklist(request.doorId, request.senderEmail);

  // Re-check caps — up to 72h may have passed since the original email
  if (request.door.plan === DoorPlan.FREE) {
    await enforceDoorWeeklyCap(request.doorId, request.door.settings?.weeklyRequestCap);
  }

  const category = request.door.categories[0];
  if (!category) {
    throw new DirectValidationError('Category unavailable');
  }

  if (request.door.plan === DoorPlan.FREE) {
    await enforceCategoryWeeklyCap(category.id, category.weeklyCap);
  }

  // Validate required fields
  const sanitizedFields: Record<string, string> = {};
  for (const field of category.fields) {
    const value = (payload.fields[field.key] ?? '').trim();

    if (field.required && value.length === 0) {
      throw new DirectValidationError(`Missing required field: ${field.label}`);
    }

    if (!validateFieldByType(field.type, value)) {
      throw new DirectValidationError(`Invalid value for ${field.label}`);
    }

    if (value.length > 0) {
      sanitizedFields[field.key] = value;
    }
  }

  // Preserve email metadata from original structuredData
  const existingData = (request.structuredData as Record<string, unknown> | null) ?? {};
  const mergedData: Record<string, string | Record<string, string>> = { ...sanitizedFields };
  if (existingData._emailMeta && typeof existingData._emailMeta === 'object') {
    mergedData._emailMeta = existingData._emailMeta as Record<string, string>;
  }

  // Transition to PENDING with structured data, clear completion token
  const completed = await db.request.update({
    where: { id: request.id },
    data: {
      status: RequestStatus.PENDING,
      categoryId: category.id,
      structuredData: mergedData,
      completionToken: null,
      completionExpiresAt: null,
      events: {
        create: {
          type: RequestEventType.CREATED,
          actor: RequestEventActor.SYSTEM,
          note: 'Email sender completed required fields via form'
        }
      }
    },
    select: {
      id: true,
      requestToken: true,
      status: true,
      senderName: true,
      senderEmail: true,
      title: true,
      message: true
    }
  });

  // Fire-and-forget: notify keeper of new request
  sendNewRequestNotification(
    {
      slug: request.door.slug,
      displayName: request.door.displayName,
      keeperEmail: request.door.user?.email ?? null,
      notifyNewRequest: request.door.settings?.notifyNewRequest ?? true
    },
    {
      categoryLabel: category.key,
      senderName: completed.senderName,
      senderEmail: completed.senderEmail,
      title: completed.title,
      messagePreview: completed.message
    }
  );

  // Fire-and-forget: send auto-reply to knocker if enabled
  if (request.door.settings?.autoReplyEnabled && request.senderEmail) {
    notifyKnockerAutoReply({
      knockerEmail: request.senderEmail,
      doorName: request.door.displayName,
      autoReplyMessage: request.door.settings.autoReplyMessage,
      subject: completed.title
    }).catch((err) => {
      console.error('[notification:auto-reply-after-completion-failed]', err);
    });
  }

  return {
    id: completed.id,
    requestToken: completed.requestToken,
    status: completed.status
  };
}

export async function updateRequestStatusForKeeper(userId: string, requestId: string, input: unknown) {
  const payload = updateStatusSchema.parse(input);

  const existing = await db.request.findUnique({
    where: { id: requestId },
    select: {
      id: true,
      status: true,
      senderEmail: true,
      requestToken: true,
      door: {
        select: {
          userId: true,
          slug: true,
          displayName: true,
          settings: {
            select: {
              revealMethod: true,
              revealValue: true,
              paidQuoteAmountCents: true,
              paidQuoteCurrency: true,
              paidQuoteNote: true
            }
          }
        }
      }
    }
  });

  if (!existing || existing.door.userId !== userId) {
    throw new DirectValidationError('Request not found');
  }

  const actionableStatuses: RequestStatus[] = [RequestStatus.PENDING, RequestStatus.AWAITING_COMPLETION];
  if (!actionableStatuses.includes(existing.status as RequestStatus)) {
    throw new DirectValidationError('Request already finalized');
  }

  // Only allow decline (not accept) for AWAITING_COMPLETION requests
  if (existing.status === RequestStatus.AWAITING_COMPLETION && payload.status === RequestStatus.ACCEPTED) {
    throw new DirectValidationError('Cannot accept a request that is still awaiting completion');
  }

  const eventType =
    payload.status === RequestStatus.ACCEPTED ? RequestEventType.ACCEPTED : RequestEventType.DECLINED;

  const keeperNote = normalizeOptional(payload.note);

  const updateData: Record<string, unknown> = {
    status: payload.status,
    events: {
      create: {
        type: eventType,
        actor: RequestEventActor.KEEPER,
        note: keeperNote
      }
    }
  };

  // Snapshot quote fields from door settings onto request on acceptance
  if (payload.status === RequestStatus.ACCEPTED && existing.door.settings) {
    const { paidQuoteAmountCents, paidQuoteCurrency, paidQuoteNote } = existing.door.settings;
    if (paidQuoteAmountCents != null) {
      updateData.keeperQuoteAmountCents = paidQuoteAmountCents;
      updateData.keeperQuoteCurrency = paidQuoteCurrency ?? 'USD';
      updateData.keeperQuoteNote = paidQuoteNote ?? null;
    }
  }

  // Clear completion token when declining an AWAITING_COMPLETION request
  if (existing.status === RequestStatus.AWAITING_COMPLETION) {
    updateData.completionToken = null;
    updateData.completionExpiresAt = null;
  }

  const updated = await db.request.update({
    where: { id: requestId },
    data: updateData,
    select: { id: true, status: true }
  });

  if (payload.status === RequestStatus.ACCEPTED) {
    increment(METRIC.REQUEST_ACCEPTED);
    log.info('Request accepted', { requestId, doorSlug: existing.door.slug });
  } else {
    increment(METRIC.REQUEST_DECLINED);
    log.info('Request declined', { requestId, doorSlug: existing.door.slug });
  }

  // Fire-and-forget: notify knocker on acceptance
  if (payload.status === RequestStatus.ACCEPTED && existing.senderEmail) {
    notifyKnockerAccepted({
      knockerEmail: existing.senderEmail,
      doorName: existing.door.displayName,
      requestToken: existing.requestToken,
      revealMethod: existing.door.settings?.revealMethod ?? 'NONE',
      revealValue: existing.door.settings?.revealValue ?? null,
      keeperNote
    }).catch((err) => {
      console.error('[notification:accepted-failed]', err);
    });
  }

  return updated;
}

const DEFAULT_PAGE_SIZE = 20;
const MAX_PAGE_SIZE = 100;

export async function listRequestsByDoorSlugForKeeper(
  userId: string,
  doorSlug: string,
  options?: { page?: number; pageSize?: number; status?: RequestStatus }
) {
  const page = Math.max(1, options?.page ?? 1);
  const pageSize = Math.min(MAX_PAGE_SIZE, Math.max(1, options?.pageSize ?? DEFAULT_PAGE_SIZE));
  const skip = (page - 1) * pageSize;

  const statusFilter = options?.status ? { status: options.status } : {};

  const door = await db.door.findFirst({
    where: { slug: doorSlug, userId },
    select: {
      id: true,
      slug: true,
      displayName: true,
      plan: true,
      settings: {
        select: {
          autoReplyEnabled: true,
          autoReplyMessage: true,
          weeklyRequestCap: true,
          revealMethod: true,
          revealValue: true,
          notifyNewRequest: true,
          notifyDigest: true,
          paidQuoteAmountCents: true,
          paidQuoteCurrency: true,
          paidQuoteNote: true,
          quoteVisibleToVerifiedOrgsOnly: true,
          openToNonTargetedPaidReach: true
        }
      },
      categories: {
        orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
        select: {
          key: true,
          label: true,
          isEnabled: true,
          weeklyCap: true,
          fields: {
            orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
            select: {
              key: true,
              label: true,
              required: true
            }
          }
        }
      },
      emailAliases: {
        select: {
          alias: true,
          isEnabled: true
        }
      }
    }
  });

  if (!door) {
    return null;
  }

  // Fetch filtered count + per-status counts in parallel for fast inbox summary
  const statusCountsRaw = await db.request.groupBy({
    by: ['status'],
    where: { doorId: door.id },
    _count: { status: true }
  });

  const statusCounts: Record<string, number> = {};
  let grandTotal = 0;
  for (const row of statusCountsRaw) {
    statusCounts[row.status] = row._count.status;
    grandTotal += row._count.status;
  }

  const totalCount = options?.status
    ? (statusCounts[options.status] ?? 0)
    : grandTotal;

  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));
  const clampedPage = Math.min(page, totalPages);
  const clampedSkip = (clampedPage - 1) * pageSize;

  const requests = await db.request.findMany({
    where: { doorId: door.id, ...statusFilter },
    orderBy: { createdAt: 'desc' },
    skip: clampedSkip,
    take: pageSize,
    select: {
      id: true,
      source: true,
      status: true,
      senderName: true,
      senderEmail: true,
      title: true,
      message: true,
      requestToken: true,
      createdAt: true,
      category: {
        select: { label: true }
      }
    }
  });

  return {
    ...door,
    requests,
    pagination: {
      page: clampedPage,
      pageSize,
      totalCount,
      totalPages
    },
    statusCounts
  };
}

export async function getRequestDetailForKeeper(userId: string, requestId: string) {
  const request = await db.request.findUnique({
    where: { id: requestId },
    select: {
      id: true,
      source: true,
      status: true,
      senderName: true,
      senderEmail: true,
      title: true,
      message: true,
      structuredData: true,
      requestToken: true,
      completionExpiresAt: true,
      createdAt: true,
      updatedAt: true,
      // Requester verification fields
      requesterType: true,
      requesterOrgName: true,
      requesterOrgWebsite: true,
      requesterRoleTitle: true,
      requesterVerificationStatus: true,
      requesterVerificationReason: true,
      // Quote snapshot (populated on acceptance)
      keeperQuoteAmountCents: true,
      keeperQuoteCurrency: true,
      keeperQuoteNote: true,
      category: {
        select: { key: true, label: true }
      },
      events: {
        orderBy: { createdAt: 'asc' },
        select: {
          id: true,
          type: true,
          actor: true,
          note: true,
          createdAt: true
        }
      },
      door: {
        select: {
          userId: true,
          slug: true,
          displayName: true,
          settings: {
            select: {
              revealMethod: true,
              revealValue: true,
              paidQuoteAmountCents: true,
              paidQuoteCurrency: true,
              paidQuoteNote: true,
              quoteVisibleToVerifiedOrgsOnly: true,
              openToNonTargetedPaidReach: true
            }
          }
        }
      }
    }
  });

  if (!request || request.door.userId !== userId) {
    return null;
  }

  return request;
}

export async function listDoorsForKeeper(userId: string) {
  return db.door.findMany({
    where: { userId },
    orderBy: { createdAt: 'asc' },
    select: {
      slug: true,
      displayName: true,
      plan: true
    }
  });
}

export async function updateDoorPlanForKeeper(userId: string, input: unknown) {
  const payload = updateDoorPlanSchema.parse(input);

  const door = await db.door.findFirst({
    where: { slug: payload.doorSlug, userId },
    select: { id: true, plan: true }
  });

  if (!door) {
    throw new DirectValidationError('Door not found');
  }

  if (door.plan === payload.plan) {
    return { plan: door.plan };
  }

  await db.$transaction(async (tx) => {
    await tx.door.update({
      where: { id: door.id },
      data: {
        plan: payload.plan,
        headline:
          payload.plan === DoorPlan.PAID
            ? 'Paid opportunities only. Send complete details for priority review.'
            : 'Send a structured request. Noise stays out.'
      }
    });

    if (payload.plan === DoorPlan.PAID) {
      await tx.doorSettings.upsert({
        where: { doorId: door.id },
        update: { weeklyRequestCap: null },
        create: {
          doorId: door.id,
          autoReplyEnabled: false,
          weeklyRequestCap: null
        }
      });

      await tx.category.updateMany({
        where: { doorId: door.id },
        data: { weeklyCap: null }
      });

      return;
    }

    await tx.doorSettings.upsert({
      where: { doorId: door.id },
      update: {
        weeklyRequestCap: FREE_DEFAULT_WEEKLY_REQUEST_CAP
      },
      create: {
        doorId: door.id,
        autoReplyEnabled: false,
        weeklyRequestCap: FREE_DEFAULT_WEEKLY_REQUEST_CAP
      }
    });

    await tx.category.updateMany({
      where: {
        doorId: door.id,
        weeklyCap: null
      },
      data: {
        weeklyCap: FREE_DEFAULT_CATEGORY_WEEKLY_CAP
      }
    });
  });

  return { plan: payload.plan };
}

export async function updateDoorSettingsForKeeper(userId: string, input: unknown) {
  const payload = updateDoorSettingsSchema.parse(input);

  const door = await db.door.findFirst({
    where: { slug: payload.doorSlug, userId },
    select: { id: true, plan: true }
  });

  if (!door) {
    throw new DirectValidationError('Door not found');
  }

  const normalizedWeeklyCap = door.plan === DoorPlan.PAID ? null : payload.weeklyRequestCap;

  const notificationFields = {
    ...(payload.notifyNewRequest !== undefined && { notifyNewRequest: payload.notifyNewRequest }),
    ...(payload.notifyDigest !== undefined && { notifyDigest: payload.notifyDigest })
  };

  // Paid quote fields — only apply when explicitly provided in payload
  const paidQuoteFields = {
    ...(payload.paidQuoteAmountCents !== undefined && {
      paidQuoteAmountCents: payload.paidQuoteAmountCents
    }),
    ...(payload.paidQuoteCurrency !== undefined && {
      paidQuoteCurrency: payload.paidQuoteCurrency ? payload.paidQuoteCurrency : null
    }),
    ...(payload.paidQuoteNote !== undefined && {
      paidQuoteNote: payload.paidQuoteNote ? normalizeOptional(payload.paidQuoteNote) : null
    }),
    ...(payload.quoteVisibleToVerifiedOrgsOnly !== undefined && {
      quoteVisibleToVerifiedOrgsOnly: payload.quoteVisibleToVerifiedOrgsOnly
    }),
    ...(payload.openToNonTargetedPaidReach !== undefined && {
      openToNonTargetedPaidReach: payload.openToNonTargetedPaidReach
    })
  };

  return db.doorSettings.upsert({
    where: { doorId: door.id },
    update: {
      autoReplyEnabled: payload.autoReplyEnabled,
      autoReplyMessage: normalizeOptional(payload.autoReplyMessage),
      weeklyRequestCap: normalizedWeeklyCap,
      revealMethod: payload.revealMethod,
      revealValue: normalizeOptional(payload.revealValue),
      ...notificationFields,
      ...paidQuoteFields
    },
    create: {
      doorId: door.id,
      autoReplyEnabled: payload.autoReplyEnabled,
      autoReplyMessage: normalizeOptional(payload.autoReplyMessage),
      weeklyRequestCap: normalizedWeeklyCap,
      revealMethod: payload.revealMethod,
      revealValue: normalizeOptional(payload.revealValue),
      ...notificationFields,
      ...paidQuoteFields
    }
  });
}

export async function updateCategoryForKeeper(userId: string, input: unknown) {
  const payload = updateCategorySchema.parse(input);

  const category = await db.category.findFirst({
    where: {
      key: payload.categoryKey,
      door: {
        slug: payload.doorSlug,
        userId
      }
    },
    select: {
      id: true,
      door: {
        select: {
          plan: true
        }
      }
    }
  });

  if (!category) {
    throw new DirectValidationError('Category not found');
  }

  return db.category.update({
    where: { id: category.id },
    data: {
      isEnabled: payload.isEnabled,
      weeklyCap: category.door.plan === DoorPlan.PAID ? null : payload.weeklyCap
    }
  });
}

const DEFAULT_EXPIRY_DAYS = 30;

export async function expireStaleRequests(options?: { expiryDays?: number; batchSize?: number }) {
  const expiryDays = options?.expiryDays ?? DEFAULT_EXPIRY_DAYS;
  const batchSize = options?.batchSize ?? 200;

  const cutoff = new Date(Date.now() - expiryDays * 24 * 60 * 60 * 1000);
  const now = new Date();

  const selectFields = {
    id: true,
    senderEmail: true,
    requestToken: true,
    door: { select: { displayName: true } }
  } as const;

  // Two targeted queries — each uses its optimal index, full batchSize each
  // to avoid under-fetching when one category has few/no stale records
  const [stalePending, staleCompletion] = await Promise.all([
    db.request.findMany({
      where: { status: RequestStatus.PENDING, createdAt: { lt: cutoff } },
      select: selectFields,
      take: batchSize
    }),
    db.request.findMany({
      where: { status: RequestStatus.AWAITING_COMPLETION, completionExpiresAt: { lt: now } },
      select: selectFields,
      take: batchSize
    })
  ]);

  // Deduplicate (shouldn't overlap, but defensive)
  const seenIds = new Set<string>();
  const stale = [...stalePending, ...staleCompletion].filter((r) => {
    if (seenIds.has(r.id)) return false;
    seenIds.add(r.id);
    return true;
  });

  if (stale.length === 0) {
    return { expired: 0 };
  }

  const ids = stale.map((r) => r.id);

  // Batch update status + create events in a transaction
  // Note: Prisma updateMany does NOT trigger @updatedAt, so we set it explicitly
  const result = await db.$transaction(async (tx) => {
    const updated = await tx.request.updateMany({
      where: {
        id: { in: ids },
        status: { in: [RequestStatus.PENDING, RequestStatus.AWAITING_COMPLETION] }
      },
      data: {
        status: RequestStatus.EXPIRED,
        completionToken: null,
        completionExpiresAt: null,
        updatedAt: now
      }
    });

    // Create expiration events for each
    await tx.requestEvent.createMany({
      data: ids.map((requestId) => ({
        requestId,
        type: RequestEventType.EXPIRED,
        actor: RequestEventActor.SYSTEM,
        note: `Auto-expired after ${expiryDays} days`
      }))
    });

    return updated.count;
  });

  // Fire-and-forget: notify knockers whose requests expired (bounded concurrency)
  const expirationTasks = stale
    .filter((req) => req.senderEmail)
    .map((req) => () =>
      notifyKnockerExpired({
        knockerEmail: req.senderEmail!,
        doorName: req.door.displayName,
        requestToken: req.requestToken
      })
    );

  if (expirationTasks.length > 0) {
    sendBatch(expirationTasks, 5).catch((err) => {
      console.error('[notification:expired-batch-failed]', err);
    });
  }

  increment(METRIC.REQUEST_EXPIRED, result);
  log.info('Expired stale requests', { expired: result, expiryDays });

  return { expired: result };
}

export async function updateCategoryFieldForKeeper(userId: string, input: unknown) {
  const payload = updateFieldSchema.parse(input);

  const field = await db.categoryField.findFirst({
    where: {
      key: payload.fieldKey,
      category: {
        key: payload.categoryKey,
        door: {
          slug: payload.doorSlug,
          userId
        }
      }
    },
    select: { id: true }
  });

  if (!field) {
    throw new DirectValidationError('Category field not found');
  }

  return db.categoryField.update({
    where: { id: field.id },
    data: {
      required: payload.required
    }
  });
}

// ---------------------------------------------------------------------------
// Blocklist management (keeper-facing)
// ---------------------------------------------------------------------------

const addBlockedSenderSchema = z.object({
  doorSlug: z.string().trim().min(1),
  email: z.string().trim().email(),
  reason: z.string().trim().max(500).optional()
});

const removeBlockedSenderSchema = z.object({
  doorSlug: z.string().trim().min(1),
  email: z.string().trim().email()
});

export async function addBlockedSenderForKeeper(userId: string, input: unknown) {
  const payload = addBlockedSenderSchema.parse(input);

  const door = await db.door.findFirst({
    where: { slug: payload.doorSlug, userId },
    select: { id: true }
  });

  if (!door) {
    throw new DirectValidationError('Door not found');
  }

  const email = payload.email.toLowerCase();

  const existing = await db.doorBlockedSender.findUnique({
    where: { doorId_email: { doorId: door.id, email } },
    select: { id: true }
  });

  if (existing) {
    return { added: false, email };
  }

  await db.doorBlockedSender.create({
    data: {
      doorId: door.id,
      email,
      reason: normalizeOptional(payload.reason)
    }
  });

  return { added: true, email };
}

export async function removeBlockedSenderForKeeper(userId: string, input: unknown) {
  const payload = removeBlockedSenderSchema.parse(input);

  const door = await db.door.findFirst({
    where: { slug: payload.doorSlug, userId },
    select: { id: true }
  });

  if (!door) {
    throw new DirectValidationError('Door not found');
  }

  const email = payload.email.toLowerCase();

  const existing = await db.doorBlockedSender.findUnique({
    where: { doorId_email: { doorId: door.id, email } },
    select: { id: true }
  });

  if (!existing) {
    return { removed: false, email };
  }

  await db.doorBlockedSender.delete({ where: { id: existing.id } });

  return { removed: true, email };
}

export async function listBlockedSendersForKeeper(userId: string, doorSlug: string) {
  const door = await db.door.findFirst({
    where: { slug: doorSlug, userId },
    select: { id: true }
  });

  if (!door) {
    throw new DirectValidationError('Door not found');
  }

  return db.doorBlockedSender.findMany({
    where: { doorId: door.id },
    orderBy: { createdAt: 'desc' },
    select: {
      email: true,
      reason: true,
      createdAt: true
    }
  });
}
