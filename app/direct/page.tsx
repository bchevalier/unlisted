import React from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { getKeeperSessionFromCookies } from '../../lib/keeper-auth';
import { LogoutButton } from './logout-button';

const BENEFITS = [
  { icon: '🔒', title: 'Your inbox stays private', copy: 'Share one public Direct page while your personal email stays hidden.' },
  { icon: '📋', title: 'Every request arrives with context', copy: 'Collect budget, brief, category, and timeline before a request ever reaches you.' },
  { icon: '🚫', title: 'Noise never reaches you', copy: 'Volume limits, automation, and smart routing stop spam, cold pitches, and vague asks before they become your problem.' },
] as const;

const WHO_FOR = [
  { icon: '🎬', title: 'Creators', copy: 'Handle brand deals and collabs without exposing your private inbox.' },
  { icon: '💼', title: 'Advisors and consultants', copy: 'Collect scope and budget before requests earn your attention.' },
  { icon: '📥', title: 'Anyone with too much inbound', copy: 'Stay reachable without letting spam and cold pitches take over your day.' },
] as const;

const HOW_IT_WORKS = [
  { step: '01', title: 'Share one public Direct page', copy: 'Replace scattered contact details with one structured intake page.' },
  { step: '02', title: 'Ask for the right details upfront', copy: 'Get budget, scope, and timelines before you spend a second reviewing.' },
  { step: '03', title: 'Let Direct filter what reaches you', copy: 'Qualified requests go through. Vague, irrelevant, or spammy inbound is filtered, routed, or ignored.' },
] as const;

