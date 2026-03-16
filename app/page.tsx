import Link from 'next/link';

export default function HomePage() {
  return (
    <main className="home">
      <header className="home-topbar">
        <div className="home-topbar-brand">
          <span className="home-topbar-title">Knokio</span>
        </div>
        <nav className="home-topbar-actions" aria-label="Primary">
          <Link className="topbar-link" href="/direct/login">
            Log in
          </Link>
          <Link className="topbar-button" href="/direct/signup">
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
          <span className="eyebrow">Knokio</span>
          <h1 className="hero-title">Be reachable. Stay private.</h1>
          <p className="hero-subtitle">
            A privacy-first coordination layer for structured inbound: reduce noise, keep control, and stay
            accessible on your terms.
          </p>

          <div className="hero-actions">
            <Link className="button primary" href="/direct">
              Open Knokio Direct
            </Link>
            <Link className="button secondary" href="/reach">
              Open Knokio Reach
            </Link>
          </div>
        </div>
      </section>

      <section className="pillars">
        <div className="pillar">
          <h2>
            <span className="accent accent-cyan">Direct</span> filters your inbound
          </h2>
          <p>Collect structured requests, set boundaries, and protect your attention by default.</p>
        </div>
        <div className="pillar">
          <h2>
            <span className="accent accent-magenta">Reach</span> compresses coordination distance
          </h2>
          <p>Find and connect with the right human or agent through policy-bound pathways.</p>
        </div>
      </section>
    </main>
  );
}
