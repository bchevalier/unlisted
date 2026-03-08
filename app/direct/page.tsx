import Link from 'next/link';
import { getKeeperSessionFromCookies } from '../../lib/keeper-auth';
import { LogoutButton } from './logout-button';

export default async function DirectClientPage() {
  const session = await getKeeperSessionFromCookies();

  return (
    <main>
      <h1>Knokio Direct</h1>
      <p>Filtered inbound for people who want to stay reachable without inbox chaos.</p>

      {session ? (
        <p>
          Signed in as <strong>{session.email}</strong> <LogoutButton />
        </p>
      ) : (
        <p>
          <Link href="/direct/login">Login</Link> · <Link href="/direct/signup">Create account</Link>
        </p>
      )}

      <ul>
        <li>
          Demo public door: <Link href="/u/john">/u/john</Link>
        </li>
        <li>
          Demo inbox: <Link href="/direct/inbox?slug=john">/direct/inbox?slug=john</Link>
        </li>
        <li>
          Demo settings: <Link href="/direct/settings?slug=john">/direct/settings?slug=john</Link>
        </li>
      </ul>

      <p>
        If this is a fresh environment, run <code>npm run db:seed</code> first.
      </p>
    </main>
  );
}
