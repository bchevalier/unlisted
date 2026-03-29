import React from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { getKeeperSessionFromCookies } from '../../lib/keeper-auth';
import { LogoutButton } from './logout-button';

const BENEFITS = [
  { icon: '🔒', title: 'Your inbox stays private by default', copy: 'Share one public Direct page while your personal email stays hidden.' },
  { icon: '📋', title: 'Every request arrives with context', copy: 'Collect budget, brief, category, and timeline before a request ever reaches you.' },
  { icon: '🚫', title: 'Noise never reaches you', copy: 'Caps, automation, and routing stop spam, cold pitches, and vague asks from becoming your to-do list.' },
] as const;

const WHO_FOR = [
  { icon: '🎬', title: 'Creators', copy: 'Handle brand deals and collabs without exposing your private inbox.' },
  { icon: '💼', title: 'Advisors and consultants', copy: 'Collect scope and budget before requests earn your attention.' },
  { icon: '📥', title: 'Anyone with too much inbound', copy: 'Stay reachable without letting spam and cold pitches take over your day.' },
] as const;

const HOW_IT_WORKS = [
  { step: '01', title: 'Share one public Direct page', copy: 'Replace scattered contact points with one structured intake page.' },
  { step: '02', title: 'Ask for the right details upfront', copy: 'Require the information you need before you spend time reading.' },
  { step: '03', title: 'Let Direct filter what reaches you', copy: 'Qualified requests go through. Low-signal inbound is capped, routed, or ignored.' },
] as const;

const FAQ = [
  { q: 'Will people still be able to reach me easily?', a: 'Yes. Direct keeps you reachable, but turns random inbound into structured requests.' },
  { q: 'Do I have to reply to every request?', a: 'No. Direct helps you filter, cap, route, and ignore requests that are not worth your time.' },
  { q: 'Is this just another contact form?', a: 'No. Direct is an inbound control layer. It protects your inbox, structures requests, and keeps your private contact details hidden.' },
] as const;

