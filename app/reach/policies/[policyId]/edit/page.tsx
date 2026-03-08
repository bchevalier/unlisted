import Link from 'next/link';
import { requireReachSession } from '../../../../../features/reach/server/session';
import { db } from '../../../../../lib/db';
import { PolicyEditForm } from './policy-edit-form';

type EditPolicyPageProps = {
  params: Promise<{ policyId: string }>;
};

export default async function EditPolicyPage({ params }: EditPolicyPageProps) {
  const session = await requireReachSession('/reach/policies');
  const { policyId } = await params;

  const policy = await db.reachPolicy.findUnique({
    where: { id: policyId },
  });

  if (!policy || policy.actorId !== session.actorId) {
    return (
      <main>
        <h1>Policy Not Found</h1>
        <p>This policy does not exist or is not accessible.</p>
        <Link href="/reach/policies">← Back to policies</Link>
      </main>
    );
  }

  return (
    <main>
      <p>
        <Link href="/reach/policies">← Back to policies</Link>
      </p>

      <h1>Edit Policy: {policy.name}</h1>

      <PolicyEditForm
        policyId={policy.id}
        initial={{
          name: policy.name,
          contractTypes: policy.contractTypes as string[],
          action: policy.action,
          priority: policy.priority,
          maxWeeklyInbound: policy.maxWeeklyInbound,
          requireVerifiedSender: policy.requireVerifiedSender,
          autoAcceptMatching: policy.autoAcceptMatching,
          escalateToHuman: policy.escalateToHuman,
          isActive: policy.isActive,
        }}
      />
    </main>
  );
}
