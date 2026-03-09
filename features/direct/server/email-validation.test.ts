import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { CategoryFieldType } from '@prisma/client';

// ---------------------------------------------------------------------------
// Unit tests for email request validation schemas and field validators.
// Re-implemented here to test in isolation (same pattern as slug.test.ts).
// Keep in sync with requests.ts production implementations.
// ---------------------------------------------------------------------------

const emailRequestSchema = z.object({
  to: z.string().trim().min(1),
  from: z.string().trim().min(1),
  subject: z.string().trim().max(180).optional(),
  text: z.string().trim().min(1).max(10000),
  cc: z.array(z.string()).optional(),
  bcc: z.array(z.string()).optional(),
  attachments: z.array(z.unknown()).optional(),
});

const formRequestSchema = z.object({
  doorSlug: z.string().trim().min(1),
  categoryKey: z.string().trim().min(1),
  senderName: z.string().trim().max(120).optional(),
  senderEmail: z.string().trim().email().optional(),
  title: z.string().trim().max(180).optional(),
  message: z.string().trim().min(1).max(4000),
  fields: z.record(z.string(), z.string()).default({}),
});

function validateFieldByType(type: CategoryFieldType, value: string): boolean {
  if (value.length === 0) return true;
  if (type === CategoryFieldType.URL) return z.string().url().safeParse(value).success;
  if (type === CategoryFieldType.EMAIL) return z.string().email().safeParse(value).success;
  if (type === CategoryFieldType.NUMBER) return !Number.isNaN(Number(value));
  return true;
}

// ---------------------------------------------------------------------------
// emailRequestSchema
// ---------------------------------------------------------------------------

