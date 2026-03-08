import Link from 'next/link';
import { listDoorsForDirect, listRequestsByDoorSlug } from '../../../features/direct/server/requests';
import { RequestActions } from './request-actions';

type DirectInboxPageProps = {
  searchParams?: Promise<{
    slug?: string;
  }>;
};

export default async function DirectInboxPage({ searchParams }: DirectInboxPageProps) {
  const resolvedSearchParams = (await searchParams) ?? {};

  const doors = await listDoorsForDirect();
  const defaultSlug = doors[0]?.slug;
  const selectedSlug = resolvedSearchParams.slug ?? defaultSlug;

  if (!selectedSlug) {
    return (
      <main>
        <h1>Knokio Direct Inbox</h1>
        <p>
          No doors exist yet. Seed data first with <code>npm run db:seed</code>.
        </p>
      </main>
    );
  }

  const door = await listRequestsByDoorSlug(selectedSlug);
  if (!door) {
    return (
      <main>
        <h1>Knokio Direct Inbox</h1>
        <p>Door not found.</p>
      </main>
    );
  }

  return (
    <main>
      <h1>Knokio Direct Inbox</h1>
      <p>
        Door: <strong>{door.displayName}</strong> ({door.slug})
      </p>

      <p className="inbox-links">
        {doors.map((item) => (
          <Link key={item.slug} href={`/direct/inbox?slug=${item.slug}`}>
            {item.displayName}
          </Link>
        ))}
      </p>

      {door.requests.length === 0 ? (
        <p>No requests yet.</p>
      ) : (
        <div className="inbox-list">
          {door.requests.map((request) => (
            <article key={request.id} className="inbox-card">
              <header>
                <strong>{request.title ?? '(No title)'}</strong>
                <p>
                  <span>{request.status}</span> · <span>{request.source}</span> ·{' '}
                  <span>{new Date(request.createdAt).toLocaleString()}</span>
                </p>
                <p>
                  {request.senderName ?? 'Unknown sender'}
                  {request.senderEmail ? ` (${request.senderEmail})` : ''}
                  {request.category?.label ? ` · ${request.category.label}` : ''}
                </p>
              </header>
              <p>{request.message}</p>
              <RequestActions requestId={request.id} status={request.status} />
            </article>
          ))}
        </div>
      )}
    </main>
  );
}
