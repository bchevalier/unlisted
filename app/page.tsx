import Image from 'next/image';
import Link from 'next/link';

import { getServerAuthSession } from '../lib/auth';
import { SignOutButton } from './sign-out-button';

export default async function HomePage() {
  const session = await getServerAuthSession();

  return (
    <main className="home">
      <header className="home-topbar">
        <div className="home-topbar-brand">
          <Image
            src="/assets/logo_xs.png"
            alt="Knokio logo"
            width={34}
            height={34}
            className="home-topbar-logo"
          />
          <span className="home-topbar-title">Knokio</span>
        </div>
        <nav className="home-topbar-actions" aria-label="Primary">
          <Link className="topbar-link" href="/auth/login">
            Log in
          </Link>
          <Link className="topbar-button" href="/auth/signup">
            Sign up
          </Link>
        </nav>
      </header>

      <section className="home-hero" aria-label="Knokio introduction">
        <div className="home-hero-bg" aria-hidden="true">
          <div className="home-hero-grid" />
          <div data-hero-gradient="true" className="hero-gradient-rainbow home-hero-gradient" />
        </div>

        <div className="home-hero-content">
          <div className="hero-brand">
            {/* <Image
              className="hero-brand-logo"
              src="/assets/logo_s.png"
              alt="Knokio logo"
              width={44}
              height={44}
            /> */}
            <span className="eyebrow">Knokio</span>
          </div>
          <h1 className="hero-title">Be reachable. Stay private.</h1>
          <p className="hero-subtitle">
            Share a public door instead of your email or DMs. Requests arrive structured, with
            filters, forwarding rules, and auto-replies—so you stay in control.
          </p>

          {session ? (
            <div className="hero-actions">
              <div className="session-inline">
                <span className="session-inline-label">Signed in as</span>
                <span className="session-inline-value">{session.user?.email ?? 'Your account'}</span>
              </div>
              <SignOutButton />
            </div>
          ) : (
            <div className="hero-actions">
              <Link className="button primary" href="/auth/signup">
                Create your account
              </Link>
            </div>
          )}
        </div>
      </section>

      <section className="pillars">
        <div className="pillar">
          <h2>
            Be <span className="accent accent-cyan">reachable</span> without being public
          </h2>
          <p>
            Share one door link people can use—without exposing your personal email, phone number, or
            inbox.
          </p>
        </div>
        <div className="pillar">
          <h2>
            <span className="accent accent-cyan">Consent</span> and{' '}
            <span className="accent accent-magenta">control</span>, customizable
          </h2>
          <p>Filter requests, route them where you want, and auto-reply when needed.</p>
        </div>
        <div className="pillar">
          <h2>
            <span className="accent accent-gradient">Structured</span> messages
          </h2>
          <p>Collect the right info up front so every request is easy to triage.</p>
        </div>
      </section>
    </main>
  );
}