describe('emailRequestSchema', () => {
  const validPayload = {
    to: 'john@knokio.io',
    from: 'alice@example.com',
    subject: 'Business inquiry',
    text: 'I would like to discuss a partnership.',
  };

  it('accepts a valid payload', () => {
    const result = emailRequestSchema.safeParse(validPayload);
    expect(result.success).toBe(true);
  });

  it('accepts payload without subject', () => {
    const { subject, ...noSubject } = validPayload;
    const result = emailRequestSchema.safeParse(noSubject);
    expect(result.success).toBe(true);
  });

  it('rejects empty "to" field', () => {
    const result = emailRequestSchema.safeParse({ ...validPayload, to: '' });
    expect(result.success).toBe(false);
  });

  it('rejects empty "from" field', () => {
    const result = emailRequestSchema.safeParse({ ...validPayload, from: '' });
    expect(result.success).toBe(false);
  });

  it('rejects empty "text" field', () => {
    const result = emailRequestSchema.safeParse({ ...validPayload, text: '' });
    expect(result.success).toBe(false);
  });

  it('rejects text exceeding 10000 chars', () => {
    const result = emailRequestSchema.safeParse({ ...validPayload, text: 'a'.repeat(10001) });
    expect(result.success).toBe(false);
  });

  it('rejects subject exceeding 180 chars', () => {
    const result = emailRequestSchema.safeParse({ ...validPayload, subject: 'x'.repeat(181) });
    expect(result.success).toBe(false);
  });

  it('trims whitespace from fields', () => {
    const result = emailRequestSchema.parse({ ...validPayload, to: '  john@knokio.io  ' });
    expect(result.to).toBe('john@knokio.io');
  });

  it('accepts empty cc/bcc/attachments arrays', () => {
    const result = emailRequestSchema.safeParse({ ...validPayload, cc: [], bcc: [], attachments: [] });
    expect(result.success).toBe(true);
  });

  it('accepts payload with cc addresses', () => {
    const result = emailRequestSchema.safeParse({ ...validPayload, cc: ['bob@example.com'] });
    expect(result.success).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// formRequestSchema
// ---------------------------------------------------------------------------

describe('formRequestSchema', () => {
  const validPayload = {
    doorSlug: 'john',
    categoryKey: 'business',
    senderName: 'Alice',
    senderEmail: 'alice@example.com',
    title: 'Partnership inquiry',
    message: 'I want to discuss something.',
    fields: { company: 'Acme' },
  };

  it('accepts a valid payload', () => {
    const result = formRequestSchema.safeParse(validPayload);
    expect(result.success).toBe(true);
  });

  it('accepts payload without optional fields', () => {
    const result = formRequestSchema.safeParse({
      doorSlug: 'john',
      categoryKey: 'other',
      message: 'Hello.',
    });
    expect(result.success).toBe(true);
  });

  it('defaults fields to empty object', () => {
    const result = formRequestSchema.parse({
      doorSlug: 'john',
      categoryKey: 'other',
      message: 'Hello.',
    });
    expect(result.fields).toEqual({});
  });

  it('rejects empty doorSlug', () => {
    const result = formRequestSchema.safeParse({ ...validPayload, doorSlug: '' });
    expect(result.success).toBe(false);
  });

  it('rejects empty categoryKey', () => {
    const result = formRequestSchema.safeParse({ ...validPayload, categoryKey: '' });
    expect(result.success).toBe(false);
  });

  it('rejects empty message', () => {
    const result = formRequestSchema.safeParse({ ...validPayload, message: '' });
    expect(result.success).toBe(false);
  });

  it('rejects message exceeding 4000 chars', () => {
    const result = formRequestSchema.safeParse({ ...validPayload, message: 'a'.repeat(4001) });
    expect(result.success).toBe(false);
  });

  it('rejects senderName exceeding 120 chars', () => {
    const result = formRequestSchema.safeParse({ ...validPayload, senderName: 'a'.repeat(121) });
    expect(result.success).toBe(false);
  });

  it('rejects invalid senderEmail', () => {
    const result = formRequestSchema.safeParse({ ...validPayload, senderEmail: 'not-an-email' });
    expect(result.success).toBe(false);
  });

  it('rejects title exceeding 180 chars', () => {
    const result = formRequestSchema.safeParse({ ...validPayload, title: 'x'.repeat(181) });
    expect(result.success).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// validateFieldByType
// ---------------------------------------------------------------------------

describe('validateFieldByType', () => {
  describe('TEXT fields', () => {
    it('accepts any non-empty string', () => {
      expect(validateFieldByType(CategoryFieldType.TEXT, 'hello')).toBe(true);
    });

    it('accepts empty string', () => {
      expect(validateFieldByType(CategoryFieldType.TEXT, '')).toBe(true);
    });
  });

  describe('TEXTAREA fields', () => {
    it('accepts any non-empty string', () => {
      expect(validateFieldByType(CategoryFieldType.TEXTAREA, 'long text here')).toBe(true);
    });

    it('accepts empty string', () => {
      expect(validateFieldByType(CategoryFieldType.TEXTAREA, '')).toBe(true);
    });
  });

  describe('URL fields', () => {
    it('accepts valid http URL', () => {
      expect(validateFieldByType(CategoryFieldType.URL, 'https://example.com')).toBe(true);
    });

    it('rejects invalid URL', () => {
      expect(validateFieldByType(CategoryFieldType.URL, 'not-a-url')).toBe(false);
    });

    it('accepts empty string', () => {
      expect(validateFieldByType(CategoryFieldType.URL, '')).toBe(true);
    });
  });

  describe('EMAIL fields', () => {
    it('accepts valid email', () => {
      expect(validateFieldByType(CategoryFieldType.EMAIL, 'alice@example.com')).toBe(true);
    });

    it('rejects invalid email', () => {
      expect(validateFieldByType(CategoryFieldType.EMAIL, 'alice@')).toBe(false);
    });

    it('accepts empty string', () => {
      expect(validateFieldByType(CategoryFieldType.EMAIL, '')).toBe(true);
    });
  });

  describe('NUMBER fields', () => {
    it('accepts integer string', () => {
      expect(validateFieldByType(CategoryFieldType.NUMBER, '42')).toBe(true);
    });

    it('accepts decimal string', () => {
      expect(validateFieldByType(CategoryFieldType.NUMBER, '3.14')).toBe(true);
    });

    it('accepts negative number', () => {
      expect(validateFieldByType(CategoryFieldType.NUMBER, '-100')).toBe(true);
    });

    it('rejects non-numeric string', () => {
      expect(validateFieldByType(CategoryFieldType.NUMBER, 'abc')).toBe(false);
    });

    it('accepts empty string', () => {
      expect(validateFieldByType(CategoryFieldType.NUMBER, '')).toBe(true);
    });
  });
});
