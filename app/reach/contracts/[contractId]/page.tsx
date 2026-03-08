import Link from 'next/link';
import { requireReachSession } from '../../../../features/reach/server/session';
import { getContractForActor } from '../../../../features/reach/server/contracts';
import { ContractActions } from './contract-actions';

type ContractDetailPageProps = {
  params: Promise<{ contractId: string }>;
};

function formatContractType(type: string): string {
  return type.replace(/_/g, ' → ').replace(/HUMAN/g, 'Human').replace(/AI/g, 'AI');
}

export default async function ReachContractDetailPage({ params }: ContractDetailPageProps) {
  const session = await requireReachSession('/reach/contracts');
  const { contractId } = await params;

  const contract = await getContractForActor(session.actorId, contractId);

  if (!contract) {
    return (
      <main>
        <h1>Contract Not Found</h1>
        <p>This contract does not exist or is not accessible.</p>
        <Link href="/reach/contracts">← Back to contracts</Link>
      </main>
    );
  }

  const isTarget = contract.target.id === session.actorId;
  const isInitiator = contract.initiator.id === session.actorId;
  const counterparty = isTarget ? contract.initiator : contract.target;

  return (
    <main>
      <p>
        <Link href="/reach/contracts">← Back to contracts</Link>
      </p>

      <h1>{contract.purpose}</h1>

      <table className="detail-meta">
        <tbody>
          <tr>
            <td><strong>Status</strong></td>
            <td>
              <span className={`contract-status contract-status-${contract.status.toLowerCase()}`}>
                {contract.status}
              </span>
            </td>
          </tr>
          <tr>
            <td><strong>Type</strong></td>
            <td>{formatContractType(contract.type)}</td>
          </tr>
          <tr>
            <td><strong>Your role</strong></td>
            <td>{isTarget ? 'Target (inbound)' : 'Initiator (outbound)'}</td>
          </tr>
          <tr>
            <td><strong>Counterparty</strong></td>
            <td>
              {counterparty.displayName} (@{counterparty.handle}) · {counterparty.type}
            </td>
          </tr>
          <tr>
            <td><strong>Created</strong></td>
            <td>{new Date(contract.createdAt).toLocaleString()}</td>
          </tr>
          {contract.expiresAt && (
            <tr>
              <td><strong>Expires</strong></td>
              <td>{new Date(contract.expiresAt).toLocaleString()}</td>
            </tr>
          )}
          {contract.routedAt && (
            <tr>
              <td><strong>Routed</strong></td>
              <td>{new Date(contract.routedAt).toLocaleString()}</td>
            </tr>
          )}
          {contract.resolvedAt && (
            <tr>
              <td><strong>Resolved</strong></td>
              <td>{new Date(contract.resolvedAt).toLocaleString()}</td>
            </tr>
          )}
          {contract.policyId && (
            <tr>
              <td><strong>Matched policy</strong></td>
              <td><code>{contract.policyId}</code></td>
            </tr>
          )}
        </tbody>
      </table>

      {contract.message && (
        <>
          <h2>Message</h2>
          <div className="detail-message">
            <p style={{ whiteSpace: 'pre-wrap' }}>{contract.message}</p>
          </div>
        </>
      )}

      {(() => {
        const sd = contract.structuredData as Record<string, unknown> | null;
        if (!sd || typeof sd !== 'object' || Object.keys(sd).length === 0) return null;
        return (
          <>
            <h2>Structured Data</h2>
            <table className="detail-meta">
              <tbody>
                {Object.entries(sd).map(([key, value]) => (
                  <tr key={key}>
                    <td><strong>{key}</strong></td>
                    <td>{String(value)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </>
        );
      })()}

      <ContractActions
        contractId={contract.id}
        status={contract.status}
        isTarget={isTarget}
        isInitiator={isInitiator}
      />

      {contract.events.length > 0 && (
        <>
          <h2>Event Timeline</h2>
          <div className="detail-events">
            {contract.events.map((event) => (
              <div key={event.id} className="event-row">
                <span className="event-type">{event.type}</span>
                <span className="event-actor">{event.actor}</span>
                <span className="event-time">
                  {new Date(event.createdAt).toLocaleString()}
                </span>
                {event.note && <span className="event-note">{event.note}</span>}
              </div>
            ))}
          </div>
        </>
      )}
    </main>
  );
}
