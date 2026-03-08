import Link from 'next/link';
import { requireReachSession } from '../../../features/reach/server/session';
import { listEscalatedContractsForActor } from '../../../features/reach/server/contracts';

type EscalationsPageProps = {
  searchParams?: Promise<{ page?: string }>;
};

function formatContractType(type: string): string {
  return type.replace(/_/g, ' → ').replace(/HUMAN/g, 'Human').replace(/AI/g, 'AI');
}

export default async function ReachEscalationsPage({ searchParams }: EscalationsPageProps) {
  const session = await requireReachSession('/reach/escalations');
  const params = (await searchParams) ?? {};
  const page = Math.max(1, Number(params.page) || 1);

  const result = await listEscalatedContractsForActor(session.actorId, page);
  const { contracts, pagination } = result;

  return (
    <main>
      <h1>Escalation Queue</h1>
      <p>
        Contracts escalated to you for human review.
        These require a manual decision before proceeding.
      </p>

      <p className="inbox-count">
        {pagination.totalCount} escalated contract{pagination.totalCount !== 1 ? 's' : ''}
      </p>

      {contracts.length === 0 ? (
        <p>No contracts pending human review. 🎉</p>
      ) : (
        <>
          <div className="inbox-list">
            {contracts.map((contract) => (
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
                    <span className="contract-status contract-status-proposed">
                      ESCALATED
                    </span>
                    {' · '}
                    <span>{formatContractType(contract.type)}</span>
                    {' · '}
                    <span>{new Date(contract.createdAt).toLocaleString()}</span>
                  </p>
                  <p>
                    ← From <strong>{contract.initiator.displayName}</strong>{' '}
                    (@{contract.initiator.handle}) · {contract.initiator.type}
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
            ))}
          </div>

          {pagination.totalPages > 1 && (
            <nav className="inbox-pagination">
              {page > 1 && (
                <Link href={`/reach/escalations?page=${page - 1}`}>← Previous</Link>
              )}
              <span>
                Page {pagination.page} of {pagination.totalPages}
              </span>
              {page < pagination.totalPages && (
                <Link href={`/reach/escalations?page=${page + 1}`}>Next →</Link>
              )}
            </nav>
          )}
        </>
      )}
    </main>
  );
}
