import React from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { getKeeperSessionFromCookies } from '../../lib/keeper-auth';
import { DirectIcon } from './direct-icons';
import { LogoutButton } from './logout-button';
import { FloatingCTA } from './floating-cta';
import { ScrollReveal, StaggerReveal } from './scroll-reveal';

/* Trust signals strip removed in pass 15 — redundant with hero meta + pricing trust row */
/* Hero pain paragraph removed in pass 15 — headline already communicates the problem */
/* Hero stats bar removed in pass 15 — proof stats in testimonials section cover this */
/* Inline CTA after sender view removed in pass 15 — midpage CTA serves same purpose */
/* Post-testimonial CTA removed in pass 15 — pricing section + final CTA handle conversion */

const SENDER_VIEW_FIELDS = [
  { label: 'Category', value: 'Sponsorship inquiry', type: 'select' },
  { label: 'Budget range', value: '$8,000 – $15,000', type: 'select' },
  { label: 'Timeline', value: 'Q2 2026 — starts in 3 weeks', type: 'select' },
  { label: 'Brief / scope', value: 'Integrated product review for our meal-kit launch. 1 dedicated video (8–12 min) + 2 Instagram stories over 2 weeks…', type: 'textarea' },
  { label: 'Your work email', value: 'jessica.wong@freshlyco.com', type: 'input' },
] as const;

const HERO_INBOX_PREVIEW = [
  { status: 'accepted', from: 'Nike Brand Team', category: 'Sponsorship', detail: '$12K · Brief + timeline attached', time: '2h ago' },
  { status: 'filtered', from: 'Random cold pitch', category: 'Spam', detail: 'Auto-blocked — no budget, no brief', time: '4h ago' },
  { status: 'accepted', from: 'Verge Editorial', category: 'Media', detail: 'Interview request · Deadline: Mar 18', time: '1d ago' },
  { status: 'pending', from: 'Series A Fund', category: 'Investor', detail: '$2M follow-on intro · Warm referral', time: '1d ago' },
] as const;

/* Featured quote removed in v3 pass — keeping social proof language concrete without decorative metrics */

const HERO_BULLETS = [
  { icon: 'lock', text: 'Your real email stays hidden — always' },
  { icon: 'clipboard', text: 'Budget, scope, and timeline collected upfront' },
  { icon: 'shield', text: 'Spam and low-effort asks blocked automatically' },
] as const;

const BENEFITS = [
  { icon: 'lock', title: 'Private until approved', copy: 'Your real email, DMs, and private channels stay hidden unless you approve a request.' },
  { icon: 'clipboard', title: 'Structured from the start', copy: 'Budget, scope, and timeline are required before anything reaches you.' },
  { icon: 'shield', title: 'Low-signal filtered automatically', copy: 'Spam and low-effort outreach are filtered before they hit your inbox.' },
] as const;

const HOW_IT_WORKS = [
  { step: '01', title: 'Share one link instead of your email', copy: 'Add your Direct page to your bio, site, or signature. Senders use that link, not your private inbox.' },
  { step: '02', title: 'Require context upfront', copy: 'Collect budget, scope, timeline, and category before a request can be submitted.' },
  { step: '03', title: 'Review only qualified requests', copy: 'Spam is filtered automatically. You approve the requests worth your time.' },
] as const;

/* Cost of inaction section removed in pass 12 — adds scroll without conversion lift */

const WHO_FOR_PRIMARY = [
  { icon: 'film', color: '#e11a8c', title: 'Creators and influencers', copy: 'Stop losing serious sponsorships in DM chaos. Require budget, deliverables, and timing upfront so brand requests are easy to assess.', before: 'Brand and collab DMs with no budget, brief, or timing', after: 'Qualified sponsorship requests arrive ready to review' },
  { icon: 'briefcase', color: '#2563eb', title: 'Advisors and consultants', copy: 'Screen out vague brain-picking requests. Require scope, timeline, and budget so only serious work reaches you.', before: '"Can I pick your brain?" with no scope or budget', after: 'Clear project requests you can price in minutes' },
  { icon: 'store', color: '#0d9488', title: 'Small businesses', copy: 'Don’t lose time replying to bad-fit inquiries during busy periods. Set the rules that make a request eligible, and auto-reply fast so serious customers aren’t lost when you are overloaded.', before: 'Every inquiry gets a manual reply, even during crunch time', after: 'Only eligible customers get through, with fast automatic replies when you are busy' },
  { icon: 'building', color: '#d97706', title: 'Founders and public figures', copy: 'Keep investor, press, hiring, and partnership inbound from colliding. Route each type with the context needed to act quickly.', before: 'High-value opportunities buried in one chaotic inbox', after: 'Investor, press, hiring, and partnership queues stay separate and actionable', desktopOnly: true },
] as const;

