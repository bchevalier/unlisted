import React from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { getKeeperSessionFromCookies } from '../../lib/keeper-auth';
import { DirectIcon } from './direct-icons';
import { LogoutButton } from './logout-button';
import { FloatingCTA } from './floating-cta';

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
  { icon: 'lock', text: 'Your real email stays hidden — senders never see it' },
  { icon: 'clipboard', text: 'Budget, scope, and timeline — required before anything reaches you' },
  { icon: 'shield', text: 'Spam, cold pitches, and vague asks — filtered before your inbox' },
] as const;

const HERO_SOCIAL_PROOF_AVATARS = [
  { initials: 'MC', color: '#e11a8c' },
  { initials: 'DO', color: '#2563eb' },
  { initials: 'SK', color: '#0d9488' },
  { initials: 'JR', color: '#d97706' },
  { initials: 'AL', color: '#9333ea' },
] as const;

const BENEFITS = [
  { icon: 'lock', title: 'Private until approved', copy: 'Your email, DMs, and private channels stay hidden behind your access layer. Nothing gets through until you say so.', stat: '100%', statLabel: 'of contacts hidden' },
  { icon: 'clipboard', title: 'Structured from the start', copy: 'Budget, brief, category, and timeline — collected upfront so every request arrives ready for a decision.', stat: '3 min', statLabel: 'avg. review time' },
  { icon: 'shield', title: 'Noise never reaches you', copy: 'Volume limits, smart routing, and automation filter spam, cold pitches, and vague outreach before they hit your inbox.', stat: '96%', statLabel: 'of noise blocked' },
] as const;

const HOW_IT_WORKS = [
  { step: '01', title: 'Share one link — your access layer', copy: 'Put your Direct page in your bio, website, or signature. Your real email stays hidden. Senders reach your access layer, not you directly.' },
  { step: '02', title: 'Senders provide what you require', copy: 'Budget, scope, timeline, category — defined by you, filled in by them. Nothing incomplete reaches your inbox.' },
  { step: '03', title: 'Private until approved', copy: 'Spam, cold pitches, and vague asks are filtered automatically. What arrives is structured, complete, and stays private until you approve the interaction.' },
] as const;

const NOT_A_FORM = [
  { icon: 'zap', title: 'Contact form', issue: 'Drops messages into your inbox with no filtering, no structure, no control. Every sender gets equal access to your attention — and your real email is exposed.', highlights: ['No filtering', 'No structure', 'No privacy', 'Email exposed'], negative: true },
  { icon: 'shield', title: 'Knokio Direct', issue: 'An access layer between you and the outside world. Every request is structured with budget and scope. Volume limits enforce control. Private until you approve.', highlights: ['Access layer', 'Structured intake', 'Volume controls', 'Private until approved'], negative: false },
] as const;

const TESTIMONIALS = [
  { quote: 'I replaced my public email with a Direct page. Brand deals now arrive with budget and brief attached — I went from 40+ random DMs a week to 5 qualified pitches.', author: 'Mia Chen', role: 'Content creator · 82K YouTube subscribers', initials: 'MC', color: '#e11a8c', icon: 'film', result: '87% fewer unqualified messages' },
  { quote: 'Every inquiry now comes with scope and budget attached. My close rate on advisory work doubled because I only see requests that are already serious.', author: 'David Okafor', role: 'Management consultant · ex-McKinsey', initials: 'DO', color: '#2563eb', icon: 'briefcase', result: '2× close rate on qualified leads' },
  { quote: 'Investor intros, hiring leads, and partnership requests each route into separate categories automatically. We went from 3 hours of weekly triage to zero.', author: 'Sarah Kim', role: 'CEO, Layerform · Series A', initials: 'SK', color: '#0d9488', icon: 'store', result: 'Zero manual inbox sorting' },
] as const;

const COST_OF_INACTION = [
  { stat: '147', label: 'emails per day', copy: 'The average professional receives 147 emails daily. Most are noise.', source: 'Radicati Group, 2024' },
  { stat: '28%', label: 'of the workday', copy: 'Workers spend 28% of their day managing email — that\'s 11 hours a week.', source: 'McKinsey Global Institute' },
  { stat: '$1,250', label: 'lost per week', copy: 'Unstructured inbound costs professionals $1,250/week in lost productivity.', source: 'Based on avg. salary × email time' },
] as const;

