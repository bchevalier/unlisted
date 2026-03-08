import Link from 'next/link';
import { requireReachSession } from '../../../features/reach/server/session';
import {
  listContractsForActor,
  isValidContractStatus,
} from '../../../features/reach/server/contracts';
import type { ReachContractStatus } from '../../../lib/reach/contracts';

type ContractsPageProps = {
  searchParams?: Promise<{
    role?: string;
    status?: string;
    page?: string;
  }>;
};

const STATUS_TABS: { value: string; label: string }[] = [
  { value: '', label: 'All' },
  { value: 'PROPOSED', label: 'Proposed' },
  { value: 'ACTIVE', label: 'Active' },
  { value: 'FULFILLED', label: 'Fulfilled' },
  { value: 'REJECTED', label: 'Rejected' },
  { value: 'CANCELLED', label: 'Cancelled' },
  { value: 'EXPIRED', label: 'Expired' },
];

const ROLE_TABS: { value: string; label: string }[] = [
  { value: 'both', label: 'All' },
  { value: 'target', label: 'Inbound' },
  { value: 'initiator', label: 'Outbound' },
];

function formatContractType(type: string): string {
  return type.replace(/_/g, ' → ').replace(/HUMAN/g, 'Human').replace(/AI/g, 'AI');
}

export default async function ReachContractsPage({ searchParams }: ContractsPageProps) {
  const session = await requireReachSession('/reach/contracts');
  const params = (await searchParams) ?? {};

  const role = (['initiator', 'target', 'both'].includes(params.role ?? '')
    ? params.role
    : 'both') as 'initiator' | 'target' | 'both';
  const status =
    params.status && isValidContractStatus(params.status)
      ? (params.status as ReachContractStatus)
      : undefined;
  const page = Math.max(1, Number(params.page) || 1);

  const result = await listContractsForActor(session.actorId, { role, status, page });
  const { contracts, pagination, statusCounts } = result;

  function buildUrl(overrides: Record<string, string | number | undefined>): string {
    const base: Record<string, string> = {};
    if (role !== 'both') base.role = role;
    if (status) base.status = status;
    for (const [k, v] of Object.entries(overrides)) {
      if (v !== undefined && v !== '' && v !== 'both' && !(k === 'page' && v === 1)) {
        base[k] = String(v);
      } else {
        delete base[k];
      }
    }
    const qs = new URLSearchParams(base).toString();
    return `/reach/contracts${qs ? `?${qs}` : ''}`;
  }

  const totalAll = Object.values(statusCounts).reduce((sum, n) => sum + n, 0);

  return (
    <main>
      <h1>Reach Contracts</h1>
      <p>
        <strong>{session.actorDisplayName}</strong> (@{session.actorHandle})
      </p>

      {/* Role filter */}
      <nav className="inbox-filters">
        {ROLE_TABS.map((tab) => {
          const isActive = tab.value === role;
          return (
            <Link
              key={tab.value}
              href={buildUrl({ role: tab.value, page: 1, status: status ?? undefined })}
              className={isActive ? 'filter-active' : 'filter-inactive'}
            >
              {tab.label}
            </Link>
          );
        })}
      </nav>

      {/* Status filter */}
      <nav className="inbox-filters">
        {STATUS_TABS.map((tab) => {
          const isActive = (tab.value === '' && !status) || tab.value === status;
          const count =
            tab.value === '' ? totalAll : (statusCounts[tab.value] ?? 0);
          return (
            <Link
              key={tab.value}
              href={buildUrl({ status: tab.value || undefined, page: 1 })}
              className={isActive ? 'filter-active' : 'filter-inactive'}
            >
              {tab.label} ({count})
            </Link>
          );
        })}
      </nav>

      <p className="inbox-count">
        {pagination.totalCount} contract{pagination.totalCount !== 1 ? 's' : ''}
        {status ? ` (${status.toLowerCase()})` : ''}
      </p>

      {contracts.length === 0 ? (
        <p>No contracts{status ? ` with status "${status.toLowerCase()}"` : ''} yet.</p>
      ) : (
        <>
          <div className="inbox-list">
            {contracts.map((contract) => {
              const isInbound = contract.target.id === session.actorId;
              const counterparty = isInbound ? contract.initiator : contract.target;
              return (
                <article key={contract.id} className="inbox-card">
                  <header>
                    <strong>
                      <Link href={`/reach/contracts/${contract.id}`}>
                        {contract.purpose.length > 80
                          ? `${contract.purpose.slice(0, 80)}…`
                          : contract.purpose}
                      </Link>
                    </strong>
                    <p>
                      <span className={`contract-status contract-status-${contract.status.toLowerCase()}`}>
                        {contract.status}
                      </span>
                      {' · '}
                      <span>{formatContractType(contract.type)}</span>
                      {' · '}
                      <span>{new Date(contract.createdAt).toLocaleString()}</span>
                    </p>
                    <p>
                      {isInbound ? '← From' : '→ To'}{' '}
                      <strong>{counterparty.displayName}</strong> (@{counterparty.handle})
                      {' · '}
                      {counterparty.type}
                    </p>
                  </header>
                  {contract.message && (
                    <p>
                      {contract.message.length > 200
                        ? `${contract.message.slice(0, 200)}…`
                        : contract.message}
                    </p>
                  )}
                </article>
              );
            })}
          </div>

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
