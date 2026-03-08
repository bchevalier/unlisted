import { describe, it, expect } from 'vitest';
import { ReachBlockCreateSchema, ReachAbuseReportCreateSchema, ReachAbuseReportUpdateSchema } from './safety';

// ---------------------------------------------------------------------------
// Schema validation tests (no DB required)
// ---------------------------------------------------------------------------

describe('ReachBlockCreateSchema', () => {
  it('accepts valid block input', () => {
    const result = ReachBlockCreateSchema.safeParse({
      blockedHandle: 'alice',
      reason: 'Spamming contracts',
    });
    expect(result.success).toBe(true);
  });

  it('accepts input without reason', () => {
    const result = ReachBlockCreateSchema.safeParse({ blockedHandle: 'alice' });
    expect(result.success).toBe(true);
  });

  it('rejects empty handle', () => {
    const result = ReachBlockCreateSchema.safeParse({ blockedHandle: '' });
    expect(result.success).toBe(false);
  });

  it('rejects single-char handle', () => {
    const result = ReachBlockCreateSchema.safeParse({ blockedHandle: 'a' });
    expect(result.success).toBe(false);
  });

  it('rejects handle over 64 chars', () => {
    const result = ReachBlockCreateSchema.safeParse({
      blockedHandle: 'a'.repeat(65),
    });
    expect(result.success).toBe(false);
  });

  it('rejects reason over 500 chars', () => {
    const result = ReachBlockCreateSchema.safeParse({
      blockedHandle: 'alice',
      reason: 'x'.repeat(501),
    });
    expect(result.success).toBe(false);
  });
});

describe('ReachAbuseReportCreateSchema', () => {
  it('accepts valid report input', () => {
    const result = ReachAbuseReportCreateSchema.safeParse({
      contractId: 'contract_123',
      reason: 'SPAM',
      description: 'Sending irrelevant contracts',
    });
    expect(result.success).toBe(true);
  });

  it('accepts input without description', () => {
    const result = ReachAbuseReportCreateSchema.safeParse({
      contractId: 'contract_123',
      reason: 'HARASSMENT',
    });
    expect(result.success).toBe(true);
  });

  it('rejects missing contractId', () => {
    const result = ReachAbuseReportCreateSchema.safeParse({
      reason: 'SPAM',
    });
    expect(result.success).toBe(false);
  });

  it('rejects invalid reason', () => {
    const result = ReachAbuseReportCreateSchema.safeParse({
      contractId: 'contract_123',
      reason: 'INVALID_REASON',
    });
    expect(result.success).toBe(false);
  });

  it('accepts all valid reasons', () => {
    for (const reason of ['SPAM', 'HARASSMENT', 'IMPERSONATION', 'PHISHING', 'OTHER']) {
      const result = ReachAbuseReportCreateSchema.safeParse({
        contractId: 'c1',
        reason,
      });
      expect(result.success).toBe(true);
    }
  });

  it('rejects description over 1000 chars', () => {
    const result = ReachAbuseReportCreateSchema.safeParse({
      contractId: 'c1',
      reason: 'SPAM',
      description: 'x'.repeat(1001),
    });
    expect(result.success).toBe(false);
  });
});

describe('ReachAbuseReportUpdateSchema', () => {
  it('accepts valid review update', () => {
    const result = ReachAbuseReportUpdateSchema.safeParse({
      reportId: 'report_1',
      status: 'REVIEWED',
      reviewNote: 'Confirmed spam behavior',
    });
    expect(result.success).toBe(true);
  });

  it('accepts dismiss without note', () => {
    const result = ReachAbuseReportUpdateSchema.safeParse({
      reportId: 'report_1',
      status: 'DISMISSED',
    });
    expect(result.success).toBe(true);
  });

  it('rejects invalid status', () => {
    const result = ReachAbuseReportUpdateSchema.safeParse({
      reportId: 'report_1',
      status: 'OPEN',
    });
    expect(result.success).toBe(false);
  });

  it('rejects missing reportId', () => {
    const result = ReachAbuseReportUpdateSchema.safeParse({
      status: 'REVIEWED',
    });
    expect(result.success).toBe(false);
  });

  it('rejects reviewNote over 500 chars', () => {
    const result = ReachAbuseReportUpdateSchema.safeParse({
      reportId: 'r1',
      status: 'REVIEWED',
      reviewNote: 'x'.repeat(501),
    });
    expect(result.success).toBe(false);
  });
});
