import React from 'react';
import Image from 'next/image';
import Link from 'next/link';

const laneCards = [
  {
    product: 'Knokio Direct',
    title: 'Protect your inbox',
    description: 'Filter inbound requests before they reach your email, DMs, or private channels.',
    proofTitle: 'Inbound control',
    proofDescription: 'Direct filters and structures inbound before it reaches your private channels.',
    href: '/direct',
    action: 'Protect my inbox',
    cardClass: 'lane-card-direct',
    buttonClass: 'lane-button-direct',
  },
  {
    product: 'Knokio Reach',
    title: 'Be reachable without a public profile',
    description: 'Create a private identity people can reach without disclosing who you are before you accept.',
    proofTitle: 'Private contact path',
    proofDescription: 'People do not browse you. Reach gives the right requests a private path to you.',
    href: '/reach',
    action: 'Set up Reach',
    cardClass: 'lane-card-reach',
    buttonClass: 'lane-button-reach',
  },
] as const;

const suiteProofStrip = [
  {
    title: 'Access layer',
    description: 'Knokio sits between the outside world and the private channels behind it.',
  },
  {
    title: 'Private until approved',
    description: 'Your real channels stay private until you approve the interaction.',
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
          <h1 className="hero-title">Be accessible without being vulnerable.</h1>
          <p className="hero-subtitle">
            Knokio is the access layer between you and the outside world. More signal. Less noise. Private until
            approved.
          </p>
          <p className="home-concrete-line">
            Filter inbound requests before they reach your email, DMs, or private channels — or create a private
            identity people can reach before you choose to respond.
          </p>

          <section className="home-proof-strip" aria-label="Knokio proof strip">
            {suiteProofStrip.map((item) => (
              <article key={item.title} className="home-proof-card home-proof-card-featured">
                <p className="home-proof-title">{item.title}</p>
                <p className="home-proof-copy">{item.description}</p>
              </article>
            ))}
          </section>

          <p className="home-lane-intro">Choose the access problem you want Knokio to solve.</p>

          <section className="lane-cards hero-lane-cards" aria-label="Choose your lane">
            {laneCards.map((card) => (
              <article key={card.product} className={`lane-card ${card.cardClass}`}>
                <p className="home-lane-kicker">{card.product}</p>
                <h3 className="lane-title">{card.title}</h3>
                <p>{card.description}</p>
                <div className="home-lane-proof">
                  <p className="home-lane-proof-title">{card.proofTitle}</p>
                  <p className="home-lane-proof-copy">{card.proofDescription}</p>
                </div>
                <Link className={`button lane-card-action ${card.buttonClass}`} href={card.href}>
                  {card.action}
                </Link>
              </article>
            ))}
          </section>

          <section className="home-category-note" aria-label="What Knokio is">
            <p className="home-category-note-copy">
              Not a social network. Not a public directory. A private interface for controlled access.
            </p>
          </section>
        </div>
      </section>
    </main>
  );
}
