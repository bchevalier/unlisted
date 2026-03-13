import { describe, expect, it } from 'vitest';
import { z } from 'zod';

/**
 * Mirror of formRequestSchema from requests.ts — tested in isolation
 * to validate the V1 requester type / org fields without DB deps.
 */
const formRequestSchema = z.object({
  doorSlug: z.string().trim().min(1),
  categoryKey: z.string().trim().min(1),
  senderName: z.string().trim().max(120).optional(),
  senderEmail: z.string().trim().email().optional(),
  title: z.string().trim().max(180).optional(),
  message: z.string().trim().min(1).max(4000),
  fields: z.record(z.string(), z.string()).default({}),
  // V1 verification fields
  requesterType: z.enum(['INDIVIDUAL', 'ORGANIZATION']).default('INDIVIDUAL'),
  requesterOrgName: z.string().trim().max(200).optional(),
  requesterOrgWebsite: z.string().trim().max(500).optional(),
  requesterRoleTitle: z.string().trim().max(200).optional(),
});

function base(overrides: Record<string, unknown> = {}) {
  return {
    doorSlug: 'john',
    categoryKey: 'general',
    message: 'Hello, I have a question.',
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Backward compatibility — no requester fields
// ---------------------------------------------------------------------------

describe('formRequestSchema — backward compatibility', () => {
  it('accepts minimal payload without requester fields', () => {
    const result = formRequestSchema.safeParse(base());
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.requesterType).toBe('INDIVIDUAL');
    }
  });

  it('defaults requesterType to INDIVIDUAL when omitted', () => {
    const result = formRequestSchema.safeParse(base());
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.requesterType).toBe('INDIVIDUAL');
    }
  });

  it('defaults fields to empty object when omitted', () => {
    const result = formRequestSchema.safeParse(base());
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.fields).toEqual({});
    }
  });
});

// ---------------------------------------------------------------------------
// requesterType validation
// ---------------------------------------------------------------------------

describe('formRequestSchema — requesterType', () => {
  it('accepts INDIVIDUAL', () => {
    const result = formRequestSchema.safeParse(base({ requesterType: 'INDIVIDUAL' }));
    expect(result.success).toBe(true);
  });

  it('accepts ORGANIZATION', () => {
    const result = formRequestSchema.safeParse(base({ requesterType: 'ORGANIZATION' }));
    expect(result.success).toBe(true);
  });

  it('rejects unknown requester type', () => {
    const result = formRequestSchema.safeParse(base({ requesterType: 'ROBOT' }));
    expect(result.success).toBe(false);
  });

  it('rejects empty string requester type', () => {
    const result = formRequestSchema.safeParse(base({ requesterType: '' }));
    expect(result.success).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Organization fields
// ---------------------------------------------------------------------------

describe('formRequestSchema — organization fields', () => {
  it('accepts full org payload', () => {
    const result = formRequestSchema.safeParse(
      base({
        requesterType: 'ORGANIZATION',
        requesterOrgName: 'Acme Inc',
        requesterOrgWebsite: 'https://acme.com',
        requesterRoleTitle: 'Head of Partnerships',
      })
    );
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.requesterOrgName).toBe('Acme Inc');
      expect(result.data.requesterOrgWebsite).toBe('https://acme.com');
      expect(result.data.requesterRoleTitle).toBe('Head of Partnerships');
    }
  });

  it('accepts org fields without requesterType (defaults to INDIVIDUAL)', () => {
    const result = formRequestSchema.safeParse(
      base({
        requesterOrgName: 'Acme Inc',
        requesterOrgWebsite: 'https://acme.com',
      })
    );
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.requesterType).toBe('INDIVIDUAL');
    }
  });

  it('trims whitespace from org fields', () => {
    const result = formRequestSchema.safeParse(
      base({
        requesterType: 'ORGANIZATION',
        requesterOrgName: '  Acme Inc  ',
        requesterOrgWebsite: '  https://acme.com  ',
        requesterRoleTitle: '  CEO  ',
      })
    );
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.requesterOrgName).toBe('Acme Inc');
      expect(result.data.requesterOrgWebsite).toBe('https://acme.com');
      expect(result.data.requesterRoleTitle).toBe('CEO');
    }
  });

  it('rejects requesterOrgName exceeding 200 chars', () => {
    const result = formRequestSchema.safeParse(
      base({ requesterOrgName: 'x'.repeat(201) })
    );
    expect(result.success).toBe(false);
  });

  it('rejects requesterOrgWebsite exceeding 500 chars', () => {
    const result = formRequestSchema.safeParse(
      base({ requesterOrgWebsite: 'https://' + 'x'.repeat(493) })
    );
    expect(result.success).toBe(false);
  });

  it('rejects requesterRoleTitle exceeding 200 chars', () => {
    const result = formRequestSchema.safeParse(
      base({ requesterRoleTitle: 'x'.repeat(201) })
    );
    expect(result.success).toBe(false);
  });

  it('accepts ORGANIZATION type without org fields (validation is policy-level)', () => {
    const result = formRequestSchema.safeParse(
      base({ requesterType: 'ORGANIZATION' })
    );
    expect(result.success).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// senderEmail field
// ---------------------------------------------------------------------------

describe('formRequestSchema — senderEmail', () => {
  it('accepts valid email', () => {
    const result = formRequestSchema.safeParse(
      base({ senderEmail: 'alice@acme.com' })
    );
    expect(result.success).toBe(true);
  });

  it('accepts omitted email (optional for free doors)', () => {
    const result = formRequestSchema.safeParse(base());
    expect(result.success).toBe(true);
  });

  it('rejects invalid email format', () => {
    const result = formRequestSchema.safeParse(
      base({ senderEmail: 'not-an-email' })
    );
    expect(result.success).toBe(false);
  });
});
