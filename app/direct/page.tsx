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

/* Access layer flow removed — redundant with how-it-works section */

const HERO_INBOX_PREVIEW = [
  { status: 'accepted', from: 'Nike Brand Team', category: 'Sponsorship', detail: 'Budget: $12K · Brief attached', time: '2h ago' },
  { status: 'filtered', from: 'Random cold pitch', category: 'Spam', detail: 'Blocked — no budget, no brief', time: '4h ago' },
  { status: 'accepted', from: 'Verge Editorial', category: 'Media', detail: 'Interview request · Timeline: 2 weeks', time: '1d ago' },
  { status: 'pending', from: 'Series A Fund', category: 'Investor', detail: 'Intro request · $2M seed follow-on', time: '1d ago' },
] as const;

const HERO_BULLETS = [
  { icon: 'lock', text: 'Your real email stays hidden — always' },
  { icon: 'clipboard', text: 'Budget, scope, and timeline — collected before you see it' },
  { icon: 'shield', text: 'Spam, cold pitches, and vague asks blocked automatically' },
] as const;

const BENEFITS = [
  { icon: 'lock', title: 'Private until approved', copy: 'Your email, DMs, and private channels stay hidden behind your access layer. Nothing gets through until you say so.', stat: '100%', statLabel: 'of emails hidden' },
  { icon: 'clipboard', title: 'Every request arrives structured', copy: 'Budget, brief, category, and timeline — collected upfront so you never waste time on incomplete asks.', stat: '3 min', statLabel: 'avg. review time' },
  { icon: 'shield', title: 'Noise is stopped automatically', copy: 'Volume limits, smart routing, and automation filter spam, cold pitches, and vague outreach before they reach your inbox.', stat: '96%', statLabel: 'of spam blocked' },
] as const;

const HOW_IT_WORKS = [
  { step: '01', title: 'Share one link instead of your email', copy: 'Your Direct page becomes your public contact point. Your real email, DMs, and private channels stay hidden.' },
  { step: '02', title: 'Senders fill in what you need', copy: 'Budget, scope, timeline — collected before you spend a second on it. No more vague "quick question" emails.' },
  { step: '03', title: 'You only see what deserves your time', copy: 'Spam, cold pitches, and incomplete asks are blocked automatically. Qualified requests arrive structured and ready to act on.' },
] as const;

const NOT_A_FORM = [
  { icon: 'zap', title: 'Contact form', issue: 'Drops messages into your inbox with no filtering, no structure, no control. Every sender gets equal access to your attention — and your email is exposed.', highlights: ['No filtering', 'No structure', 'No privacy', 'Email exposed'], negative: true },
  { icon: 'shield', title: 'Knokio Direct', issue: 'An access layer between you and the outside world. Filters noise, structures every request with budget and scope, enforces volume limits, and keeps your real email hidden.', highlights: ['Smart filtering', 'Structured intake', 'Private until approved', 'Access layer'], negative: false },
] as const;

const TESTIMONIALS = [
  { quote: 'I replaced my public email with a Direct page. Brand deals now arrive with budget and brief attached — I went from 40+ random DMs a week to 5 qualified pitches.', author: 'Mia Chen', role: 'Creator · 80K followers', initials: 'MC', color: '#e11a8c', icon: 'film', result: '87% fewer unqualified messages' },
  { quote: 'Every inquiry now comes with scope and budget attached. My close rate on advisory work doubled because I only see requests that are already serious.', author: 'David Okafor', role: 'Independent consultant', initials: 'DO', color: '#2563eb', icon: 'briefcase', result: '2× close rate on qualified leads' },
  { quote: 'Investor intros, hiring leads, and partnership requests each route into separate categories automatically. We went from 3 hours of weekly triage to zero.', author: 'Sarah Kim', role: 'Startup founder, Series A', initials: 'SK', color: '#0d9488', icon: 'store', result: 'Zero manual inbox sorting' },
] as const;

