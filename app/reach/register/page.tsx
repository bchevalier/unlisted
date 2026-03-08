import Link from 'next/link';
import { getKeeperSessionFromCookies } from '../../../lib/keeper-auth';
import { db } from '../../../lib/db';
import { redirect } from 'next/navigation';
import { RegisterForm } from './register-form';

export default async function ReachRegisterPage() {
  const session = await getKeeperSessionFromCookies();

  if (!session) {
    return (
      <main>
        <h1>Register as Reach Actor</h1>
        <p>
          You must be signed in to register a Reach actor.{' '}
          <Link href="/direct/login?next=/reach/register">Sign in</Link>.
        </p>
      </main>
    );
  }

  // Check if already registered.
  const existing = await db.reachActor.findUnique({
    where: { userId: session.userId },
  });

  if (existing) {
    redirect('/reach');
  }

  return (
    <main>
      <h1>Register as Reach Actor</h1>
      <p>
        Create your Reach identity to send and receive contracts.
        Your actor handle will be your public identifier in the Reach network.
      </p>
      <RegisterForm email={session.email} />
    </main>
  );
}
