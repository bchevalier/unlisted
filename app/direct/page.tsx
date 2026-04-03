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

const HERO_INBOX_PREVIEW = [
  { status: 'accepted', from: 'Nike Brand Team', category: 'Sponsorship', detail: 'Budget: $12K · Brief attached' },
  { status: 'filtered', from: 'Random cold pitch', category: 'Spam', detail: 'Blocked — no budget, no brief' },
  { status: 'pending', from: 'TechCrunch Editor', category: 'Media', detail: 'Interview request · Timeline: 2 weeks' },
] as const;

const HERO_BULLETS = [
  { icon: 'lock', text: 'Private until you approve — your email stays hidden' },
  { icon: 'clipboard', text: 'Every request arrives with budget, scope, and timeline' },
  { icon: 'shield', text: 'Spam, cold pitches, and vague asks are blocked automatically' },
] as const;

const BENEFITS = [
  { icon: 'lock', title: 'Private until you approve', copy: 'Your email, DMs, and private channels stay hidden. Nothing gets through until you say so.' },
  { icon: 'clipboard', title: 'Every request arrives structured', copy: 'Budget, brief, category, and timeline — collected upfront so you never waste time on incomplete asks.' },
  { icon: 'shield', title: 'Noise is stopped automatically', copy: 'Volume limits, smart routing, and automation filter spam, cold pitches, and vague outreach before they become your problem.' },
] as const;

const HOW_IT_WORKS = [
  { step: '01', title: 'Share one page, not your email', copy: 'Replace scattered contact details with a single public page — your access layer between the outside world and your private channels.' },
  { step: '02', title: 'Collect the right details upfront', copy: 'Budget, scope, timeline — every request arrives structured before you spend a second on it.' },
  { step: '03', title: 'Only qualified requests get through', copy: 'Spam, cold pitches, and vague asks are stopped automatically. You only see what deserves your attention.' },
] as const;

const NOT_A_FORM = [
  { icon: 'zap', title: 'Contact form', issue: 'Drops messages into your inbox with no filtering, no structure, no control. Every sender gets equal access to your attention.' },
  { icon: 'shield', title: 'Knokio Direct', issue: 'An access layer that protects your inbox — it filters noise, structures every request, enforces volume limits, and keeps your private email hidden.' },
] as const;