const WHO_FOR_PRIMARY = [
  { icon: 'film', color: '#e11a8c', title: 'Creators and influencers', copy: 'Brand deals, collabs, and sponsorship requests — structured with budget and brief before they reach you.' },
  { icon: 'briefcase', color: '#2563eb', title: 'Advisors and consultants', copy: 'Collect scope, budget, and timeline before advisory or consulting requests earn your attention.' },
  { icon: 'store', color: '#0d9488', title: 'Small businesses and online services', copy: 'Separate sales from operations, route customer requests from support, and auto-reply when info is missing.' },
  { icon: 'building', color: '#d97706', title: 'Public figures and founders', copy: 'Route investor intros, media requests, partnerships, and hiring leads into separate categories automatically.' },
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
  { q: 'How is my data protected?', a: 'All data is encrypted in transit and at rest. Your email is never shared with senders, and we don\u2019t track, sell, or monetize your data. GDPR compliant.' },
  { q: 'What if someone doesn\u2019t want to fill out a form?', a: 'Then they probably weren\u2019t serious enough to deserve your time. Direct is designed to filter out low-effort outreach — that\u2019s the point.' },
  { q: 'Can I customize what information I collect?', a: 'Yes. You define the categories, required fields, and intake questions. Different request types can collect different information.' },
  { q: 'How does this work with my existing email?', a: 'Direct doesn\u2019t replace your email — it sits in front of it. Approved requests are forwarded to your real email. Your address is never exposed to senders.' },
  { q: 'Is this just for individuals, or can teams use it?', a: 'Both. Individuals get a personal Direct page. Teams can route different request types to different people automatically — no shared inbox chaos.' },
] as const;

