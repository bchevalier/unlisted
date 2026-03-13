import { describe, expect, it } from 'vitest';
import { isQuoteVisible, type QuoteVisibilityInput } from './quote-visibility';

function base(overrides: Partial<QuoteVisibilityInput> = {}): QuoteVisibilityInput {
  return {
    requestStatus: 'ACCEPTED',
    keeperQuoteAmountCents: 50000,
    requesterVerificationStatus: 'BASIC_VERIFIED',
    quoteVisibleToVerifiedOrgsOnly: false,
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Request status gate
// ---------------------------------------------------------------------------

describe('isQuoteVisible — request status gate', () => {
  it('returns false when request is PENDING', () => {
    expect(isQuoteVisible(base({ requestStatus: 'PENDING' }))).toBe(false);
  });

  it('returns false when request is DECLINED', () => {
    expect(isQuoteVisible(base({ requestStatus: 'DECLINED' }))).toBe(false);
  });

  it('returns false when request is EXPIRED', () => {
    expect(isQuoteVisible(base({ requestStatus: 'EXPIRED' }))).toBe(false);
  });

  it('returns false when request is AWAITING_COMPLETION', () => {
    expect(isQuoteVisible(base({ requestStatus: 'AWAITING_COMPLETION' }))).toBe(false);
  });

  it('returns true when request is ACCEPTED and other criteria met', () => {
    expect(isQuoteVisible(base({ requestStatus: 'ACCEPTED' }))).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Quote snapshot presence
// ---------------------------------------------------------------------------

describe('isQuoteVisible — quote snapshot presence', () => {
  it('returns false when keeperQuoteAmountCents is null', () => {
    expect(isQuoteVisible(base({ keeperQuoteAmountCents: null }))).toBe(false);
  });

  it('returns true when keeperQuoteAmountCents is 0 (free/visibility use-case)', () => {
    expect(isQuoteVisible(base({ keeperQuoteAmountCents: 0 }))).toBe(true);
  });

  it('returns true when keeperQuoteAmountCents is positive', () => {
    expect(isQuoteVisible(base({ keeperQuoteAmountCents: 100000 }))).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Org-only restriction OFF (default)
// ---------------------------------------------------------------------------

describe('isQuoteVisible — quoteVisibleToVerifiedOrgsOnly = false', () => {
  it('visible to BASIC_VERIFIED requester', () => {
    expect(
      isQuoteVisible(
        base({
          quoteVisibleToVerifiedOrgsOnly: false,
          requesterVerificationStatus: 'BASIC_VERIFIED',
        })
      )
    ).toBe(true);
  });

  it('visible to ORG_VERIFIED requester', () => {
    expect(
      isQuoteVisible(
        base({
          quoteVisibleToVerifiedOrgsOnly: false,
          requesterVerificationStatus: 'ORG_VERIFIED',
        })
      )
    ).toBe(true);
  });

  it('NOT visible to UNVERIFIED requester', () => {
    expect(
      isQuoteVisible(
        base({
          quoteVisibleToVerifiedOrgsOnly: false,
          requesterVerificationStatus: 'UNVERIFIED',
        })
      )
    ).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Org-only restriction ON
// ---------------------------------------------------------------------------

describe('isQuoteVisible — quoteVisibleToVerifiedOrgsOnly = true', () => {
  it('visible to ORG_VERIFIED requester', () => {
    expect(
      isQuoteVisible(
        base({
          quoteVisibleToVerifiedOrgsOnly: true,
          requesterVerificationStatus: 'ORG_VERIFIED',
        })
      )
    ).toBe(true);
  });

  it('NOT visible to BASIC_VERIFIED requester', () => {
    expect(
      isQuoteVisible(
        base({
          quoteVisibleToVerifiedOrgsOnly: true,
          requesterVerificationStatus: 'BASIC_VERIFIED',
        })
      )
    ).toBe(false);
  });

  it('NOT visible to UNVERIFIED requester', () => {
    expect(
      isQuoteVisible(
        base({
          quoteVisibleToVerifiedOrgsOnly: true,
          requesterVerificationStatus: 'UNVERIFIED',
        })
      )
    ).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Edge combinations
// ---------------------------------------------------------------------------

describe('isQuoteVisible — edge cases', () => {
  it('returns false when accepted but no quote and BASIC_VERIFIED', () => {
    expect(
      isQuoteVisible({
        requestStatus: 'ACCEPTED',
        keeperQuoteAmountCents: null,
        requesterVerificationStatus: 'BASIC_VERIFIED',
        quoteVisibleToVerifiedOrgsOnly: false,
      })
    ).toBe(false);
  });

  it('returns false when pending with quote and ORG_VERIFIED', () => {
    expect(
      isQuoteVisible({
        requestStatus: 'PENDING',
        keeperQuoteAmountCents: 50000,
        requesterVerificationStatus: 'ORG_VERIFIED',
        quoteVisibleToVerifiedOrgsOnly: false,
      })
    ).toBe(false);
  });

  it('returns false for unknown verification status', () => {
    expect(
      isQuoteVisible({
        requestStatus: 'ACCEPTED',
        keeperQuoteAmountCents: 50000,
        requesterVerificationStatus: 'UNKNOWN_STATUS',
        quoteVisibleToVerifiedOrgsOnly: false,
      })
    ).toBe(false);
  });
});