const FAQ = [
  { q: 'Will people still be able to reach me easily?', a: 'Yes. Direct keeps you reachable — it just turns random inbound into structured requests with the context you need.' },
  { q: 'Do I have to reply to every request?', a: 'No. You can accept, decline, or let requests expire on their own. Silence is a valid response.' },
  { q: 'Is this just another contact form?', a: 'No. A contact form drops messages into your inbox with no filtering. Direct is an inbound control layer — it protects your inbox, structures requests, enforces volume limits, and keeps your private email hidden.' },
  { q: 'What happens to requests I don\u2019t accept?', a: 'They stay in your inbox with a "pending" status until you act on them or they expire automatically. Senders see a neutral status page — no ghosting guilt.' },
  { q: 'Can I customize what information is required?', a: 'Yes. You control which fields are required for each request category — budget, timeline, brief, links, or anything relevant to your workflow.' },
  { q: 'Will my free plan features go away if paid plans launch?', a: 'No. The free tier is permanent. Paid plans add advanced features like uncapped volume and custom routing — they never remove what you already have.' },
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
              <Link className="button secondary direct-hero-button" href="/direct/inbox?slug=john&fixture=demo">See a live example</Link>
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
        <section className="lane-panel direct-audience-panel direct-section-tinted" aria-label="Who Direct is for">
          <div className="direct-panel-intro">
            <p className="lane-kicker">Who Direct is for</p>
            <h2>Built for anyone who&apos;s publicly reachable</h2>
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
            <h2>Three steps to a protected inbox</h2>
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
          <p>Most people either expose themselves and get overwhelmed — or hide and miss good opportunities. Direct sits in between.</p>
          <div className="direct-inline-cta-actions">
            {session ? (
              <Link className="button primary" href="/direct/settings?slug=john&fixture=demo">Set up in under 2 minutes</Link>
            ) : (
              <Link className="button primary" href="/direct/signup">Set up in under 2 minutes</Link>
            )}
            <Link className="button secondary" href="/direct/inbox?slug=john&fixture=demo">See a live example</Link>
          </div>
        </section>

        {/* 5. Demo entry point */}
        <section className="lane-panel direct-demo-entry direct-section-tinted" aria-label="See Direct in action">
          <div className="direct-panel-intro">
            <p className="lane-kicker">See Direct in action</p>
            <h2>Explore the product before you sign up</h2>
            <p>Walk through a working inbox with real request examples — accepted, filtered, and auto-replied.</p>
          </div>
          <div className="direct-demo-cards">
            <Link className="direct-demo-card" href="/direct/inbox?slug=john&fixture=demo">
              <span className="direct-demo-card-icon" aria-hidden="true">📥</span>
              <span className="direct-demo-card-title">Demo inbox</span>
              <span className="direct-demo-card-desc">See requests arrive, get filtered, and get resolved</span>
            </Link>
            <Link className="direct-demo-card" href="/u/john">
              <span className="direct-demo-card-icon" aria-hidden="true">🚪</span>
              <span className="direct-demo-card-title">Public Direct page</span>
              <span className="direct-demo-card-desc">What visitors see when they knock on your door</span>
            </Link>
            <Link className="direct-demo-card" href="/direct/settings?slug=john&fixture=demo">
              <span className="direct-demo-card-icon" aria-hidden="true">⚙️</span>
              <span className="direct-demo-card-title">Filtering rules</span>
              <span className="direct-demo-card-desc">How you control what reaches you and what doesn&apos;t</span>
            </Link>
          </div>
        </section>

        {/* 6. Example use cases */}
        <section className="lane-panel direct-proof-panel" aria-label="Example use cases">
          <div className="direct-panel-intro">
            <p className="lane-kicker">Example scenarios</p>
            <h2>How people use Direct to take back their inbox</h2>
          </div>
          <div className="direct-proof-examples">
            <article className="direct-proof-example">
              <span className="direct-proof-example-icon" aria-hidden="true">🎙️</span>
              <div>
                <p className="direct-proof-example-headline">Creator with 80K followers</p>
                <p className="direct-proof-example-detail">Replaced a public email with a Direct page. Brand deals now arrive with budget and brief attached. Spam and cold pitches never make it through.</p>
              </div>
            </article>
            <article className="direct-proof-example">
              <span className="direct-proof-example-icon" aria-hidden="true">📊</span>
              <div>
                <p className="direct-proof-example-headline">Independent advisor</p>
                <p className="direct-proof-example-detail">Requires scope, budget range, and timeline on every inbound request. Only qualified asks make it to the inbox — everything else is filtered automatically.</p>
              </div>
            </article>
            <article className="direct-proof-example">
              <span className="direct-proof-example-icon" aria-hidden="true">🏢</span>
              <div>
                <p className="direct-proof-example-headline">Startup founder</p>
                <p className="direct-proof-example-detail">Uses one Direct page for investor intros, partnership requests, and hiring leads. Each category collects different fields — no more sorting through a shared inbox.</p>
              </div>
            </article>
          </div>
        </section>

        {/* 7. Pricing summary */}
        <section className="lane-panel direct-pricing-panel direct-section-tinted" aria-label="Direct pricing overview">
          <div className="direct-panel-intro">
            <p className="lane-kicker">Plans</p>
            <h2>Start free. Upgrade when you need to.</h2>
          </div>
          <div className="direct-pricing-grid">
            <article className="direct-pricing-card direct-pricing-card-free direct-pricing-card-highlighted">
              <h3>Free</h3>
              <p className="direct-pricing-price">$0<span className="direct-pricing-period"> / forever</span></p>
              <ul className="direct-pricing-list">
                <li>Public Direct page</li>
                <li>Structured request forms</li>
                <li>Volume limits and filtering</li>
                <li>Your email stays private</li>
              </ul>
              {session ? (
                <Link className="button primary direct-pricing-cta" href="/direct/settings?slug=john&fixture=demo">Get started free</Link>
              ) : (
                <Link className="button primary direct-pricing-cta" href="/direct/signup">Get started free</Link>
              )}
            </article>
            <article className="direct-pricing-card direct-pricing-card-paid">
              <h3>Pro</h3>
              <p className="direct-pricing-price">Coming soon</p>
              <ul className="direct-pricing-list">
                <li>Everything in Free</li>
                <li>Uncapped request volume</li>
                <li>Custom routing rules</li>
                <li>Paid inbound requests</li>
                <li>Priority support</li>
              </ul>
              <Link className="button secondary direct-pricing-cta direct-pricing-waitlist-btn" href="/direct/signup">Join the waitlist</Link>
              <p className="direct-pricing-waitlist">Free tier is permanent — Pro adds power, never removes features.</p>
            </article>
          </div>
        </section>

        {/* 8. FAQ — accordion */}
        <section className="lane-panel direct-faq-panel" aria-label="FAQ">
          <div className="direct-faq-intro">
            <p className="lane-kicker">FAQ</p>
            <h2>Common questions</h2>
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
        <section className="lane-panel direct-final-cta direct-section-dark" aria-label="Final call to action">
          <h2>Your inbox is yours. Keep it that way.</h2>
          <p>One page. Structured requests. No spam, no exposure, no obligation to reply. Set up takes under 2&nbsp;minutes.</p>
          <div className="direct-faq-actions">
            {session ? (
              <Link className="button primary" href="/direct/settings?slug=john&fixture=demo">Get started free</Link>
            ) : (
              <Link className="button primary" href="/direct/signup">Get started free</Link>
            )}
            <Link className="button secondary" href="/direct/inbox?slug=john&fixture=demo">See a live example</Link>
          </div>
        </section>
      </div>
    </main>
  );
}
