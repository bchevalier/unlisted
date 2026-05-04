import Image from 'next/image';
import Link from 'next/link';
import type { ReactNode } from 'react';
import { isReachEnabled } from '../../lib/flags';
import { getReachSession } from '../../features/reach/server/session';

type ReachLayoutProps = {
  children: ReactNode;
};

export default async function ReachLayout({ children }: ReachLayoutProps) {
  if (!isReachEnabled()) {
    return (
      <main>
        <h1>Knokio Reach</h1>
        <p>Reach is currently disabled by runtime flag.</p>
        <p>
          Return to <Link href="/">Knokio portal</Link>.
        </p>
      </main>
    );
  }

  const session = await getReachSession();

  return (
    <div className="reach-layout-shell">
      <header className="home-topbar direct-topbar direct-topbar-sticky reach-topbar">
        <Link href="/" className="home-topbar-brand direct-topbar-brand">
          <Image
            className="home-topbar-logo"
            src="/knokio-logo-small.jpg"
            alt=""
            aria-hidden="true"
            width={22}
            height={22}
            priority
          />
          <span className="home-topbar-title">Knokio</span>
          <span className="direct-topbar-separator" aria-hidden="true">
            /
          </span>
          <span className="direct-topbar-context reach-topbar-context">Reach</span>
        </Link>

        {session ? (
          <nav className="home-topbar-actions reach-topbar-nav" aria-label="Reach navigation">
            <Link className="topbar-link" href="/reach/contracts">
              Contracts
            </Link>
            <Link className="topbar-link" href="/reach/escalations">
              Escalations
            </Link>
            <Link className="topbar-link" href="/reach/policies">
              Policies
            </Link>
            <Link className="topbar-link" href="/reach/metrics">
              Metrics
            </Link>
            <Link className="topbar-cta-primary reach-topbar-cta" href="/reach/settings">
              Settings
            </Link>
          </nav>
        ) : (
          <nav className="home-topbar-actions" aria-label="Reach actions">
            <Link className="topbar-link" href="/direct/login?next=/reach">
              Log in
            </Link>
            <Link className="topbar-link" href="/reach#reach-demo">
              Demo
            </Link>
            <Link className="topbar-cta-primary reach-topbar-cta" href="/reach/register">
              Register Reach actor
            </Link>
          </nav>
        )}
      </header>
      {children}
    </div>
  );
}
