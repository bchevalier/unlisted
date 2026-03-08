import Link from 'next/link';
import { requireReachSession } from '../../../../../features/reach/server/session';
import { WebhookForm } from './webhook-form';

export default async function NewWebhookPage() {
  const session = await requireReachSession('/reach/settings/webhooks/new');

  return (
    <main>
      <p>
        <Link href="/reach/settings/webhooks">← Back to webhooks</Link>
      </p>

      <h1>New Webhook</h1>
      <p>
        Register a webhook endpoint for <strong>@{session.actorHandle}</strong>.
        You&apos;ll receive a signing secret after creation — save it, as it&apos;s only shown once.
      </p>

      <WebhookForm actorHandle={session.actorHandle} />
    </main>
  );
}
