import Link from 'next/link';

import { getServerAuthSession } from '../lib/auth';
import { SignOutButton } from './sign-out-button';

export default async function HomePage() {
  const session = await getServerAuthSession();

  return (
    <main className="home">
      <section className="hero">
        <p className="eyebrow">Knokio</p>
        <h1>Be reachable without being exposed</h1>
        <p className="lede">
          Knokio turns cold outreach into structured, on-your-terms requests. Keep control while
          staying open to the right opportunities.
        </p>

        {session ? (
          <div className="session-card">
            <p className="session-title">You are signed in</p>
            <p className="session-copy">{session.user?.email ?? 'Your account'}</p>
            <div className="actions">
              <span className="chip">Sessions stored securely</span>
              <SignOutButton />
            </div>
          </div>
        ) : (
          <div className="actions">
            <Link className="button primary" href="/auth/signup">
              Create your account
            </Link>
            <Link className="button secondary" href="/auth/login">
              Log in
            </Link>
          </div>
        )}
      </section>

      <section className="pillars">
        <div className="pillar">
          <h2>Structured by default</h2>
          <p>Requests land in a format you choose, with the signal you need to act quickly.</p>
        </div>
        <div className="pillar">
          <h2>Control every step</h2>
          <p>Set limits, decide when to reveal contact details, and decline silently when needed.</p>
        </div>
        <div className="pillar">
          <h2>Secure foundation</h2>
          <p>Database-backed sessions, hashed passwords, and environment-driven secrets.</p>
        </div>
      </section>
    </main>
  );
}
