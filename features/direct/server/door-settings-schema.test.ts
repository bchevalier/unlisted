import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { ContactRevealMethod } from '@prisma/client';

// Re-create the schema locally to test validation without DB deps.
// This mirrors updateDoorSettingsSchema in requests.ts.
const updateDoorSettingsSchema = z.object({
  doorSlug: z.string().trim().min(1),
  autoReplyEnabled: z.boolean(),
  autoReplyMessage: z.string().trim().max(1000).optional(),
  weeklyRequestCap: z.number().int().positive().max(5000).nullable(),
  revealMethod: z.enum([ContactRevealMethod.NONE, ContactRevealMethod.EMAIL, ContactRevealMethod.URL]),
  revealValue: z.string().trim().max(500).nullable(),
  notifyNewRequest: z.boolean().optional(),
  notifyDigest: z.boolean().optional(),
  paidQuoteAmountCents: z.number().int().min(0).max(100_000_000).nullable().optional(),
  paidQuoteCurrency: z.string().trim().min(3).max(3).toUpperCase().nullable().optional(),
  paidQuoteNote: z.string().trim().max(1000).nullable().optional(),
  quoteVisibleToVerifiedOrgsOnly: z.boolean().optional(),
  openToNonTargetedPaidReach: z.boolean().optional(),
});

function base() {
  return {
    doorSlug: 'john',
    autoReplyEnabled: false,
    weeklyRequestCap: null,
    revealMethod: 'NONE' as const,
    revealValue: null,
  };
}

describe('updateDoorSettingsSchema — paid quote fields', () => {
  it('accepts payload without any paid fields (backward compat)', () => {
    const result = updateDoorSettingsSchema.safeParse(base());
    expect(result.success).toBe(true);
  });

  it('accepts valid paid quote configuration', () => {
    const result = updateDoorSettingsSchema.safeParse({
      ...base(),
      paidQuoteAmountCents: 50000,
      paidQuoteCurrency: 'USD',
      paidQuoteNote: 'Starting rate for advisory sessions',
      quoteVisibleToVerifiedOrgsOnly: true,
      openToNonTargetedPaidReach: false,
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.paidQuoteAmountCents).toBe(50000);
      expect(result.data.paidQuoteCurrency).toBe('USD');
    }
  });

  it('normalizes currency to uppercase', () => {
    const result = updateDoorSettingsSchema.safeParse({
      ...base(),
      paidQuoteCurrency: 'eur',
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.paidQuoteCurrency).toBe('EUR');
    }
  });

  it('accepts null for nullable paid fields', () => {
    const result = updateDoorSettingsSchema.safeParse({
      ...base(),
      paidQuoteAmountCents: null,
      paidQuoteCurrency: null,
      paidQuoteNote: null,
    });
    expect(result.success).toBe(true);
  });

  it('rejects negative amount', () => {
    const result = updateDoorSettingsSchema.safeParse({
      ...base(),
      paidQuoteAmountCents: -100,
    });
    expect(result.success).toBe(false);
  });

  it('rejects amount exceeding max', () => {
    const result = updateDoorSettingsSchema.safeParse({
      ...base(),
      paidQuoteAmountCents: 200_000_000,
    });
    expect(result.success).toBe(false);
  });

  it('rejects non-integer amount', () => {
    const result = updateDoorSettingsSchema.safeParse({
      ...base(),
      paidQuoteAmountCents: 99.5,
    });
    expect(result.success).toBe(false);
  });

  it('rejects currency with wrong length', () => {
    const tooShort = updateDoorSettingsSchema.safeParse({ ...base(), paidQuoteCurrency: 'US' });
    expect(tooShort.success).toBe(false);

    const tooLong = updateDoorSettingsSchema.safeParse({ ...base(), paidQuoteCurrency: 'USDD' });
    expect(tooLong.success).toBe(false);
  });

  it('rejects quote note exceeding max length', () => {
    const result = updateDoorSettingsSchema.safeParse({
      ...base(),
      paidQuoteNote: 'x'.repeat(1001),
    });
    expect(result.success).toBe(false);
  });

  it('accepts zero amount (free quote / visibility use-case)', () => {
    const result = updateDoorSettingsSchema.safeParse({
      ...base(),
      paidQuoteAmountCents: 0,
    });
    expect(result.success).toBe(true);
  });
});
