import {
  CategoryFieldType,
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

export class DirectValidationError extends Error {}

function normalizeOptional(value?: string): string | null {
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

export async function createFormRequest(input: unknown) {
  const payload = formRequestSchema.parse(input);

  const door = await db.door.findUnique({
    where: { slug: payload.doorSlug },
    select: {
      id: true,
      isEnabled: true,
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

  const request = await db.request.create({
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

  return request;
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
      id: true,
      alias: true,
      isEnabled: true,
      door: {
        select: {
          id: true,
          isEnabled: true
        }
      }
    }
  });

  if (!emailAlias?.isEnabled || !emailAlias.door.isEnabled) {
    throw new DirectValidationError('Alias unavailable');
  }

  const request = await db.request.create({
    data: {
      doorId: emailAlias.door.id,
      source: RequestSource.EMAIL,
      status: RequestStatus.PENDING,
      senderEmail: extractEmailAddress(payload.from),
      title: normalizeOptional(payload.subject),
      message: payload.text,
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

  return request;
}

const updateStatusSchema = z.object({
  status: z.enum([RequestStatus.ACCEPTED, RequestStatus.DECLINED]),
  note: z.string().trim().max(500).optional()
});

export async function updateRequestStatus(requestId: string, input: unknown) {
  const payload = updateStatusSchema.parse(input);

  const existing = await db.request.findUnique({
    where: { id: requestId },
    select: { id: true, status: true }
  });

  if (!existing) {
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

export async function listRequestsByDoorSlug(doorSlug: string) {
  const door = await db.door.findUnique({
    where: { slug: doorSlug },
    select: {
      id: true,
      slug: true,
      displayName: true,
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
      }
    }
  });

  if (!door) {
    return null;
  }

  return door;
}

export async function listDoorsForDirect() {
  return db.door.findMany({
    orderBy: { createdAt: 'asc' },
    select: {
      slug: true,
      displayName: true
    }
  });
}