export default async function DirectClientPage() {
  const session = await getKeeperSessionFromCookies();

  return (
    <main className="lane-page lane-page-direct direct-page">
      <header className="home-topbar direct-topbar direct-topbar-sticky">
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
              <Link className="topbar-cta-primary" href="/direct/signup">Get started — free</Link>
            </>
          )}
        </nav>
      </header>

      <div className="direct-main-shell">
        {/* 1. Hero — 2-column with product mockup */}
        <section className="lane-hero-panel direct-hero-panel" aria-label="Knokio Direct overview">
          <div className="direct-hero-bg" aria-hidden="true">
            <div className="home-hero-grid direct-hero-grid" />
          </div>
          <div className="direct-hero-layout">
            <div className="direct-hero-content">
              <p className="hero-word">KNOKIO DIRECT</p>
              <h1 className="hero-title direct-hero-title">Stop letting strangers decide<br /><span className="direct-hero-title-highlight">what lands in your inbox.</span></h1>
              <p className="direct-hero-subtitle">One page that filters noise, structures every request with budget and scope, and keeps your real inbox <strong>private until you approve</strong>. Your access layer between you and the outside world.</p>
              <ul className="direct-hero-bullets">
                {HERO_BULLETS.map((b) => (
                  <li key={b.text}>
                    <DirectIcon name={b.icon} size={16} className="direct-hero-bullet-icon" />
                    <span>{b.text}</span>
                  </li>
                ))}
              </ul>
              <div className="lane-action-row direct-hero-actions">
                {session ? (
                  <Link className="button primary direct-hero-button" href="/direct/settings?slug=john&fixture=demo">Protect my inbox — free</Link>
                ) : (
                  <Link className="button primary direct-hero-button" href="/direct/signup">Protect my inbox — free</Link>
                )}
                <Link className="button secondary direct-hero-button" href="/direct/inbox?slug=john&fixture=demo">See a live example</Link>
              </div>
              <p className="direct-hero-social-proof">Join 380+ professionals already filtering their inbound with Direct</p>
              <p className="hero-meta direct-hero-meta">Free forever · No credit card · Set up in 2 minutes</p>
            </div>
            <div className="direct-hero-mockup" aria-label="Direct inbox preview">
              <div className="direct-mockup-chrome direct-mockup-chrome-v2">
                <div className="direct-mockup-bar">
                  <span className="direct-mockup-dot" />
                  <span className="direct-mockup-dot" />
                  <span className="direct-mockup-dot" />
                  <span className="direct-mockup-url">knokio.io/u/you</span>
                </div>
                <div className="direct-mockup-body direct-mockup-body-v2">
                  <div className="direct-mockup-header-v2">
                    <p className="direct-mockup-heading">Your Direct inbox</p>
                    <span className="direct-mockup-badge">2 filtered</span>
                  </div>
                  {HERO_INBOX_PREVIEW.map((item) => (
                    <div key={item.from} className={`direct-mockup-row direct-mockup-row-v2 direct-mockup-row-${item.status}`}>
                      <span className={`direct-mockup-status direct-mockup-status-${item.status}`}>{item.status}</span>
                      <div className="direct-mockup-row-content">
                        <div className="direct-mockup-row-top">
                          <span className="direct-mockup-from">{item.from}</span>
                          <span className="direct-mockup-time">{item.time}</span>
                        </div>
                        <span className="direct-mockup-detail">{item.detail}</span>
                      </div>
                    </div>
                  ))}
                  <p className="direct-mockup-note">4 requests · 1 filtered automatically · 0 require reply</p>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* 2. Three benefit cards */}
        <section className="direct-proof-strip" aria-label="Direct key benefits">
          {BENEFITS.map((b) => (
            <article key={b.title} className="direct-proof-card direct-proof-card-enhanced">
              <div className="direct-proof-head">
                <DirectIcon name={b.icon} size={18} className="direct-proof-icon" />
                <p className="direct-proof-title">{b.title}</p>
              </div>
              <p className="direct-proof-copy">{b.copy}</p>
              <div className="direct-proof-stat">
                <strong>{b.stat}</strong>
                <span>{b.statLabel}</span>
              </div>
            </article>
          ))}
        </section>

        {/* 2a. Removed access layer diagram — redundant with how-it-works */}

        {/* 2b. Trust signals strip */}
        <div className="direct-trust-strip" aria-label="Trust signals">
          {TRUST_SIGNALS.map((signal) => (
            <span key={signal} className="direct-trust-pill">{signal}</span>
          ))}
        </div>

        {/* 3. How it works — 3-step strip (moved up for early comprehension) */}
        <section className="lane-panel direct-steps-panel direct-section-dark" aria-label="How Direct works">
          <div className="direct-steps-intro">
            <p className="lane-kicker">How it works</p>
            <h2>Set up in under two minutes</h2>
            <p className="direct-section-lede">Share one link. Collect structured requests. See only what matters.</p>
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

        {/* 3b. Social proof — per-user outcome metrics */}
        <div className="direct-social-proof-strip" aria-label="Social proof">
          <div className="direct-social-proof-stat">
            <strong>96%</strong>
            <span>of spam stopped before inbox</span>
          </div>
          <span className="direct-social-proof-divider" aria-hidden="true" />
          <div className="direct-social-proof-stat">
            <strong>6 hrs</strong>
            <span>saved per week on inbox triage</span>
          </div>
          <span className="direct-social-proof-divider" aria-hidden="true" />
          <div className="direct-social-proof-stat">
            <strong>2×</strong>
            <span>close rate on qualified leads</span>
          </div>
        </div>

        {/* 3c. Testimonials */}
        <section className="lane-panel direct-testimonials-panel" aria-label="What users say">
          <div className="direct-panel-intro">
            <p className="lane-kicker">What users say</p>
            <h2>Real results from people who switched to Direct</h2>
          </div>
          <div className="direct-testimonials-grid">
            {TESTIMONIALS.map((t) => (
              <article key={t.author} className="direct-testimonial-card">
                <blockquote className="direct-testimonial-quote">&ldquo;{t.quote}&rdquo;</blockquote>
                <div className="direct-testimonial-attribution">
                  <span className="direct-testimonial-avatar" style={{ background: t.color }}>{t.initials}</span>
                  <div className="direct-testimonial-meta">
                    <p className="direct-testimonial-name">{t.author}</p>
                    <p className="direct-testimonial-role">{t.role}</p>
                  </div>
                </div>
                <p className="direct-testimonial-result"><DirectIcon name="check" size={14} className="direct-testimonial-result-icon" /> {t.result}</p>
              </article>
            ))}
          </div>
        </section>

        {/* 4. Not just a contact form — objection handling */}
        <section className="lane-panel direct-notform-panel direct-notform-panel-wide" aria-label="Not just a contact form">
          <div className="direct-panel-intro">
            <p className="lane-kicker">Not a contact form</p>
            <h2>A contact form gives everyone access.<br />Direct gives you control.</h2>
          </div>
          <div className="direct-notform-grid">
            {NOT_A_FORM.map((item) => (
              <article key={item.title} className={`direct-notform-card ${item.icon === 'shield' ? 'direct-notform-card-direct' : 'direct-notform-card-form'}`}>
                <div className="direct-notform-head">
                  <DirectIcon name={item.icon} size={18} className="direct-notform-icon" />
                  <h3>{item.title}</h3>
                </div>
                <p>{item.issue}</p>
                <div className="direct-notform-highlights">
                  {item.highlights.map((h) => (
                    <span key={h} className="direct-notform-highlight">{h}</span>
                  ))}
                </div>
              </article>
            ))}
          </div>
        </section>

        {/* 4b. Mid-page CTA — varied copy */}
        <section className="direct-inline-cta direct-inline-cta-elevated" aria-label="Get started">
          <p className="direct-inline-cta-eyebrow">Your access layer</p>
          <p className="direct-inline-cta-headline">Most people either expose their email and get overwhelmed — or hide completely and miss real opportunities.</p>
          <p className="direct-inline-cta-kicker">Direct is the access layer in between: <strong>reachable on your terms, private until you approve</strong>.</p>
          <div className="direct-inline-cta-actions">
            {session ? (
              <Link className="button primary direct-hero-button" href="/direct/settings?slug=john&fixture=demo">Set up your access layer — free</Link>
            ) : (
              <Link className="button primary direct-hero-button" href="/direct/signup">Set up your access layer — free</Link>
            )}
            <Link className="button secondary" href="/direct/inbox?slug=john&fixture=demo">See a live example</Link>
          </div>
          <p className="direct-inline-cta-note">Takes under 2 minutes. No credit card. Free forever.</p>
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

        {/* 6. Example use cases — dramatic before/after split */}
        <section className="lane-panel direct-proof-panel direct-proof-panel-large direct-section-dark" aria-label="Example use cases">
          <div className="direct-panel-intro">
            <p className="lane-kicker">Before &amp; after</p>
            <h2>Same inbox, completely different signal-to-noise ratio</h2>
          </div>
          <div className="direct-proof-examples-large">
            <article className="direct-proof-example-large direct-proof-example-dramatic">
              <div className="direct-proof-example-header">
                <DirectIcon name="film" size={24} className="direct-proof-example-icon-large" />
                <p className="direct-proof-example-headline-large">Creator with 80K followers</p>
              </div>
              <div className="direct-proof-example-columns">
                <div className="direct-proof-col direct-proof-col-before">
                  <span className="direct-proof-col-label direct-proof-col-label-before">✕ Before Direct</span>
                  <ul className="direct-proof-col-list">
                    <li>Public email in bio — exposed to everyone</li>
                    <li>40+ messages/week, mostly spam and vague DMs</li>
                    <li>No budget or brief info on any pitch</li>
                  </ul>
                </div>
                <div className="direct-proof-col direct-proof-col-after">
                  <span className="direct-proof-col-label direct-proof-col-label-after">✓ After Direct</span>
                  <ul className="direct-proof-col-list">
                    <li>One Direct page in bio — email stays hidden</li>
                    <li>Brand deals arrive with budget and brief attached</li>
                    <li>Spam and low-effort pitches filtered automatically</li>
                  </ul>
                </div>
              </div>
            </article>
            <article className="direct-proof-example-large direct-proof-example-dramatic">
              <div className="direct-proof-example-header">
                <DirectIcon name="briefcase" size={24} className="direct-proof-example-icon-large" />
                <p className="direct-proof-example-headline-large">Independent advisor</p>
              </div>
              <div className="direct-proof-example-columns">
                <div className="direct-proof-col direct-proof-col-before">
                  <span className="direct-proof-col-label direct-proof-col-label-before">✕ Before Direct</span>
                  <ul className="direct-proof-col-list">
                    <li>&ldquo;Can I pick your brain?&rdquo; — no scope, no budget</li>
                    <li>Half the replies go nowhere</li>
                    <li>Hours wasted on unqualified conversations</li>
                  </ul>
                </div>
                <div className="direct-proof-col direct-proof-col-after">
                  <span className="direct-proof-col-label direct-proof-col-label-after">✓ After Direct</span>
                  <ul className="direct-proof-col-list">
                    <li>Scope, budget, and timeline required upfront</li>
                    <li>Only qualified requests make it through</li>
                    <li>Unqualified asks never reach the inbox</li>
                  </ul>
                </div>
              </div>
            </article>

          </div>
        </section>

        {/* 6d. Security trust block */}
        <section className="direct-security-strip direct-security-strip-v2 direct-security-strip-v3" aria-label="Security and privacy">
          <div className="direct-security-icon-wrap" aria-hidden="true">
            <DirectIcon name="shield" size={22} />
          </div>
          <div className="direct-security-content">
            <p className="direct-security-headline">Private by default. No exceptions.</p>
            <p className="direct-security-copy">Your email is never shared with senders. All data is encrypted in transit and at rest. We don&apos;t track you, sell your data, or inject ads — and we never will.</p>
            <div className="direct-security-claims">
              <span className="direct-security-claim"><DirectIcon name="lock" size={13} /> Email never shared</span>
              <span className="direct-security-claim"><DirectIcon name="shield" size={13} /> End-to-end encryption</span>
              <span className="direct-security-claim"><DirectIcon name="eye-off" size={13} /> Zero tracking</span>
              <span className="direct-security-claim"><DirectIcon name="x" size={13} /> No ads, ever</span>
              <span className="direct-security-claim"><DirectIcon name="check" size={13} /> GDPR compliant</span>
            </div>
          </div>
        </section>

        {/* 7. Pricing summary */}
        <section className="lane-panel direct-pricing-panel direct-section-tinted" aria-label="Direct pricing overview">
          <div className="direct-panel-intro">
            <p className="lane-kicker">Simple pricing</p>
            <h2>Free forever. Upgrade only if you outgrow it.</h2>
          </div>
          <div className="direct-pricing-grid">
            <article className="direct-pricing-card direct-pricing-card-free direct-pricing-card-highlighted">
              <div className="direct-pricing-badge">Most popular</div>
              <h3>Free</h3>
              <p className="direct-pricing-price">$0<span className="direct-pricing-period"> / forever</span></p>
              <p className="direct-pricing-desc">Everything you need to protect your inbox and filter inbound.</p>
              <ul className="direct-pricing-list">
                <li>Public Direct page (your access layer)</li>
                <li>Structured request forms with custom fields</li>
                <li>Smart filtering and volume controls</li>
                <li>Private until you approve</li>
                <li>Email forwarding to your real inbox</li>
              </ul>
              {session ? (
                <Link className="button primary direct-pricing-cta" href="/direct/settings?slug=john&fixture=demo">Protect my inbox — free</Link>
              ) : (
                <Link className="button primary direct-pricing-cta" href="/direct/signup">Protect my inbox — free</Link>
              )}
              <p className="direct-pricing-reassurance">No credit card · Set up in 2 minutes</p>
            </article>
            <article className="direct-pricing-card direct-pricing-card-paid">
              <h3>Pro</h3>
              <p className="direct-pricing-price">$19<span className="direct-pricing-period"> / month</span></p>
              <p className="direct-pricing-desc">For high-volume professionals who need advanced control.</p>
              <ul className="direct-pricing-list">
                <li>Everything in Free</li>
                <li>Uncapped request volume</li>
                <li>Custom routing rules per category</li>
                <li>Paid inbound requests (charge senders)</li>
                <li>Team routing and delegation</li>
                <li>Priority support</li>
              </ul>
              <Link className="button secondary direct-pricing-cta direct-pricing-waitlist-btn" href="/direct/signup">Join the waitlist — launching soon</Link>
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
          <h2>People email you.<br />You decide what gets through.</h2>
          <p>One page. Structured requests. Private until approved.<br />Your access layer between you and the outside world — free forever.</p>
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