const WHO_FOR_MORE = [
  { icon: 'building', color: '#d97706', title: 'Founders and public figures', copy: 'Keep investor, press, hiring, and partnership inbound from colliding. Route each type with the context needed to act quickly.', before: 'High-value opportunities buried in one chaotic inbox', after: 'Investor, press, hiring, and partnership queues stay separate and actionable', mobileOnly: true },
  { icon: 'users', color: '#0284c7', title: 'Recruiters and hiring managers', copy: 'Require role fit, availability, and key details before candidates or agencies take recruiter time.', before: 'Candidate and agency outreach arrives missing the basics', after: 'Role-fit inquiries reach the team with context already filled in' },
  { icon: 'home', color: '#16a34a', title: 'Real estate agents', copy: 'When listings move fast, do not waste time on unqualified buyer or seller leads. Collect budget, location, and timeline before you reply.', before: 'Buyer and seller messages arrive without budget, location, or timing', after: 'Qualified property inquiries come in with the details needed to respond fast' },
  { icon: 'heart', color: '#dc2626', title: 'Nonprofits and communities', copy: 'Separate volunteer, donor, partner, and media inbound so the right person can respond without internal triage chaos.', before: 'Mission-critical asks all land in one shared inbox', after: 'Each request type reaches the right person with the right context attached' },
  { icon: 'mic', color: '#9333ea', title: 'Event organizers', copy: 'Keep speaker, sponsor, vendor, and media inbound organized before event week gets chaotic.', before: 'Speakers, sponsors, and media all land in one inbox', after: 'Event requests are separated early, with required details collected upfront' },
  { icon: 'activity', color: '#0891b2', title: 'Healthcare and legal practices', copy: 'Collect the basics before staff review new inquiries. Reduce time spent chasing missing details and triaging bad-fit intake.', before: 'New client or patient requests arrive half-complete', after: 'Structured intake happens before staff time is spent reviewing' },
  { icon: 'music', color: '#c026d3', title: 'Artists and musicians', copy: 'Keep bookings, licensing, press, and fan messages from competing in the same inbox. Protect creative focus while still catching the right opportunities.', before: 'Booking, licensing, and fan asks all mix together', after: 'Creative opportunities are separated from low-signal noise' },
  { icon: 'code', color: '#64748b', title: 'Open source maintainers', copy: 'Stop sponsorship, hiring, and consulting outreach from drowning in community support traffic.', before: 'Commercial outreach gets buried inside project and community noise', after: 'Sponsor, hiring, and consulting opportunities are easy to spot and review' },
] as const;

/* Trust architecture section removed in pass 12 — key claims moved to pricing trust row */

