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

const formRequestSchema = z.object({
  doorSlug: z.string().trim().min(1),
  categoryKey: z.string().trim().min(1),
  senderName: z.string().trim().max(120).optional(),
  senderEmail: z.string().trim().email().optional(),
  title: z.string().trim().max(180).optional(),
  message: z.string().trim().min(1).max(4000),
  fields: z.record(z.string(), z.string()).default({})
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
  revealValue: z.string().trim().max(500).nullable()
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

export class DirectValidationError extends Error {}

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
    throw new DirectValidationError('Door weekly request cap reached');
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
    throw new DirectValidationError('Category weekly request cap reached');
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
    throw new DirectValidationError('Inbound sender rate limit reached');
  }
}

export async function createFormRequest(input: unknown) {
  const payload = formRequestSchema.parse(input);

  const door = await db.door.findUnique({
    where: { slug: payload.doorSlug },
    select: {
      id: true,
      isEnabled: true,
      plan: true,
      settings: {
        select: { weeklyRequestCap: true }
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

  return db.request.create({
    data: {
      doorId: door.id,
      categoryId: category.id,
      source: RequestSource.FORM,
      status: RequestStatus.PENDING,
      senderName: normalizeOptional(payload.senderName),
      senderEmail: normalizeOptional(payload.senderEmail),
      title: normalizeOptional(payload.title),
      message: payload.message,
      structuredData: sanitizedFields,
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
      status: true
    }
  });
}

export async function createEmailRequest(input: unknown) {
  const payload = emailRequestSchema.parse(input);

  if ((payload.cc?.length ?? 0) > 0 || (payload.bcc?.length ?? 0) > 0) {
    throw new DirectValidationError('CC/BCC not supported');
  }

  if ((payload.attachments?.length ?? 0) > 0) {
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
          isEnabled: true,
          plan: true,
          settings: {
            select: {
              weeklyRequestCap: true
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

  if (emailAlias.door.plan === DoorPlan.FREE) {
    await enforceDoorWeeklyCap(emailAlias.door.id, emailAlias.door.settings?.weeklyRequestCap);
    await enforceInboundEmailSenderRateLimit(emailAlias.door.id, senderEmail);
  }

  const cleanedMessage = stripQuotedAndSignature(payload.text);
  if (!cleanedMessage) {
    throw new DirectValidationError('Email body is empty after quote/signature stripping');
  }

  return db.request.create({
    data: {
      doorId: emailAlias.door.id,
      source: RequestSource.EMAIL,
      status: RequestStatus.PENDING,
      senderName,
      senderEmail,
      title: normalizeOptional(payload.subject),
      message: cleanedMessage,
      structuredData: {
        to: payload.to,
        from: payload.from,
        alias: emailAlias.alias
      },
      events: {
        create: {
          type: RequestEventType.CREATED,
          actor: RequestEventActor.SYSTEM,
          note: 'Inbound email created request'
        }
      }
    },
    select: {
      id: true,
      requestToken: true,
      status: true
    }
  });
}

export async function updateRequestStatusForKeeper(userId: string, requestId: string, input: unknown) {
  const payload = updateStatusSchema.parse(input);

  const existing = await db.request.findUnique({
    where: { id: requestId },
    select: {
      id: true,
      status: true,
      door: {
        select: {
          userId: true
        }
      }
    }
  });

  if (!existing || existing.door.userId !== userId) {
    throw new DirectValidationError('Request not found');
  }

  if (existing.status !== RequestStatus.PENDING) {
    throw new DirectValidationError('Request already finalized');
  }

  const eventType =
    payload.status === RequestStatus.ACCEPTED ? RequestEventType.ACCEPTED : RequestEventType.DECLINED;

  return db.request.update({
    where: { id: requestId },
    data: {
      status: payload.status,
      events: {
        create: {
          type: eventType,
          actor: RequestEventActor.KEEPER,
          note: normalizeOptional(payload.note)
        }
      }
    },
    select: { id: true, status: true }
  });
}

export async function listRequestsByDoorSlugForKeeper(userId: string, doorSlug: string) {
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
          revealValue: true
        }
      },
      requests: {
        orderBy: { createdAt: 'desc' },
        take: 100,
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
      }
    }
  });

  return door;
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

  return db.doorSettings.upsert({
    where: { doorId: door.id },
    update: {
      autoReplyEnabled: payload.autoReplyEnabled,
      autoReplyMessage: normalizeOptional(payload.autoReplyMessage),
      weeklyRequestCap: normalizedWeeklyCap,
      revealMethod: payload.revealMethod,
      revealValue: normalizeOptional(payload.revealValue)
    },
    create: {
      doorId: door.id,
      autoReplyEnabled: payload.autoReplyEnabled,
      autoReplyMessage: normalizeOptional(payload.autoReplyMessage),
      weeklyRequestCap: normalizedWeeklyCap,
      revealMethod: payload.revealMethod,
      revealValue: normalizeOptional(payload.revealValue)
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
