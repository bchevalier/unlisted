import React from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { getKeeperSessionFromCookies } from '../../lib/keeper-auth';
import { DirectIcon } from './direct-icons';
import { LogoutButton } from './logout-button';

const TRUST_SIGNALS = [
  'No credit card required',
  'Set up in under 2 minutes',
  'Free tier is permanent',
  'Your data stays yours',
] as const;

const BENEFITS = [
  { icon: 'lock', title: 'Private until you approve', copy: 'Your email, DMs, and private channels stay hidden. Nothing reaches you until you say so.' },
  { icon: 'clipboard', title: 'Every request arrives with context', copy: 'Budget, brief, category, and timeline — collected before a request ever reaches you.' },
  { icon: 'shield', title: 'Noise never reaches you', copy: 'Volume limits, smart routing, and automation stop spam, cold pitches, and vague asks before they become your problem.' },
] as const;

const HOW_IT_WORKS = [
  { step: '01', title: 'Share one page, not your email', copy: 'Replace scattered contact details with a single public Direct page — your access layer between the outside world and your private channels.' },
  { step: '02', title: 'Collect the right details upfront', copy: 'Budget, scope, timeline — every request arrives structured before you spend a second reviewing.' },
  { step: '03', title: 'Only qualified requests get through', copy: 'Direct filters noise automatically. Spam, cold pitches, and vague asks are stopped before they reach your inbox.' },
] as const;

const NOT_A_FORM = [
  { icon: 'zap', title: 'Contact form', issue: 'Drops messages into your inbox with no filtering, no structure, no control.' },
  { icon: 'shield', title: 'Knokio Direct', issue: 'An access layer that protects your inbox — filters noise, structures requests, enforces limits, and keeps your private email hidden.' },
] as const;

const WHO_FOR_PRIMARY = [
  { icon: 'film', color: '#e11a8c', title: 'Creators and influencers', copy: 'Brand deals, collabs, and sponsorship requests — structured with budget and brief before they reach you.' },
  { icon: 'briefcase', color: '#2563eb', title: 'Advisors and consultants', copy: 'Collect scope, budget, and timeline before advisory or consulting requests earn your attention.' },
  { icon: 'store', color: '#0d9488', title: 'Online services and small businesses', copy: 'Separate sales from operations, route customer requests from support, and auto-reply when info is missing.' },
  { icon: 'pen', color: '#7c3aed', title: 'Freelancers and agencies', copy: 'Require project scope and budget upfront so only real inquiries become conversations.' },
  { icon: 'building', color: '#d97706', title: 'Public figures', copy: 'Route fan mail, media requests, threats, and donations into separate categories before anyone reviews them.' },
  { icon: 'inbox', color: '#475569', title: 'Anyone handling constant inbound', copy: 'Stay reachable without letting spam, cold pitches, and low-signal outreach take over your day.' },
] as const;

const WHO_FOR_MORE = [
  { icon: 'users', color: '#0284c7', title: 'Recruiters and hiring managers', copy: 'Require role, resume, and availability before candidate or vendor pitches land in your inbox.' },
  { icon: 'home', color: '#16a34a', title: 'Real estate agents', copy: 'Collect property type, budget, and timeline before buyer or seller inquiries reach you.' },
  { icon: 'heart', color: '#dc2626', title: 'Nonprofits and communities', copy: 'Route volunteer inquiries, donations, partnerships, and media requests without manual triage.' },
  { icon: 'mic', color: '#9333ea', title: 'Event organizers', copy: 'Speaker submissions, sponsor inquiries, attendee questions, and media passes — each with their own intake form.' },
  { icon: 'activity', color: '#0891b2', title: 'Healthcare and legal practices', copy: 'New patient or client intake, referrals, and existing client requests — structured before anyone reviews.' },
  { icon: 'music', color: '#c026d3', title: 'Artists and musicians', copy: 'Licensing requests, booking inquiries, fan messages, and press — separated before they reach you.' },
  { icon: 'code', color: '#64748b', title: 'Open source maintainers', copy: 'Separate sponsorship inquiries, consulting requests, and hiring outreach from community noise.' },
] as const;