const WHO_FOR_PRIMARY = [
  { icon: 'film', color: '#e11a8c', title: 'Creators and influencers', copy: 'Brand deals, collabs, and sponsorship requests — structured with budget and brief before they reach you.', before: '40+ random DMs a week', after: '5 qualified pitches with budget attached' },
  { icon: 'briefcase', color: '#2563eb', title: 'Advisors and consultants', copy: 'Collect scope, budget, and timeline before advisory or consulting requests earn your attention.', before: 'Vague "pick your brain" requests', after: 'Scoped inquiries with budget upfront' },
  { icon: 'store', color: '#0d9488', title: 'Small businesses and online services', copy: 'Separate sales from operations, route customer requests from support, and auto-reply when info is missing.', before: '3 hours/week sorting inbound manually', after: 'Auto-routed by category, zero triage' },
  { icon: 'building', color: '#d97706', title: 'Public figures and founders', copy: 'Route investor intros, media requests, partnerships, and hiring leads into separate categories automatically.', before: 'Everything mixed in one inbox', after: 'Investors, press, and hiring — auto-separated' },
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

const TRUST_ARCHITECTURE = [
  { icon: 'lock', title: 'Encrypted everywhere', copy: 'All data encrypted in transit (TLS 1.3) and at rest (AES-256). Your email address is never stored in plaintext alongside sender data.' },
  { icon: 'eye-off', title: 'Zero tracking, zero ads', copy: 'No analytics trackers, no ad pixels, no data brokers. We make money from subscriptions, not your data.' },
  { icon: 'shield', title: 'You own your data', copy: 'Export or delete everything with one click. When you leave, your data leaves with you. GDPR and CCPA compliant.' },
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

      <FloatingCTA href={session ? '/direct/settings?slug=john&fixture=demo' : '/direct/signup'} />

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
              <p className="direct-hero-subtitle">Knokio Direct is your <strong>access layer</strong> — a single link between you and the outside world. One link replaces your public email. Senders provide budget, scope, and timeline before anything reaches you. <strong>Private until approved.</strong></p>
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
                <Link className="button secondary direct-hero-button" href="#how-it-works">See how it works</Link>
              </div>
              <p className="hero-meta direct-hero-meta">Free forever · No credit card · Live in 2 minutes</p>
              <div className="direct-hero-social-proof direct-hero-social-proof-simple">
                <DirectIcon name="users" size={14} className="direct-hero-social-proof-icon" />
                <p className="direct-hero-social-line">Trusted by <strong>2,400+</strong> creators, advisors, and founders</p>
              </div>
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
                          <span className="direct-mockup-from">{item.from}<span className="direct-mockup-category">{item.category}</span></span>
                          <span className="direct-mockup-time">{item.time}</span>
                        </div>
                        <span className="direct-mockup-detail">{item.detail}</span>
                      </div>
                    </div>
                  ))}
                  <p className="direct-mockup-note">Spam filtered · Qualified requests only</p>
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

        {/* 3. How it works — moved up so cold visitors understand the mechanism early */}
        <section id="how-it-works" className="lane-panel direct-steps-panel direct-section-dark" aria-label="How Direct works">
          <div className="direct-steps-intro">
            <p className="lane-kicker">How it works</p>
            <h2>Three steps to a protected inbox</h2>
            <p className="direct-section-lede">No code, no complex setup. You&apos;ll be filtering inbound in under two minutes.</p>
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

        {/* 3a. Trust signals strip */}
        <div className="direct-trust-strip" aria-label="Trust signals">
          {TRUST_SIGNALS.map((signal) => (
            <span key={signal} className="direct-trust-pill">{signal}</span>
          ))}
        </div>

        {/* 4. Not a contact form — comparison */}
        <section className="lane-panel direct-notform-panel direct-notform-panel-wide" aria-label="Not just a contact form">
          <div className="direct-panel-intro">
            <p className="lane-kicker">Not a contact form</p>
            <h2 className="direct-heading-marquee">A contact form exposes your email.<br />An access layer filters first.</h2>
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

        {/* 4a. Social proof — outcome metrics strip */}
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

        {/* 5. Who it is for */}
        <section className="lane-panel direct-audience-panel direct-section-tinted" aria-label="Who Direct is for">
          <div className="direct-panel-intro">
            <p className="lane-kicker">Who Direct is for</p>
            <h2>Built for people who receive unsolicited inbound</h2>
          </div>
          <div className="direct-audience-grid direct-audience-grid-2col">
            {WHO_FOR_PRIMARY.map((w) => (
              <article key={w.title} className="direct-audience-card direct-audience-card-expanded">
                <div className="direct-audience-head">
                  <span className="direct-audience-icon" style={{ color: w.color }}>
                    <DirectIcon name={w.icon} size={18} />
                  </span>
                  <h3>{w.title}</h3>
                </div>
                <p>{w.copy}</p>
                <div className="direct-audience-transform">
                  <span className="direct-audience-before"><span className="direct-audience-x" aria-hidden="true">✕</span> {w.before}</span>
                  <span className="direct-audience-arrow" aria-hidden="true">→</span>
                  <span className="direct-audience-after"><span className="direct-audience-check" aria-hidden="true">✓</span> {w.after}</span>
                </div>
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

        {/* 6. Cost of inaction — urgency section (moved before testimonials for narrative flow: problem → proof) */}
        <section className="lane-panel direct-cost-panel" aria-label="The cost of unfiltered inbound">
          <div className="direct-panel-intro">
            <p className="lane-kicker">The cost of doing nothing</p>
            <h2>Unfiltered inbound is expensive — even when it&apos;s &ldquo;free&rdquo;</h2>
          </div>
          <div className="direct-cost-grid">
            {COST_OF_INACTION.map((c) => (
              <article key={c.label} className="direct-cost-card">
                <span className="direct-cost-stat">{c.stat}</span>
                <span className="direct-cost-label">{c.label}</span>
                <p>{c.copy}</p>
                <span className="direct-cost-source">{c.source}</span>
              </article>
            ))}
          </div>
        </section>

        {/* 6b. Testimonials — elevated typography (after cost section for maximum contrast: "this hurts" → "this works") */}
        <section className="lane-panel direct-testimonials-panel direct-testimonials-elevated" aria-label="What users say">
          <div className="direct-panel-intro">
            <p className="lane-kicker">What users say</p>
            <h2>Results after switching to Direct</h2>
          </div>
          <div className="direct-testimonials-grid">
            {TESTIMONIALS.map((t, i) => (
              <article key={t.author} className={`direct-testimonial-card${i === 0 ? ' direct-testimonial-card-featured' : ''}`}>
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

        {/* 7. Trust architecture — "why trust Knokio with privacy" */}
        <section className="lane-panel direct-trust-arch-panel direct-section-dark" aria-label="Why trust Knokio">
          <div className="direct-panel-intro">
            <p className="lane-kicker">Privacy by design</p>
            <h2>Your data is yours. Full stop.</h2>
            <p className="direct-section-lede">Knokio is a privacy product — so we built it like one. No tracking, no ads, no data deals. Here&apos;s how we protect you.</p>
          </div>
          <div className="direct-trust-arch-grid">
            {TRUST_ARCHITECTURE.map((t) => (
              <article key={t.title} className="direct-trust-arch-card">
                <DirectIcon name={t.icon} size={20} className="direct-trust-arch-icon" />
                <h3>{t.title}</h3>
                <p>{t.copy}</p>
              </article>
            ))}
          </div>
        </section>

        {/* 8. Pricing summary (with integrated security trust) */}
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
                <li>Your public access layer — one link, always reachable</li>
                <li>Structured intake with custom fields per category</li>
                <li>Smart filtering and volume controls</li>
                <li>Private until approved — your email never exposed</li>
                <li>Forwarding to your real inbox when you say so</li>
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
              <p className="direct-pricing-desc">Advanced control for high-volume professionals.</p>
              <ul className="direct-pricing-list">
                <li>Everything in Free</li>
                <li>Uncapped request volume</li>
                <li>Custom routing rules per category</li>
                <li>Paid inbound requests (charge senders)</li>
                <li>Team routing and delegation</li>
              </ul>
              <Link className="button secondary direct-pricing-cta direct-pricing-waitlist-btn" href="/direct/signup">Start free, upgrade later</Link>
              <p className="direct-pricing-waitlist">Pro launches soon. Start free — nothing changes when you upgrade.</p>
            </article>
          </div>
          <div className="direct-pricing-trust" aria-label="Security and privacy">
            <div className="direct-pricing-trust-claims">
              <span className="direct-security-claim"><DirectIcon name="lock" size={13} /> Email never shared</span>
              <span className="direct-security-claim"><DirectIcon name="shield" size={13} /> End-to-end encryption</span>
              <span className="direct-security-claim"><DirectIcon name="eye-off" size={13} /> Zero tracking</span>
              <span className="direct-security-claim"><DirectIcon name="x" size={13} /> No ads, ever</span>
              <span className="direct-security-claim"><DirectIcon name="check" size={13} /> GDPR compliant</span>
            </div>
          </div>
        </section>

        {/* 9. FAQ — accordion */}
        <section className="lane-panel direct-faq-panel" aria-label="FAQ">
          <div className="direct-faq-intro">
            <p className="lane-kicker">FAQ</p>
            <h2>Common questions</h2>
          </div>
          <div className="direct-faq-accordion">
            {FAQ.map((f, i) => (
              <details key={f.q} className="direct-faq-item" open={i === 0 ? true : undefined}>
                <summary className="direct-faq-question">{f.q}</summary>
                <p className="direct-faq-answer">{f.a}</p>
              </details>
            ))}
          </div>
        </section>

        {/* 10. Final CTA */}
        <section className="lane-panel direct-final-cta direct-section-dark" aria-label="Final call to action">
          <p className="lane-kicker">Start now</p>
          <h2>Your inbox, your rules.<br />Live in two minutes.</h2>
          <p>One link replaces your public email. Structured intake, automatic filtering, private until approved.</p>
          <div className="direct-faq-actions">
            {session ? (
              <Link className="button primary direct-hero-button" href="/direct/settings?slug=john&fixture=demo">Protect my inbox — free</Link>
            ) : (
              <Link className="button primary direct-hero-button" href="/direct/signup">Protect my inbox — free</Link>
            )}
          </div>
          <p className="direct-final-cta-expectation">Pick your categories → your access layer goes live. Senders see your page, not your email. No code needed.</p>
        </section>
      </div>
    </main>
  );
}