const FAQ = [
  { q: 'Will people still be able to reach me easily?', a: 'Yes. Anyone with your link can send a request — Direct just ensures you get budget, scope, and context upfront instead of a blank "hey, can we chat?"' },
  { q: 'Do I have to reply to every request?', a: 'No. You can accept, decline, or let requests expire automatically. Senders see a neutral status page — no pressure, no awkward silence.' },
  { q: 'How is my data protected?', a: 'All data is encrypted in transit and at rest. Your email is never shared with senders. We don\u2019t track, sell, or monetize your data. GDPR and CCPA compliant.' },
  { q: 'How does billing work?', a: 'Knokio Direct is $5/month with 50 handled inbound requests included. After that, extra handled inbound starts at $0.05 each and gets cheaper at higher volume. Optional pay-to-contact categories are separate and only apply if you decide to charge for access.' },
  { q: 'Can I customize what information I collect?', a: 'Yes. You define categories, required fields, and intake questions. Different request types can collect different information — sponsorships vs. hiring vs. press, for example.' },
  { q: 'How does this work with my existing email?', a: 'Direct sits in front of your email, not instead of it. Approved requests forward to your real inbox. Your address is never exposed to senders.' },
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
              <Link className="topbar-cta-primary" href="/direct/signup">Get started</Link>
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
              <p className="direct-hero-tagline">Private until approved</p>
              <h1 className="hero-title direct-hero-title">Stop letting strangers decide<br /><span className="direct-hero-title-accent">what lands in your inbox.</span></h1>
              <p className="direct-hero-subtitle">Replace your public email with one link. Your real email stays hidden, senders must include budget/scope/timeline, and low-signal spam is filtered automatically before it reaches you.</p>
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
                  <Link className="button primary direct-hero-button" href="/direct/settings?slug=john&fixture=demo">Protect my inbox</Link>
                ) : (
                  <Link className="button primary direct-hero-button" href="/direct/signup">Protect my inbox</Link>
                )}
                <Link className="button secondary direct-hero-demo-link" href="/direct/demo">Watch interactive demo</Link>
                <a className="direct-hero-link-secondary" href="#sender-view">See what senders see ↓</a>
              </div>
              <p className="hero-meta direct-hero-meta">Simple billing · $5/month · 50 handled inbound included</p>
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

        {/* 1a. Industry trust bar removed in pass 17 — generic categories without real logos hurt credibility */}

        {/* 1b. Featured quote removed in pass v2-12 — redundant with testimonials + hero social proof */}

        {/* 2. Three benefit cards */}
        <StaggerReveal className="direct-proof-strip" stagger={100}>
          {BENEFITS.map((b) => (
            <article key={b.title} className="direct-proof-card direct-proof-card-enhanced sr-stagger-item">
              <div className="direct-proof-head">
                <DirectIcon name={b.icon} size={18} className="direct-proof-icon" />
                <p className="direct-proof-title">{b.title}</p>
              </div>
              <p className="direct-proof-copy">{b.copy}</p>
            </article>
          ))}
        </StaggerReveal>

        {/* 3. How it works — immediately after benefits for comprehension */}
        <ScrollReveal>
        <section id="how-it-works" className="lane-panel direct-steps-panel direct-section-dark" aria-label="How Direct works">
          <div className="direct-steps-intro">
            <p className="lane-kicker">Simple by design</p>
            <h2>Three steps to a protected inbox</h2>
            <p className="direct-section-lede">No code. No complex setup. Start filtering inbound in minutes.</p>
          </div>
          <StaggerReveal className="direct-steps-grid" stagger={120}>
            {HOW_IT_WORKS.map((s) => (
              <article key={s.step} className="direct-step-card direct-step-card-inline sr-stagger-item">
                <div className="direct-step-head">
                  <span className="direct-step-number">{s.step}</span>
                  <h3>{s.title}</h3>
                </div>
                <p>{s.copy}</p>
              </article>
            ))}
          </StaggerReveal>
        </section>
        </ScrollReveal>

        {/* 3a. What senders see — builds trust by showing the sender's experience */}
        <ScrollReveal>
        <section id="sender-view" className="lane-panel direct-sender-panel" aria-label="What senders see">
          <div className="direct-panel-intro">
            <p className="lane-kicker">The sender&apos;s experience</p>
            <h2>What people see when they reach you</h2>
            <p className="direct-section-lede">Senders see a clean form — not your email. Here&apos;s what they fill out before anything reaches you.</p>
          </div>
          <div className="direct-sender-layout">
            <div className="direct-sender-mockup">
              <div className="direct-mockup-chrome direct-mockup-chrome-sender">
                <div className="direct-mockup-bar">
                  <span className="direct-mockup-dot" />
                  <span className="direct-mockup-dot" />
                  <span className="direct-mockup-dot" />
                  <span className="direct-mockup-url">knokio.io/u/you</span>
                </div>
                <div className="direct-sender-mockup-body">
                  <p className="direct-sender-mockup-heading">Send a request</p>
                  <p className="direct-sender-mockup-subheading">Complete the required fields below. Only structured requests are reviewed.</p>
                  <div className="direct-sender-fields">
                    {SENDER_VIEW_FIELDS.map((f) => (
                      <div key={f.label} className={`direct-sender-field direct-sender-field-${f.type}`}>
                        <span className="direct-sender-field-label">{f.label}</span>
                        <span className="direct-sender-field-value">{f.value}</span>
                      </div>
                    ))}
                  </div>
                  <div className="direct-sender-submit">
                    <span className="direct-sender-submit-btn">Submit request</span>
                  </div>
                  <p className="direct-sender-mockup-footer">Your email is only shared if this request is approved.</p>
                </div>
              </div>
            </div>
            <div className="direct-sender-callouts">
              <div className="direct-sender-callout">
                <DirectIcon name="clipboard" size={16} className="direct-sender-callout-icon" />
                <div>
                  <p className="direct-sender-callout-title">Required context upfront</p>
                  <p className="direct-sender-callout-copy">Budget, scope, and timeline are required before a request can be sent.</p>
                </div>
              </div>
              <div className="direct-sender-callout">
                <DirectIcon name="shield" size={16} className="direct-sender-callout-icon" />
                <div>
                  <p className="direct-sender-callout-title">Private and filtered by default</p>
                  <p className="direct-sender-callout-copy">Your email stays hidden until approval, and low-effort outreach is filtered automatically.</p>
                </div>
              </div>
            </div>
          </div>
        </section>

        </ScrollReveal>

        {/* 5. Who it is for — after explanation sections, self-identification */}
        <ScrollReveal>
        <section className="lane-panel direct-audience-panel direct-section-tinted" aria-label="Who Direct is for">
          <div className="direct-panel-intro">
            <p className="lane-kicker">Built for you</p>
            <h2>If you receive unsolicited inbound, this is your tool</h2>
          </div>
          <StaggerReveal className="direct-audience-grid direct-audience-grid-2col" stagger={100}>
            {WHO_FOR_PRIMARY.map((w, i) => (
              <article key={w.title} className={`direct-audience-card direct-audience-card-expanded sr-stagger-item${i === 0 ? ' direct-audience-card-featured' : ''}${'desktopOnly' in w && w.desktopOnly ? ' direct-desktop-only-card' : ''}`}>
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
          </StaggerReveal>
          <details className="direct-audience-more">
            <summary className="direct-audience-more-toggle">See more use cases</summary>
            <div className="direct-audience-grid direct-audience-more-grid">
              {WHO_FOR_MORE.map((w) => (
                <article key={`${w.title}-${w.before}`} className={`direct-audience-card direct-audience-card-expanded${'mobileOnly' in w && w.mobileOnly ? ' direct-mobile-only-card' : ''}`}>
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
          </details>
        </section>

        </ScrollReveal>

        {/* 6. Pricing summary */}
        <ScrollReveal>
        <section className="lane-panel direct-pricing-panel direct-section-tinted" aria-label="Direct pricing overview">
          <div className="direct-panel-intro">
            <p className="lane-kicker">Simple billing</p>
            <h2>One plan. One meter. Pay only for real requests.</h2>
          </div>
          <div className="direct-pricing-equation" aria-label="Monthly bill formula">
            <article className="direct-pricing-equation-part">
              <p className="direct-pricing-summary-label">Base</p>
              <h3>$5 / month</h3>
              <p>All Direct features included</p>
            </article>
            <span className="direct-pricing-equation-operator" aria-hidden="true">+</span>
            <article className="direct-pricing-equation-part">
              <p className="direct-pricing-summary-label">Included each month</p>
              <h3>50 handled inbound</h3>
              <p>No overage for the first 50 requests</p>
            </article>
            <span className="direct-pricing-equation-operator" aria-hidden="true">+</span>
            <article className="direct-pricing-equation-part">
              <p className="direct-pricing-summary-label">After 50</p>
              <h3>From $0.05 each</h3>
              <p>Price drops as monthly volume grows</p>
            </article>
          </div>
          <p className="direct-pricing-note">Only handled inbound requests count. Blocked spam, abuse, and retries do not.</p>

          <div className="direct-pricing-meter-explainer" aria-label="What billing counts and ignores">
            <article className="direct-pricing-meter-card">
              <h3>What counts</h3>
              <ul className="direct-pricing-list">
                <li>Handled inbound requests</li>
                <li>Includes up to 1 system auto-reply per handled inbound if needed</li>
              </ul>
            </article>
            <article className="direct-pricing-meter-card">
              <h3>What does not count</h3>
              <ul className="direct-pricing-list">
                <li>Blocked spam or abuse traffic</li>
                <li>Invalid submissions rejected before processing</li>
                <li>Provider retries or duplicate inbound attempts</li>
              </ul>
            </article>
          </div>

          <div className="direct-pricing-primary-cta">
            {session ? (
              <Link className="button primary direct-pricing-cta" href="/direct/settings?slug=john&fixture=demo">Start Direct</Link>
            ) : (
              <Link className="button primary direct-pricing-cta" href="/direct/signup">Start Direct</Link>
            )}
            <p className="direct-pricing-reassurance">One plan · One meter · No feature gates</p>
          </div>
          <details className="direct-pricing-addon" aria-label="Optional pay-to-contact pricing">
            <summary>
              <span className="direct-pricing-addon-kicker">Optional</span>
              <span className="direct-pricing-addon-title">Optional: charge for access</span>
            </summary>
            <div className="direct-pricing-addon-body">
              <p className="direct-pricing-desc">Use this only for categories where access itself is the product.</p>
              <ul className="direct-pricing-list">
                <li>You set the pay-to-contact request cost (minimum $2)</li>
                <li>Knokio keeps max($0.50, 10% of the request cost)</li>
                <li>$10 request cost → you keep $9</li>
                <li>You see the expected payout before publishing</li>
              </ul>
              <Link className="button secondary direct-pricing-cta direct-pricing-waitlist-btn" href="/direct/signup">Configure paid categories</Link>
            </div>
          </details>
        </section>

        </ScrollReveal>

        {/* 9. FAQ — polished card-style accordion */}
        <ScrollReveal>
        <section className="lane-panel direct-faq-panel direct-faq-panel-v2" aria-label="FAQ">
          <div className="direct-faq-intro">
            <p className="lane-kicker">FAQ</p>
            <h2>Questions before you start</h2>
          </div>
          <div className="direct-faq-accordion direct-faq-accordion-v2">
            {FAQ.map((f, i) => (
              <details key={f.q} className="direct-faq-item direct-faq-item-v2" open={i === 0 ? true : undefined}>
                <summary className="direct-faq-question direct-faq-question-v2">{f.q}</summary>
                <p className="direct-faq-answer direct-faq-answer-v2">{f.a}</p>
              </details>
            ))}
          </div>
        </section>

        </ScrollReveal>

        {/* 8. Final CTA */}
        <ScrollReveal>
        <section className="lane-panel direct-final-cta direct-section-dark" aria-label="Final call to action">
          <p className="lane-kicker">Start now</p>
          <h2>Your inbox, your rules.<br />Live in minutes.</h2>
          <p className="direct-final-cta-desc">One link. Structured intake. Private until approved.</p>
          <div className="direct-faq-actions">
            {session ? (
              <Link className="button primary direct-hero-button" href="/direct/settings?slug=john&fixture=demo">Protect my inbox</Link>
            ) : (
              <Link className="button primary direct-hero-button" href="/direct/signup">Protect my inbox</Link>
            )}
          </div>
          <p className="direct-final-cta-expectation">Set categories → go live → review qualified inbound only.</p>
        </section>

        </ScrollReveal>

        {/* 11. Footer */}
        <footer className="direct-footer" aria-label="Knokio footer">
          <div className="direct-footer-inner">
            <div className="direct-footer-brand">
              <Image className="direct-footer-logo" src="/knokio-logo-small.jpg" alt="" aria-hidden="true" width={18} height={18} />
              <span className="direct-footer-title">Knokio</span>
            </div>
            <nav className="direct-footer-links" aria-label="Footer links">
              <Link href="/">Home</Link>
              <Link href="/direct">Direct</Link>
              <Link href="/direct/login">Log in</Link>
              <Link href="/direct/signup">Sign up</Link>
            </nav>
            <p className="direct-footer-copy">© {new Date().getFullYear()} Knokio. Privacy-first by design.</p>
          </div>
        </footer>
      </div>
    </main>
  );
}
