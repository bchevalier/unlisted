import React from 'react';
import Image from 'next/image';
import Link from 'next/link';

const laneCards = [
  {
    title: 'Knokio Direct',
    description: 'For creators, advisors, and public-facing people who need serious inbound without inbox chaos.',
    href: '/direct',
    action: 'Open Direct',
    cardClass: 'lane-card-direct',
    buttonClass: 'lane-button-direct',
  },
  {
    title: 'Knokio Reach',
    description: "One-hop reachability, even for people who don't know you yet.",
    href: '/reach',
    action: 'Open Reach',
    cardClass: 'lane-card-reach',
    buttonClass: 'lane-button-reach',
  },
] as const;

export default function HomePage() {
  return (
    <main className="home home-main">
      <header className="home-topbar">
        <div className="home-topbar-brand">
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
        </div>
        <nav className="home-topbar-actions" aria-label="Primary">
          <Link className="topbar-link" href="/direct/login">
            Log in
          </Link>
          <Link className="topbar-button" href="/direct/signup">
            Create account
          </Link>
        </nav>
      </header>

      <section className="home-hero" aria-label="Knokio introduction">
        <div className="home-hero-bg" aria-hidden="true">
          <div className="home-hero-grid" />
          <div data-hero-gradient="true" className="hero-gradient-rainbow home-hero-gradient" />
        </div>

        <div className="home-hero-content">
          <p className="hero-word">KNOKIO</p>
          <h1 className="hero-title">Protect your inbox. Stay reachable for serious opportunities.</h1>
          <p className="hero-subtitle">
            Creators, advisors, and public-facing professionals can stay reachable for brand outreach, advisory
            requests, and business inquiries without exposing private contact details.
          </p>

          <section className="lane-cards hero-lane-cards" aria-label="Choose your lane">
            {laneCards.map((card) => (
              <article key={card.title} className={`lane-card ${card.cardClass}`}>
                <h3 className="lane-title">{card.title}</h3>
                <p>{card.description}</p>
                <Link className={`button lane-card-action ${card.buttonClass}`} href={card.href}>
                  {card.action}
                </Link>
              </article>
            ))}
          </section>

          <p className="hero-meta">Private by default · Direct filters · Reach in one hop · High-intent access lanes</p>
        </div>
      </section>
    </main>
  );
}
