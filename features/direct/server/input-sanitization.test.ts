import { describe, expect, it } from 'vitest';
import { z } from 'zod';

// ---------------------------------------------------------------------------
// Input sanitization tests for Direct entry points.
// Validates that schemas, normalizers, and helpers reject or clean
// malicious inputs (XSS, injection, boundary abuse).
// ---------------------------------------------------------------------------

// Re-implementations from requests.ts — keep in sync

function normalizeOptional(value?: string | null): string | null {
  if (!value) return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

const formRequestSchema = z.object({
  doorSlug: z.string().trim().min(1),
  categoryKey: z.string().trim().min(1),
  senderName: z.string().trim().max(120).optional(),
  senderEmail: z.string().trim().email().optional(),
  title: z.string().trim().max(180).optional(),
  message: z.string().trim().min(1).max(4000),
  fields: z.record(z.string(), z.string()).default({}),
});

const emailRequestSchema = z.object({
  to: z.string().trim().min(1),
  from: z.string().trim().min(1),
  subject: z.string().trim().max(180).optional(),
  text: z.string().trim().min(1).max(10000),
  cc: z.array(z.string()).optional(),
  bcc: z.array(z.string()).optional(),
  attachments: z.array(z.unknown()).optional(),
});

// Notification helper (from notifications.ts)
function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// ---------------------------------------------------------------------------
// XSS in user-submitted fields
// ---------------------------------------------------------------------------

describe('XSS prevention in form schemas', () => {
  it('schema accepts script tags (stored as-is — output escaping is the defense)', () => {
    // Zod schemas intentionally do NOT strip HTML — that's the DB layer's job
    // to store verbatim and the rendering layer's job to escape.
    const result = formRequestSchema.safeParse({
      doorSlug: 'john',
      categoryKey: 'other',
      message: '<script>alert("xss")</script>',
    });
    expect(result.success).toBe(true);
    // But the escapeHtml output helper must neutralize it
    expect(escapeHtml('<script>alert("xss")</script>')).toBe(
      '&lt;script&gt;alert(&quot;xss&quot;)&lt;/script&gt;'
    );
  });

  it('escapeHtml handles nested angle brackets', () => {
    expect(escapeHtml('<<img onerror=alert(1)>>')).toBe('&lt;&lt;img onerror=alert(1)&gt;&gt;');
  });

  it('escapeHtml handles ampersand-based entities', () => {
    expect(escapeHtml('&amp; &lt; &gt;')).toBe('&amp;amp; &amp;lt; &amp;gt;');
  });

  it('escapeHtml handles double quotes in attributes', () => {
    expect(escapeHtml('" onmouseover="alert(1)')).toBe('&quot; onmouseover=&quot;alert(1)');
  });
});

// ---------------------------------------------------------------------------
// SQL injection patterns (Prisma parameterizes, but test schema boundaries)
// ---------------------------------------------------------------------------

describe('SQL injection prevention (schema boundaries)', () => {
  it('doorSlug with SQL injection passes schema but is safely parameterized by Prisma', () => {
    // Prisma uses parameterized queries, so this is safe at the DB level.
    // Schema just validates shape, not content.
    const result = formRequestSchema.safeParse({
      doorSlug: "'; DROP TABLE users; --",
      categoryKey: 'other',
      message: 'test',
    });
    expect(result.success).toBe(true);
  });

  it('email with SQL injection is rejected by email validator', () => {
    const result = formRequestSchema.safeParse({
      doorSlug: 'john',
      categoryKey: 'other',
      message: 'test',
      senderEmail: "' OR 1=1; --",
    });
    expect(result.success).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// normalizeOptional
// ---------------------------------------------------------------------------

describe('normalizeOptional', () => {
  it('returns null for null input', () => {
    expect(normalizeOptional(null)).toBeNull();
  });

  it('returns null for undefined input', () => {
    expect(normalizeOptional(undefined)).toBeNull();
  });

  it('returns null for empty string', () => {
    expect(normalizeOptional('')).toBeNull();
  });

  it('returns null for whitespace-only string', () => {
    expect(normalizeOptional('   ')).toBeNull();
  });

  it('trims and returns non-empty string', () => {
    expect(normalizeOptional('  hello  ')).toBe('hello');
  });

  it('preserves internal whitespace', () => {
    expect(normalizeOptional('hello world')).toBe('hello world');
  });
});

// ---------------------------------------------------------------------------
// Boundary and overflow tests
// ---------------------------------------------------------------------------

describe('boundary and overflow inputs', () => {
  it('rejects message at exactly max+1 chars', () => {
    const result = formRequestSchema.safeParse({
      doorSlug: 'john',
      categoryKey: 'other',
      message: 'a'.repeat(4001),
    });
    expect(result.success).toBe(false);
  });

  it('accepts message at exactly max chars', () => {
    const result = formRequestSchema.safeParse({
      doorSlug: 'john',
      categoryKey: 'other',
      message: 'a'.repeat(4000),
    });
    expect(result.success).toBe(true);
  });

  it('rejects email body at exactly max+1 chars', () => {
    const result = emailRequestSchema.safeParse({
      to: 'john@knokio.io',
      from: 'alice@example.com',
      text: 'a'.repeat(10001),
    });
    expect(result.success).toBe(false);
  });

  it('accepts email body at exactly max chars', () => {
    const result = emailRequestSchema.safeParse({
      to: 'john@knokio.io',
      from: 'alice@example.com',
      text: 'a'.repeat(10000),
    });
    expect(result.success).toBe(true);
  });

  it('rejects senderName over 120 chars', () => {
    const result = formRequestSchema.safeParse({
      doorSlug: 'john',
      categoryKey: 'other',
      message: 'test',
      senderName: 'A'.repeat(121),
    });
    expect(result.success).toBe(false);
  });

  it('accepts senderName at exactly 120 chars', () => {
    const result = formRequestSchema.safeParse({
      doorSlug: 'john',
      categoryKey: 'other',
      message: 'test',
      senderName: 'A'.repeat(120),
    });
    expect(result.success).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Honeypot anti-bot check
// ---------------------------------------------------------------------------

describe('honeypot anti-bot check', () => {
  // Re-implementation of the honeypot logic from createFormRequest
  function isBot(honeypot?: string | null): boolean {
    return !!honeypot && honeypot.trim().length > 0;
  }

  it('passes when honeypot is empty', () => {
    expect(isBot('')).toBe(false);
  });

  it('passes when honeypot is null', () => {
    expect(isBot(null)).toBe(false);
  });

  it('passes when honeypot is undefined', () => {
    expect(isBot(undefined)).toBe(false);
  });

  it('passes when honeypot is whitespace-only', () => {
    expect(isBot('   ')).toBe(false);
  });

  it('detects bot when honeypot has content', () => {
    expect(isBot('filled-by-bot')).toBe(true);
  });

  it('detects bot with minimal content', () => {
    expect(isBot('x')).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Unicode and special character handling
// ---------------------------------------------------------------------------

describe('unicode and special character inputs', () => {
  it('accepts unicode in message body', () => {
    const result = formRequestSchema.safeParse({
      doorSlug: 'john',
      categoryKey: 'other',
      message: 'こんにちは、お問い合わせです。🙂',
    });
    expect(result.success).toBe(true);
  });

  it('accepts RTL text in message', () => {
    const result = formRequestSchema.safeParse({
      doorSlug: 'john',
      categoryKey: 'other',
      message: 'مرحبا، هذا استفسار.',
    });
    expect(result.success).toBe(true);
  });

  it('accepts emoji in senderName', () => {
    const result = formRequestSchema.safeParse({
      doorSlug: 'john',
      categoryKey: 'other',
      message: 'Hello',
      senderName: '🎨 Alice',
    });
    expect(result.success).toBe(true);
  });

  it('escapeHtml handles unicode safely', () => {
    expect(escapeHtml('こんにちは')).toBe('こんにちは');
    expect(escapeHtml('مرحبا')).toBe('مرحبا');
  });

  it('null byte in message is accepted by schema (Prisma handles safely)', () => {
    // Prisma/PostgreSQL silently strips null bytes from text columns
    const result = formRequestSchema.safeParse({
      doorSlug: 'john',
      categoryKey: 'other',
      message: 'hello\x00world',
    });
    expect(result.success).toBe(true);
  });
});
