import Link from 'next/link';
import type { ReactNode } from 'react';
import { isReachEnabled } from '../../lib/flags';

type ReachLayoutProps = {
  children: ReactNode;
};

export default function ReachLayout({ children }: ReachLayoutProps) {
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

  return (
    <div className="reach-layout">
      <nav className="reach-nav">
        <strong>
          <Link href="/reach">Knokio Reach</Link>
        </strong>
        <span className="reach-nav-links">
          <Link href="/reach/contracts">Contracts</Link>
          <Link href="/reach/escalations">Escalations</Link>
          <Link href="/reach/policies">Policies</Link>
          <Link href="/reach/settings">Settings</Link>
        </span>
      </nav>
      {children}
    </div>
  );
}
