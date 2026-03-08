import Link from 'next/link';
import { requireReachSession } from '../../../../features/reach/server/session';
import { PolicyForm } from './policy-form';

export default async function NewPolicyPage() {
  const session = await requireReachSession('/reach/policies/new');

  return (
    <main>
      <p>
        <Link href="/reach/policies">← Back to policies</Link>
      </p>

      <h1>New Policy</h1>
      <p>
        Create a routing policy for <strong>@{session.actorHandle}</strong>.
        Policies control how inbound contracts are automatically handled.
      </p>

      <PolicyForm actorHandle={session.actorHandle} />
    </main>
  );
}
