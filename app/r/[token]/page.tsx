import Link from 'next/link';
import { db } from '../../../lib/db';
import { ReportButton } from './report-button';

type RequestStatusPageProps = {
  params: Promise<{
    token: string;
  }>;
};

export default async function RequestStatusPage({ params }: RequestStatusPageProps) {
  const { token } = await params;

  const request = await db.request.findUnique({
    where: { requestToken: token },
    select: {
      status: true,
      title: true,
      createdAt: true,
      door: {
        select: {
          displayName: true,
          settings: {
            select: {
              revealMethod: true,
              revealValue: true
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

      <hr />
      <ReportButton requestToken={token} />

      <p>
        <Link href="/">Back to Knokio portal</Link>
      </p>
    </main>
  );
}
