import Link from 'next/link';

export default function HomePage() {
  return (
    <main className="home">
      <header className="topbar">
        <div className="topbar__brand">Knokio</div>
        <div className="topbar__actions" aria-label="Authentication actions">
          <Link className="button secondary" href="/direct/login">
            Log in
          </Link>
          <Link className="button primary" href="/direct/signup">
            Sign up
          </Link>
        </div>
      </header>

      <section className="hero">
        <p className="eyebrow">Privacy-first reachability</p>
        <h1>Be reachable without being exposed</h1>
        <p className="lede">
          Knokio turns cold outreach into structured, on-your-terms requests. Keep control while staying open
          to the right opportunities.
        </p>

        <div className="actions" aria-label="Primary navigation">
          <Link className="button primary" href="/direct">
            Open Knokio Direct
          </Link>
          <Link className="button secondary" href="/reach">
            Open Knokio Reach
          </Link>
        </div>
      </section>

      <section className="clients" aria-label="Client lanes">
        <article className="client-card">
          <h2>Knokio Direct</h2>
          <p>Protect your attention with filtered inbound and strict privacy by default.</p>
          <Link className="client-link" href="/direct">
            Go to Direct →
          </Link>
        </article>
        <article className="client-card">
          <h2>Knokio Reach</h2>
          <p>Find and reach the right human or agent through policy-bound coordination paths.</p>
          <Link className="client-link" href="/reach">
            Go to Reach →
          </Link>
        </article>
      </section>

      <section className="pillars">
        <div className="pillar">
          <h3>Structured by default</h3>
          <p>Requests land with the signal you need so triage stays fast and clear.</p>
        </div>
        <div className="pillar">
          <h3>Control every step</h3>
          <p>Set boundaries, choose reveal methods, and keep noise away from your inbox.</p>
        </div>
        <div className="pillar">
          <h3>Built for trust</h3>
          <p>Privacy-first defaults with clear rules for who gets access and when.</p>
        </div>
      </section>
    </main>
  );
}
