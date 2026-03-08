import Link from 'next/link';
import { getRequestForCompletion } from '../../../features/direct/server/requests';
import { CompletionForm } from './completion-form';

type CompletionPageProps = {
  params: Promise<{
    token: string;
  }>;
};

export default async function CompletionPage({ params }: CompletionPageProps) {
  const { token } = await params;
  const result = await getRequestForCompletion(token);

  if (!result) {
    return (
      <main>
        <h1>Link not found</h1>
        <p>This completion link is invalid.</p>
      </main>
    );
  }

  if (result.status !== 'ready') {
    return (
      <main>
        <h1>Link expired</h1>
        <p>
          {result.reason === 'already_completed'
            ? 'This request has already been completed.'
            : 'This completion link has expired. Please send your email again to receive a new link.'}
        </p>
        <p>
          <Link href="/">Back to Knokio</Link>
        </p>
      </main>
    );
  }

  const { request } = result;

  return (
    <main className="door-page">
      <header className="door-page__header">
        <p className="door-page__eyebrow">Knokio Direct — Complete your request</p>
        <h1>{request.door.displayName}</h1>
        {request.door.headline ? <p>{request.door.headline}</p> : null}
      </header>

      <section className="door-page__body">
        <div className="completion-context">
          <p>
            Your email was received, but this door requires additional information. Please select a category and
            fill in the required fields below.
          </p>
          {request.title ? (
            <p>
              <strong>Subject:</strong> {request.title}
            </p>
          ) : null}
          <p>
            <strong>From:</strong> {request.senderEmail ?? 'Unknown sender'}
          </p>
        </div>

        <CompletionForm
          completionToken={token}
          categories={request.door.categories}
        />
      </section>

      <footer className="door-page__footer">
        <p>
          Private by default. Reachable without searchable. <Link href="/">Back to Knokio</Link>
        </p>
      </footer>
    </main>
  );
}