export default async function DirectClientPage() {
  const session = await getKeeperSessionFromCookies();

  return (
    <main className="lane-page lane-page-direct direct-page">
      <header className="home-topbar direct-topbar">
        <Link href="/" className="home-topbar-brand direct-topbar-brand">
          <Image className="home-topbar-logo" src="/knokio-logo-small.jpg" alt="" aria-hidden="true" width={22} height={22} priority />
          <span className="home-topbar-title">Knokio</span>
          <span className="direct-topbar-separator" aria-hidden="true">/</span>
          <span className="direct-topbar-context">Direct</span>
        </Link>
        <nav className="home-topbar-actions" aria-label="Direct actions">
          {session ? (
            <>
              <span className="direct-topbar-session">{session.email}</span>
              <div className="direct-topbar-logout"><LogoutButton /></div>
            </>
          ) : (
            <>
              <Link className="topbar-link" href="/direct/login">Log in</Link>
              <Link className="topbar-button" href="/direct/signup">Create account</Link>
            </>
          )}
        </nav>
      </header>

      <div className="direct-main-shell">
        {/* 1. Hero */}
        <section className="lane-hero-panel direct-hero-panel" aria-label="Knokio Direct overview">
          <div className="direct-hero-bg" aria-hidden="true">
            <div className="home-hero-grid direct-hero-grid" />
          </div>
          <div className="direct-hero-content">
            <p className="hero-word">KNOKIO DIRECT</p>
            <h1 className="hero-title direct-hero-title">Stay reachable without losing control of your inbox.</h1>
            <p className="hero-subtitle direct-hero-subtitle">
              Knokio Direct turns public contact into structured requests. Brand deals, advisory asks, and business
              inquiries arrive with context — spam, cold pitches, and vague asks don&apos;t.
            </p>
            <p className="direct-hero-concrete-line">
              Your email stays private. Every request is filtered, structured, and routed before it reaches you.
            </p>
            <div className="lane-action-row direct-hero-actions">
              {session ? (
                <Link className="button primary direct-hero-button" href="/direct/settings?slug=john&fixture=demo">Protect my inbox — free</Link>
              ) : (
                <Link className="button primary direct-hero-button" href="/direct/signup">Protect my inbox — free</Link>
              )}
              <Link className="button secondary direct-hero-button" href="/direct/inbox?slug=john&fixture=demo">View demo inbox</Link>
            </div>
            <p className="hero-meta direct-hero-meta">No credit card required · Set up in under 2 minutes</p>
          </div>
        </section>

        {/* 2. Three benefit cards */}
        <section className="direct-proof-strip" aria-label="Direct key benefits">
          {BENEFITS.map((b) => (
            <article key={b.title} className="direct-proof-card">
              <span className="direct-proof-icon" aria-hidden="true">{b.icon}</span>
              <p className="direct-proof-title">{b.title}</p>
              <p className="direct-proof-copy">{b.copy}</p>
            </article>
          ))}
        </section>

        {/* 3. Who it is for */}
        <section className="lane-panel direct-audience-panel" aria-label="Who Direct is for">
          <div className="direct-panel-intro">
            <p className="lane-kicker">Who Direct is for</p>
          </div>
          <div className="direct-audience-grid">
            {WHO_FOR.map((w) => (
              <article key={w.title} className="direct-audience-card">
                <span className="direct-audience-icon" aria-hidden="true">{w.icon}</span>
                <h3>{w.title}</h3>
                <p>{w.copy}</p>
              </article>
            ))}
          </div>
        </section>

        {/* 4. How it works — 3-step strip */}
        <section className="lane-panel direct-steps-panel" aria-label="How Direct works">
          <div className="direct-steps-intro">
            <p className="lane-kicker">How Direct works</p>
          </div>
          <div className="direct-steps-grid">
            {HOW_IT_WORKS.map((s) => (
              <article key={s.step} className="direct-step-card">
                <span className="direct-step-number">{s.step}</span>
                <h3>{s.title}</h3>
                <p>{s.copy}</p>
              </article>
            ))}
          </div>
        </section>

        {/* 4b. Mid-page CTA */}
        <section className="direct-inline-cta" aria-label="Get started">
          <p>Ready to take back control of your inbound?</p>
          <div className="direct-inline-cta-actions">
            {session ? (
              <Link className="button primary" href="/direct/settings?slug=john&fixture=demo">Protect my inbox — free</Link>
            ) : (
              <Link className="button primary" href="/direct/signup">Protect my inbox — free</Link>
            )}
            <Link className="button secondary" href="/direct/inbox?slug=john&fixture=demo">View demo inbox</Link>
          </div>
        </section>

        {/* 5. Demo entry point */}
        <section className="lane-panel direct-demo-entry" aria-label="See Direct in action">
          <div className="direct-panel-intro">
            <p className="lane-kicker">See Direct in action</p>
            <p>Explore a live demo inbox with accepted, auto-replied, and filtered request examples.</p>
          </div>
          <div className="direct-demo-entry-actions">
            <Link className="button secondary" href="/direct/inbox?slug=john&fixture=demo">Open demo inbox</Link>
            <Link className="button secondary" href="/u/john">View public Direct page</Link>
            <Link className="button secondary" href="/direct/settings?slug=john&fixture=demo">Inspect rules &amp; settings</Link>
          </div>
        </section>

        {/* 6. Social proof */}
        <section className="lane-panel direct-proof-panel" aria-label="How it helps">
          <div className="direct-panel-intro">
            <p className="lane-kicker">What changes</p>
          </div>
          <div className="direct-proof-examples">
            <article className="direct-proof-example">
              <span className="direct-proof-example-icon" aria-hidden="true">🎙️</span>
              <div>
                <p className="direct-proof-example-headline">A creator with 80K followers</p>
                <p className="direct-proof-example-detail">Replaced a public email with a Direct page. Brand deals now arrive with budget and brief attached — spam doesn&apos;t arrive at all.</p>
              </div>
            </article>
            <article className="direct-proof-example">
              <span className="direct-proof-example-icon" aria-hidden="true">📊</span>
              <div>
                <p className="direct-proof-example-headline">An independent advisor</p>
                <p className="direct-proof-example-detail">Requires scope, budget range, and timeline on every inbound request. Unqualified asks are filtered out before they reach the inbox.</p>
              </div>
            </article>
          </div>
        </section>

        {/* 7. Pricing summary */}
        <section className="lane-panel direct-pricing-panel" aria-label="Direct pricing overview">
          <div className="direct-panel-intro">
            <p className="lane-kicker">Plans</p>
          </div>
          <div className="direct-pricing-grid">
            <article className="direct-pricing-card direct-pricing-card-free">
              <h3>Free</h3>
              <p className="direct-pricing-price">$0</p>
              <ul className="direct-pricing-list">
                <li>Public Direct page</li>
                <li>Structured request forms</li>
                <li>Basic caps and filtering</li>
                <li>Email stays private</li>
              </ul>
            </article>
            <article className="direct-pricing-card direct-pricing-card-paid">
              <h3>Paid</h3>
              <p className="direct-pricing-price">Coming soon</p>
              <ul className="direct-pricing-list">
                <li>Everything in Free</li>
                <li>Uncapped request volume</li>
                <li>Advanced routing rules</li>
                <li>Paid request flows</li>
                <li>Priority support</li>
              </ul>
            </article>
          </div>
        </section>

        {/* 8. FAQ — accordion */}
        <section className="lane-panel direct-faq-panel" aria-label="FAQ">
          <div className="direct-faq-intro">
            <p className="lane-kicker">FAQ</p>
          </div>
          <div className="direct-faq-accordion">
            {FAQ.map((f) => (
              <details key={f.q} className="direct-faq-item">
                <summary className="direct-faq-question">{f.q}</summary>
                <p className="direct-faq-answer">{f.a}</p>
              </details>
            ))}
          </div>
        </section>

        {/* 9. Final CTA */}
        <section className="lane-panel direct-final-cta" aria-label="Final call to action">
          <h2>Your inbox is yours. Keep it that way.</h2>
          <p>Share one public Direct page. Keep your personal email private. Let only structured, qualified requests through.</p>
          <div className="direct-faq-actions">
            {session ? (
              <Link className="button primary" href="/direct/settings?slug=john&fixture=demo">Protect my inbox — free</Link>
            ) : (
              <Link className="button primary" href="/direct/signup">Protect my inbox — free</Link>
            )}
            <Link className="button secondary" href="/direct/inbox?slug=john&fixture=demo">View demo inbox</Link>
          </div>
        </section>
      </div>
    </main>
  );
}
