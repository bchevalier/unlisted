/**
 * Quote visibility policy for Knokio Direct V1.
 *
 * Determines whether a keeper's quote should be shown on the knocker
 * status page (`/r/[token]`).
 *
 * Policy:
 * - Only shown when request is ACCEPTED and a quote snapshot exists.
 * - If `quoteVisibleToVerifiedOrgsOnly` is true:
 *     → only ORG_VERIFIED requesters see the quote.
 * - Otherwise:
 *     → BASIC_VERIFIED and ORG_VERIFIED requesters see the quote.
 * - UNVERIFIED requesters never see the quote.
 */

export type QuoteVisibilityInput = {
  requestStatus: string;
  keeperQuoteAmountCents: number | null;
  requesterVerificationStatus: string;
  quoteVisibleToVerifiedOrgsOnly: boolean;
};

/**
 * Returns true if the quote should be visible to the knocker on the
 * request status page.
 */
export function isQuoteVisible(input: QuoteVisibilityInput): boolean {
  // Only show on accepted requests with a snapshot
  if (input.requestStatus !== 'ACCEPTED') return false;
  if (input.keeperQuoteAmountCents == null) return false;

  if (input.quoteVisibleToVerifiedOrgsOnly) {
    return input.requesterVerificationStatus === 'ORG_VERIFIED';
  }

  return (
    input.requesterVerificationStatus === 'BASIC_VERIFIED' ||
    input.requesterVerificationStatus === 'ORG_VERIFIED'
  );
}