const FAQ = [
  { q: 'Will people still be able to reach me easily?', a: 'Yes. Direct keeps you reachable — it just turns random inbound into structured requests with the context you need.' },
  { q: 'Do I have to reply to every request?', a: 'No. You can accept, decline, or let requests expire on their own. Silence is a valid response.' },
  { q: 'What happens to requests I don\u2019t accept?', a: 'They stay in your inbox with a "pending" status until you act on them or they expire automatically. Senders see a neutral status page — no ghosting guilt.' },
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
            <h1 className="hero-title direct-hero-title">One page. Structured requests.<br />Private until you approve.</h1>
            <p className="hero-subtitle direct-hero-subtitle">
              Direct is the access layer between you and the outside world — it replaces public contact details with a single page that filters, structures, and controls every inbound request.
            </p>
            <p className="direct-hero-concrete-line">
              Brand deals arrive with budget and brief attached. Advisory asks include scope and timeline. Spam, cold pitches, and vague messages never make it through.
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
              <div className="direct-proof-head">
                <DirectIcon name={b.icon} size={18} className="direct-proof-icon" />
                <p className="direct-proof-title">{b.title}</p>
              </div>
              <p className="direct-proof-copy">{b.copy}</p>
            </article>
          ))}
        </section>

        {/* 2a. Trust signals strip */}
        <div className="direct-trust-strip" aria-label="Trust signals">
          {TRUST_SIGNALS.map((signal) => (
            <span key={signal} className="direct-trust-pill">{signal}</span>
          ))}
        </div>

        {/* 3. How it works — 3-step strip (moved up for early comprehension) */}
        <section className="lane-panel direct-steps-panel direct-section-dark" aria-label="How Direct works">
          <div className="direct-steps-intro">
            <p className="lane-kicker">How Direct works</p>
            <h2>Three steps to a protected inbox</h2>
          </div>
          <div className="direct-steps-grid">
            {HOW_IT_WORKS.map((s) => (
              <article key={s.step} className="direct-step-card direct-step-card-inline">
                <div className="direct-step-head">
                  <span className="direct-step-number">{s.step}</span>
                  <h3>{s.title}</h3>
                </div>
                <p>{s.copy}</p>
              </article>
            ))}
          </div>
        </section>

        {/* 3b. Social proof — early-stage metrics */}
        <div className="direct-social-proof-strip" aria-label="Social proof">
          <div className="direct-social-proof-stat">
            <strong>2,400+</strong>
            <span>requests processed</span>
          </div>
          <span className="direct-social-proof-divider" aria-hidden="true" />
          <div className="direct-social-proof-stat">
            <strong>380+</strong>
            <span>doors created</span>
          </div>
          <span className="direct-social-proof-divider" aria-hidden="true" />
          <span className="direct-social-proof-note">Early access — growing daily</span>
        </div>

        {/* 4. Not just a contact form — objection handling */}
        <section className="lane-panel direct-notform-panel" aria-label="Not just a contact form">
          <div className="direct-panel-intro">
            <p className="lane-kicker">Not a contact form</p>
            <h2>A contact form drops messages in your inbox. Direct protects it.</h2>
          </div>
          <div className="direct-notform-grid">
            {NOT_A_FORM.map((item) => (
              <article key={item.title} className={`direct-notform-card ${item.icon === 'shield' ? 'direct-notform-card-direct' : 'direct-notform-card-form'}`}>
                <div className="direct-notform-head">
                  <DirectIcon name={item.icon} size={18} className="direct-notform-icon" />
                  <h3>{item.title}</h3>
                </div>
                <p>{item.issue}</p>
              </article>
            ))}
          </div>
        </section>

        {/* 4b. Mid-page CTA */}
        <section className="direct-inline-cta" aria-label="Get started">
          <p>Most people either expose themselves and get overwhelmed — or hide and miss good opportunities.</p>
          <p className="direct-inline-cta-kicker">Direct is the access layer in between. Private until approved.</p>
          <div className="direct-inline-cta-actions">
            {session ? (
              <Link className="button primary direct-hero-button" href="/direct/settings?slug=john&fixture=demo">Protect my inbox — free</Link>
            ) : (
              <Link className="button primary direct-hero-button" href="/direct/signup">Protect my inbox — free</Link>
            )}
            <Link className="button secondary" href="/direct/inbox?slug=john&fixture=demo">See a live example</Link>
          </div>
        </section>

        {/* 5. Who it is for */}
        <section className="lane-panel direct-audience-panel direct-section-tinted" aria-label="Who Direct is for">
          <div className="direct-panel-intro">
            <p className="lane-kicker">Who Direct is for</p>
            <h2>Built for anyone who&apos;s publicly reachable</h2>
          </div>
          <div className="direct-audience-grid">
            {WHO_FOR_PRIMARY.map((w) => (
              <article key={w.title} className="direct-audience-card direct-audience-card-inline">
                <div className="direct-audience-head">
                  <span className="direct-audience-icon" style={{ color: w.color }}>
                    <DirectIcon name={w.icon} size={18} />
                  </span>
                  <h3>{w.title}</h3>
                </div>
                <p>{w.copy}</p>
              </article>
            ))}
          </div>
          <details className="direct-audience-more">
            <summary className="direct-audience-more-toggle">See more use cases</summary>
            <div className="direct-audience-grid direct-audience-more-grid">
              {WHO_FOR_MORE.map((w) => (
                <article key={w.title} className="direct-audience-card direct-audience-card-inline">
                  <div className="direct-audience-head">
                    <span className="direct-audience-icon" style={{ color: w.color }}>
                      <DirectIcon name={w.icon} size={18} />
                    </span>
                    <h3>{w.title}</h3>
                  </div>
                  <p>{w.copy}</p>
                </article>
              ))}
            </div>
          </details>
        </section>

        {/* 6. Example use cases */}
        <section className="lane-panel direct-proof-panel" aria-label="Example use cases">
          <div className="direct-panel-intro">
            <p className="lane-kicker">Example scenarios</p>
            <h2>How people use Direct to take back their inbox</h2>
          </div>
          <div className="direct-proof-examples">
            <article className="direct-proof-example">
              <DirectIcon name="film" size={22} className="direct-proof-example-icon" />
              <div>
                <p className="direct-proof-example-headline">Creator with 80K followers</p>
                <p className="direct-proof-example-detail">Replaced a public email with a Direct page. Brand deals now arrive with budget and brief attached. Spam and cold pitches never make it through.</p>
              </div>
            </article>
            <article className="direct-proof-example">
              <DirectIcon name="briefcase" size={22} className="direct-proof-example-icon" />
              <div>
                <p className="direct-proof-example-headline">Independent advisor</p>
                <p className="direct-proof-example-detail">Requires scope, budget range, and timeline on every inbound request. Only qualified asks make it to the inbox — everything else is filtered automatically.</p>
              </div>
            </article>
            <article className="direct-proof-example">
              <DirectIcon name="store" size={22} className="direct-proof-example-icon" />
              <div>
                <p className="direct-proof-example-headline">Startup founder</p>
                <p className="direct-proof-example-detail">Uses one Direct page for investor intros, partnership requests, and hiring leads. Each category collects different fields — no more sorting through a shared inbox.</p>
              </div>
            </article>
          </div>
        </section>

        {/* 6b. Demo entry point */}
        <section className="lane-panel direct-demo-entry direct-section-tinted" aria-label="See Direct in action">
          <div className="direct-panel-intro">
            <p className="lane-kicker">See Direct in action</p>
            <h2>Explore the product before you sign up</h2>
            <p>Walk through a working inbox with real request examples — accepted, filtered, and auto-replied.</p>
          </div>
          <div className="direct-demo-cards">
            <Link className="direct-demo-card direct-demo-card-inline" href="/direct/inbox?slug=john&fixture=demo">
              <div className="direct-demo-card-head">
                <DirectIcon name="inbox" size={18} className="direct-demo-card-icon" />
                <span className="direct-demo-card-title">Demo inbox</span>
              </div>
              <span className="direct-demo-card-desc">See requests arrive, get filtered, and get resolved</span>
            </Link>
            <Link className="direct-demo-card direct-demo-card-inline" href="/u/john">
              <div className="direct-demo-card-head">
                <DirectIcon name="link" size={18} className="direct-demo-card-icon" />
                <span className="direct-demo-card-title">Public Direct page</span>
              </div>
              <span className="direct-demo-card-desc">What visitors see when they knock on your Direct page</span>
            </Link>
            <Link className="direct-demo-card direct-demo-card-inline" href="/direct/settings?slug=john&fixture=demo">
              <div className="direct-demo-card-head">
                <DirectIcon name="edit" size={18} className="direct-demo-card-icon" />
                <span className="direct-demo-card-title">Filtering rules</span>
              </div>
              <span className="direct-demo-card-desc">How you control what reaches you and what doesn&apos;t</span>
            </Link>
          </div>
        </section>

        {/* 6c. Post-demo CTA */}
        <section className="direct-post-scenarios-cta" aria-label="Get started after scenarios">
          <p className="direct-post-scenarios-lead">You don&apos;t need another inbox tool — you need an access layer.</p>
          <div className="direct-inline-cta-actions">
            {session ? (
              <Link className="button primary direct-hero-button" href="/direct/settings?slug=john&fixture=demo">Protect my inbox — free</Link>
            ) : (
              <Link className="button primary direct-hero-button" href="/direct/signup">Protect my inbox — free</Link>
            )}
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
                <li>Smart filtering and volume controls</li>
                <li>Private until you approve</li>
              </ul>
              {session ? (
                <Link className="button primary direct-pricing-cta" href="/direct/settings?slug=john&fixture=demo">Protect my inbox — free</Link>
              ) : (
                <Link className="button primary direct-pricing-cta" href="/direct/signup">Protect my inbox — free</Link>
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
          <p className="lane-kicker">Your access layer</p>
          <h2>Your inbox is yours. Keep it that way.</h2>
          <p>One door. Structured requests. Private until approved. No spam, no exposure, no obligation to reply.</p>
          <div className="direct-faq-actions">
            {session ? (
              <Link className="button primary direct-hero-button" href="/direct/settings?slug=john&fixture=demo">Protect my inbox — free</Link>
            ) : (
              <Link className="button primary direct-hero-button" href="/direct/signup">Protect my inbox — free</Link>
            )}
            <Link className="button secondary" href="/direct/inbox?slug=john&fixture=demo">See a live example</Link>
          </div>
        </section>
      </div>
    </main>
  );
}
