import Link from 'next/link';
import { db } from '../../../lib/db';
import { ReportButton } from './report-button';

type RequestStatusPageProps = {
  params: Promise<{
    token: string;
  }>;
};

/** Human-readable verification badge */
function VerificationBadge({ status }: { status: string | null }) {
  if (status === 'ORG_VERIFIED') {
    return <span style={{ color: '#15803d', fontWeight: 600 }}>✓ Organization verified</span>;
  }
  if (status === 'BASIC_VERIFIED') {
    return <span style={{ color: '#2563eb', fontWeight: 600 }}>✓ Identity verified</span>;
  }
  return <span style={{ color: '#a3a3a3' }}>Unverified</span>;
}

/** Format cents as currency string */
function formatQuote(amountCents: number, currency: string): string {
  const amount = amountCents / 100;
  try {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(amount);
  } catch {
    return `${currency} ${amount.toFixed(2)}`;
  }
}

export default async function RequestStatusPage({ params }: RequestStatusPageProps) {
  const { token } = await params;

  const request = await db.request.findUnique({
    where: { requestToken: token },
    select: {
      status: true,
      title: true,
      createdAt: true,
      requesterVerificationStatus: true,
      // Quote snapshot (populated on acceptance)
      keeperQuoteAmountCents: true,
      keeperQuoteCurrency: true,
      keeperQuoteNote: true,
      door: {
        select: {
          displayName: true,
          settings: {
            select: {
              revealMethod: true,
              revealValue: true,
              quoteVisibleToVerifiedOrgsOnly: true
            }
          }
        }
      }
    }
  });

  if (!request) {
    return (
      <main>
        <h1>Request not found</h1>
        <p>This request token is invalid or expired.</p>
      </main>
    );
  }

  const canReveal = request.status === 'ACCEPTED' && request.door.settings?.revealMethod !== 'NONE';

  // Quote visibility policy (only on accepted requests with a snapshot)
  const hasQuote =
    request.status === 'ACCEPTED' && request.keeperQuoteAmountCents != null;

  let quoteVisible = false;
  if (hasQuote) {
    const orgOnly = request.door.settings?.quoteVisibleToVerifiedOrgsOnly ?? false;
    if (orgOnly) {
      quoteVisible = request.requesterVerificationStatus === 'ORG_VERIFIED';
    } else {
      quoteVisible =
        request.requesterVerificationStatus === 'BASIC_VERIFIED' ||
        request.requesterVerificationStatus === 'ORG_VERIFIED';
    }
  }

  return (
    <main>
      <h1>Request status</h1>
      <p>
        <strong>{request.title ?? '(No title)'}</strong>
      </p>
      <p>
        Status: <strong>{request.status}</strong>
      </p>
      <p>Submitted: {new Date(request.createdAt).toLocaleString()}</p>
      <p>Door: {request.door.displayName}</p>
      <p>
        Verification: <VerificationBadge status={request.requesterVerificationStatus} />
      </p>

      {request.status === 'AWAITING_COMPLETION' ? (
        <p>
          This request is awaiting additional information. Please check your email for a completion link.
        </p>
      ) : canReveal ? (
        <p>
          Contact detail: <strong>{request.door.settings?.revealValue ?? '(not configured)'}</strong>
        </p>
      ) : (
        <p>Contact details are only shown after acceptance.</p>
      )}

      {quoteVisible && request.keeperQuoteAmountCents != null && (
        <div style={{ padding: '12px 16px', background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 6, margin: '16px 0' }}>
          <p style={{ margin: 0 }}>
            <strong>Quote:</strong>{' '}
            {formatQuote(request.keeperQuoteAmountCents, request.keeperQuoteCurrency ?? 'USD')}
          </p>
          {request.keeperQuoteNote && (
            <p style={{ margin: '4px 0 0 0', color: '#666', fontSize: '14px' }}>
              {request.keeperQuoteNote}
            </p>
          )}
        </div>
      )}

      <hr />
      <ReportButton requestToken={token} />

      <p>
        <Link href="/">Back to Knokio portal</Link>
      </p>
    </main>
  );
}