const TESTIMONIALS = [
  { quote: 'I replaced my public email with a Direct page. Brand deals now arrive with budget and brief attached — I stopped wasting time on vague DMs overnight.', author: 'Creator, 80K followers', icon: 'film' },
  { quote: 'Every inquiry now comes with scope and budget. I haven\u2019t replied to a single "can I pick your brain?" email since switching.', author: 'Independent advisor', icon: 'briefcase' },
  { quote: 'We route investor intros, hiring leads, and partnerships into separate categories. Manual triage went from hours per week to zero.', author: 'Startup founder', icon: 'store' },
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
        {/* 1. Hero — 2-column with product mockup */}
        <section className="lane-hero-panel direct-hero-panel" aria-label="Knokio Direct overview">
          <div className="direct-hero-bg" aria-hidden="true">
            <div className="home-hero-grid direct-hero-grid" />
          </div>
          <div className="direct-hero-layout">
            <div className="direct-hero-content">
              <p className="hero-word">KNOKIO DIRECT</p>
              <p className="direct-hero-tagline">The access layer for your inbox</p>
              <h1 className="hero-title direct-hero-title">Stop getting emails you never asked for.</h1>
              <p className="direct-hero-subtitle">Replace your public email with one page that filters, structures, and protects every inbound request — private until you approve.</p>
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
              <p className="hero-meta direct-hero-meta">No credit card required · Set up in under 2 minutes</p>
            </div>
            <div className="direct-hero-mockup" aria-label="Direct inbox preview">
              <div className="direct-mockup-chrome">
                <div className="direct-mockup-bar">
                  <span className="direct-mockup-dot" />
                  <span className="direct-mockup-dot" />
                  <span className="direct-mockup-dot" />
                  <span className="direct-mockup-url">knokio.io/u/you</span>
                </div>
                <div className="direct-mockup-body">
                  <p className="direct-mockup-heading">Your Direct inbox</p>
                  {HERO_INBOX_PREVIEW.map((item) => (
                    <div key={item.from} className={`direct-mockup-row direct-mockup-row-${item.status}`}>
                      <span className={`direct-mockup-status direct-mockup-status-${item.status}`}>{item.status}</span>
                      <div className="direct-mockup-row-content">
                        <span className="direct-mockup-from">{item.from}</span>
                        <span className="direct-mockup-detail">{item.detail}</span>
                      </div>
                    </div>
                  ))}
                  <p className="direct-mockup-note">3 requests · 1 filtered automatically</p>
                </div>
              </div>
            </div>
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
            <p className="direct-section-lede">Setting up takes under two minutes. Here&apos;s what happens next.</p>
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

        {/* 3b. Social proof — contextual metrics */}
        <div className="direct-social-proof-strip" aria-label="Social proof">
          <div className="direct-social-proof-stat">
            <strong>2,400+</strong>
            <span>requests filtered &amp; structured</span>
          </div>
          <span className="direct-social-proof-divider" aria-hidden="true" />
          <div className="direct-social-proof-stat">
            <strong>380+</strong>
            <span>Direct pages active</span>
          </div>
          <span className="direct-social-proof-divider" aria-hidden="true" />
          <div className="direct-social-proof-stat">
            <strong>96%</strong>
            <span>of spam stopped before inbox</span>
          </div>
        </div>

        {/* 3c. Testimonials */}
        <section className="lane-panel direct-testimonials-panel" aria-label="What users say">
          <div className="direct-panel-intro">
            <p className="lane-kicker">From real users</p>
            <h2>What changes after switching to Direct</h2>
          </div>
          <div className="direct-testimonials-grid">
            {TESTIMONIALS.map((t) => (
              <article key={t.author} className="direct-testimonial-card">
                <DirectIcon name={t.icon} size={20} className="direct-testimonial-icon" />
                <blockquote className="direct-testimonial-quote">&ldquo;{t.quote}&rdquo;</blockquote>
                <p className="direct-testimonial-author">— {t.author}</p>
              </article>
            ))}
          </div>
        </section>

        {/* 4. Not just a contact form — objection handling */}
        <section className="lane-panel direct-notform-panel direct-notform-panel-wide" aria-label="Not just a contact form">
          <div className="direct-panel-intro">
            <p className="lane-kicker">Not a contact form</p>
            <h2>&ldquo;Isn&apos;t this just a contact form?&rdquo; — No. Here&apos;s the difference.</h2>
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

        {/* 4b. Mid-page CTA — varied copy */}
        <section className="direct-inline-cta direct-inline-cta-elevated" aria-label="Get started">
          <p className="direct-inline-cta-headline">Most people either expose themselves and get overwhelmed — or hide completely and miss good opportunities.</p>
          <p className="direct-inline-cta-kicker">Direct is the <strong>access layer</strong> in between. Private until approved.</p>
          <div className="direct-inline-cta-actions">
            {session ? (
              <Link className="button primary direct-hero-button" href="/direct/settings?slug=john&fixture=demo">Create your Direct page — free</Link>
            ) : (
              <Link className="button primary direct-hero-button" href="/direct/signup">Create your Direct page — free</Link>
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

        {/* 6. Example use cases — dramatic before/after split */}
        <section className="lane-panel direct-proof-panel direct-proof-panel-large direct-section-dark" aria-label="Example use cases">
          <div className="direct-panel-intro">
            <p className="lane-kicker">Before &amp; after</p>
            <h2>What changes when you add an access layer</h2>
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
                  <p>Public email in bio. 40+ messages a week — mostly spam, vague &ldquo;collab?&rdquo; DMs, and cold pitches with no budget info.</p>
                </div>
                <div className="direct-proof-col direct-proof-col-after">
                  <span className="direct-proof-col-label direct-proof-col-label-after">✓ After Direct</span>
                  <p>One Direct page in bio. Brand deals arrive with budget and brief attached. Everything else is filtered automatically.</p>
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
                  <p>Every inbound email starts with &ldquo;Can I pick your brain?&rdquo; — no scope, no budget, no timeline. Half the replies go nowhere.</p>
                </div>
                <div className="direct-proof-col direct-proof-col-after">
                  <span className="direct-proof-col-label direct-proof-col-label-after">✓ After Direct</span>
                  <p>Scope, budget range, and timeline are required upfront. Only qualified asks make it through — the rest never reach the inbox.</p>
                </div>
              </div>
            </article>
            <article className="direct-proof-example-large direct-proof-example-dramatic">
              <div className="direct-proof-example-header">
                <DirectIcon name="store" size={24} className="direct-proof-example-icon-large" />
                <p className="direct-proof-example-headline-large">Startup founder</p>
              </div>
              <div className="direct-proof-example-columns">
                <div className="direct-proof-col direct-proof-col-before">
                  <span className="direct-proof-col-label direct-proof-col-label-before">✕ Before Direct</span>
                  <p>One shared inbox for investor intros, partnership requests, and hiring leads. Sorting takes hours every week.</p>
                </div>
                <div className="direct-proof-col direct-proof-col-after">
                  <span className="direct-proof-col-label direct-proof-col-label-after">✓ After Direct</span>
                  <p>Each category collects different fields and routes to the right person. No more manual triage.</p>
                </div>
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
              <Link className="button primary direct-hero-button" href="/direct/settings?slug=john&fixture=demo">Set up in 2 minutes — free</Link>
            ) : (
              <Link className="button primary direct-hero-button" href="/direct/signup">Set up in 2 minutes — free</Link>
            )}
          </div>
        </section>

        {/* 6d. Security trust block */}
        <section className="direct-security-strip" aria-label="Security and privacy">
          <div className="direct-security-icon-wrap" aria-hidden="true">
            <DirectIcon name="shield" size={22} />
          </div>
          <div className="direct-security-content">
            <p className="direct-security-headline">Built for privacy from day one</p>
            <p className="direct-security-copy">Your real email is never exposed to senders. Data is encrypted in transit and at rest. No tracking pixels, no ad networks, no selling your data — ever.</p>
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
              <p className="direct-pricing-price"><span className="direct-pricing-period">Launching soon</span></p>
              <ul className="direct-pricing-list">
                <li>Everything in Free</li>
                <li>Uncapped request volume</li>
                <li>Custom routing rules</li>
                <li>Paid inbound requests</li>
                <li>Priority support</li>
              </ul>
              <Link className="button secondary direct-pricing-cta direct-pricing-waitlist-btn" href="/direct/signup">Get notified at launch</Link>
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
          <h2>Your inbox is yours.<br />Keep it that way.</h2>
          <p>One page. Structured requests. Private until approved. No spam, no exposure, no obligation to reply.</p>
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
