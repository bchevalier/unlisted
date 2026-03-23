import React from 'react';
import Link from 'next/link';
import { RequestStatus } from '@prisma/client';
import {
  DIRECT_DEMO_SLUG,
  getDirectDemoInboxFixture,
  isDirectDemoFixture,
} from '../../../features/direct/demo-fixtures';
import {
  listDoorsForKeeper,
  listRequestsByDoorSlugForKeeper
} from '../../../features/direct/server/requests';
import { requireKeeperSession } from '../../../features/direct/server/session';
import { OutcomeSummary } from './outcome-summary';
import { RequestActions } from './request-actions';

type DirectInboxPageProps = {
  searchParams?: Promise<{
    slug?: string;
    page?: string;
    status?: string;
    fixture?: string;
  }>;
};

const STATUS_OPTIONS: { value: string; label: string }[] = [
  { value: '', label: 'All' },
  { value: 'PENDING', label: 'Pending' },
  { value: 'AWAITING_COMPLETION', label: 'Awaiting completion' },
  { value: 'ACCEPTED', label: 'Accepted' },
  { value: 'DECLINED', label: 'Declined' },
  { value: 'EXPIRED', label: 'Expired' }
];

function isValidStatus(value: string): value is RequestStatus {
  return ['PENDING', 'ACCEPTED', 'DECLINED', 'EXPIRED', 'AWAITING_COMPLETION'].includes(value);
}

export default async function DirectInboxPage({ searchParams }: DirectInboxPageProps) {
  const session = await requireKeeperSession('/direct/inbox');
  const resolvedSearchParams = (await searchParams) ?? {};

  const doors = await listDoorsForKeeper(session.userId);
  const useDemoFixture = isDirectDemoFixture(resolvedSearchParams.fixture);
  const defaultSlug = doors[0]?.slug ?? (useDemoFixture ? DIRECT_DEMO_SLUG : undefined);
  const selectedSlug = resolvedSearchParams.slug ?? defaultSlug;

  if (!selectedSlug) {
    return (
      <main>
        <h1>Knokio Direct Inbox</h1>
        <p>No doors exist yet. Create one from signup.</p>
      </main>
    );
  }

  const page = Math.max(1, Number(resolvedSearchParams.page) || 1);
  const statusFilter = resolvedSearchParams.status && isValidStatus(resolvedSearchParams.status)
    ? resolvedSearchParams.status as RequestStatus
    : undefined;

  const door = useDemoFixture
    ? getDirectDemoInboxFixture({
        doorSlug: selectedSlug,
        page,
        status: statusFilter,
      })
    : await listRequestsByDoorSlugForKeeper(session.userId, selectedSlug, {
        page,
        status: statusFilter
      });

  if (!door) {
    return (
      <main>
        <h1>Knokio Direct Inbox</h1>
        <p>Door not found or not owned by this account.</p>
      </main>
    );
  }

  const { pagination } = door;
  const doorLinks = useDemoFixture && !doors.some((item) => item.slug === door.slug)
    ? [{ slug: door.slug, displayName: `${door.displayName} demo`, plan: door.plan }, ...doors]
    : doors;

  function buildUrl(params: Record<string, string | number | undefined>) {
    const base: Record<string, string> = { slug: selectedSlug };
    if (statusFilter) base.status = statusFilter;
    if (useDemoFixture) base.fixture = resolvedSearchParams.fixture ?? 'demo';
    for (const [k, v] of Object.entries(params)) {
      if (v !== undefined && v !== '' && v !== 1) {
        base[k] = String(v);
      } else {
        delete base[k];
      }
    }
    const qs = new URLSearchParams(base).toString();
    return `/direct/inbox?${qs}`;
  }

  return (
    <main>
      <h1>Knokio Direct Inbox</h1>
      <p>
        Signed in as <strong>{session.email}</strong>
      </p>
      <p>
        Door: <strong>{door.displayName}</strong> ({door.slug}) · Plan: <strong>{door.plan}</strong>
      </p>

      <p className="inbox-links">
        {doorLinks.map((item) => (
          <Link
            key={item.slug}
            href={buildUrl({ slug: item.slug, page: 1 })}
          >
            {item.displayName} ({item.plan})
          </Link>
        ))}
      </p>

      <p className="inbox-links">
        <Link href={useDemoFixture ? `/direct/settings?slug=${door.slug}&fixture=demo` : `/direct/settings?slug=${door.slug}`}>
          Settings
        </Link>
        <Link href={`/u/${door.slug}`} target="_blank">
          Open public door
        </Link>
      </p>

      {/* Status filter tabs with counts */}
      <nav className="inbox-filters">
        {STATUS_OPTIONS.map((opt) => {
          const isActive = (opt.value === '' && !statusFilter) || opt.value === statusFilter;
          const count = opt.value === ''
            ? Object.values(door.statusCounts).reduce((sum, n) => sum + n, 0)
            : (door.statusCounts[opt.value] ?? 0);
          return (
            <Link
              key={opt.value}
              href={buildUrl({ status: opt.value || undefined, page: 1 })}
              className={isActive ? 'filter-active' : 'filter-inactive'}
            >
              {opt.label} ({count})
            </Link>
          );
        })}
      </nav>

      <p className="inbox-count">
        {pagination.totalCount} request{pagination.totalCount !== 1 ? 's' : ''}
        {statusFilter ? ` (${statusFilter.toLowerCase()})` : ''}
      </p>

      {door.requests.length === 0 ? (
        <p>No requests{statusFilter ? ` with status "${statusFilter.toLowerCase()}"` : ''} yet.</p>
      ) : (
        <>
          <OutcomeSummary requests={door.requests} />
          <div className="inbox-list">
            {door.requests.map((request) => (
              <article key={request.id} className="inbox-card">
                <header>
                  <strong>
                    <Link
                      href={`/direct/inbox/${request.id}?slug=${selectedSlug}${useDemoFixture ? '&fixture=demo' : ''}`}
                    >
                      {request.title ?? '(No title)'}
                    </Link>
                  </strong>
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
                <p>{request.message.length > 200 ? `${request.message.slice(0, 200)}…` : request.message}</p>
                <RequestActions requestId={request.id} status={request.status as 'PENDING' | 'ACCEPTED' | 'DECLINED' | 'EXPIRED' | 'AWAITING_COMPLETION'} />
              </article>
            ))}
          </div>

          {/* Pagination controls */}
          {pagination.totalPages > 1 && (
            <nav className="inbox-pagination">
              {page > 1 && (
                <Link href={buildUrl({ page: page - 1 })}>← Previous</Link>
              )}
              <span>
                Page {pagination.page} of {pagination.totalPages}
              </span>
              {page < pagination.totalPages && (
                <Link href={buildUrl({ page: page + 1 })}>Next →</Link>
              )}
            </nav>
          )}
        </>
      )}
    </main>
  );
}
