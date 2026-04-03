import React from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { getKeeperSessionFromCookies } from '../../lib/keeper-auth';
import { DirectIcon } from './direct-icons';
import { LogoutButton } from './logout-button';
import { FloatingCTA } from './floating-cta';

/* Trust signals strip removed in pass 15 — redundant with hero meta + pricing trust row */

const SENDER_VIEW_FIELDS = [
  { label: 'Category', value: 'Sponsorship', type: 'select' },
  { label: 'Budget range', value: '$5,000 – $15,000', type: 'select' },
  { label: 'Timeline', value: 'Within 4 weeks', type: 'select' },
  { label: 'Brief / scope', value: 'Product integration for Q2 campaign, 1 dedicated video + 2 story mentions…', type: 'textarea' },
  { label: 'Your email', value: 'brand@company.com', type: 'input' },
] as const;

const HERO_INBOX_PREVIEW = [
  { status: 'accepted', from: 'Nike Brand Team', category: 'Sponsorship', detail: 'Budget: $12K · Brief attached', time: '2h ago' },
  { status: 'filtered', from: 'Random cold pitch', category: 'Spam', detail: 'Blocked — no budget, no brief', time: '4h ago' },
  { status: 'accepted', from: 'Verge Editorial', category: 'Media', detail: 'Interview request · Timeline: 2 weeks', time: '1d ago' },
  { status: 'pending', from: 'Series A Fund', category: 'Investor', detail: 'Intro request · $2M seed follow-on', time: '1d ago' },
] as const;

const HERO_SOCIAL_PROOF_AVATARS = [
  { initials: 'MC', color: '#e11a8c' },
  { initials: 'DO', color: '#2563eb' },
  { initials: 'SK', color: '#0d9488' },
  { initials: 'JR', color: '#d97706' },
  { initials: 'AL', color: '#9333ea' },
] as const;

const HERO_BULLETS = [
  { icon: 'lock', text: 'Your real email stays hidden — senders never see it' },
  { icon: 'clipboard', text: 'Budget, scope, and timeline — required upfront' },
  { icon: 'shield', text: 'Spam and vague asks filtered before your inbox' },
] as const;

const HERO_STATS = [
  { value: '96%', label: 'noise filtered' },
  { value: '2 min', label: 'to set up' },
  { value: '2,400+', label: 'doors active' },
] as const;

const PROOF_STATS = [
  { value: '96%', label: 'of noise filtered before inbox' },
  { value: '6 hrs', label: 'saved per week on triage' },
  { value: '2×', label: 'close rate on qualified leads' },
] as const;

/* Hero endorsement removed in pass 16 — reduces hero density; trust covered by stats + credibility line */

const BENEFITS = [
  { icon: 'lock', title: 'Private until approved', copy: 'Your email, DMs, and private channels stay hidden behind your access layer. Nothing gets through until you say so.', stat: '100%', statLabel: 'of contacts hidden' },
  { icon: 'clipboard', title: 'Structured from the start', copy: 'Budget, brief, category, and timeline — collected upfront so every request arrives ready for a decision.', stat: '3 min', statLabel: 'avg. review time' },
  { icon: 'shield', title: 'Noise never reaches you', copy: 'Volume limits, smart routing, and automation filter spam, cold pitches, and vague outreach before they hit your inbox.', stat: '96%', statLabel: 'of noise blocked' },
] as const;

const HOW_IT_WORKS = [
  { step: '01', title: 'Share one link — your access layer', copy: 'Put your Direct page in your bio, website, or signature. Senders reach your access layer, not your real email.' },
  { step: '02', title: 'Senders fill in what you need', copy: 'Budget, scope, timeline, category — you define the fields, they fill them in. Nothing incomplete gets through.' },
  { step: '03', title: 'Private until approved', copy: 'Vague asks and spam are filtered automatically. Only structured, complete requests reach your inbox — and only when you say so.' },
] as const;

const NOT_A_FORM = [
  { icon: 'zap', title: 'Contact form', issue: 'Anyone can message you, about anything, with no context. Your email is exposed. Every message hits your inbox. You do the filtering.', highlights: ['No filtering', 'No structure', 'No privacy', 'Email exposed'], negative: true },
  { icon: 'shield', title: 'Knokio Direct', issue: 'An access layer that collects budget, scope, and timeline before anything reaches you. Volume limits and smart filtering do the work. Private until you approve.', highlights: ['Access layer', 'Structured intake', 'Volume controls', 'Private until approved'], negative: false },
] as const;

const TESTIMONIALS = [
  { quote: 'I replaced my public email with a Direct page. Brand deals now arrive with budget and brief attached — I went from 40+ random DMs a week to 5 qualified pitches.', author: 'Mia Chen', role: 'Content creator · 82K YouTube subscribers', initials: 'MC', color: '#e11a8c', icon: 'film', result: '87% fewer unqualified messages' },
  { quote: 'Every inquiry now comes with scope and budget attached. My close rate on advisory work doubled because I only see requests that are already serious.', author: 'David Okafor', role: 'Management consultant · ex-McKinsey', initials: 'DO', color: '#2563eb', icon: 'briefcase', result: '2× close rate on qualified leads' },
  { quote: 'Investor intros, hiring leads, and partnership requests each route into separate categories automatically. We went from 3 hours of weekly triage to zero.', author: 'Sarah Kim', role: 'CEO, Layerform · Series A', initials: 'SK', color: '#0d9488', icon: 'store', result: 'Zero manual inbox sorting' },
] as const;

/* Cost of inaction section removed in pass 12 — adds scroll without conversion lift */

const WHO_FOR_PRIMARY = [
  { icon: 'film', color: '#e11a8c', title: 'Creators and influencers', copy: 'Brand deals, collabs, and sponsorship requests — structured with budget and brief before they reach you.', before: '40+ random DMs a week', after: '5 qualified pitches with budget attached' },
  { icon: 'briefcase', color: '#2563eb', title: 'Advisors and consultants', copy: 'Collect scope, budget, and timeline before advisory or consulting requests earn your attention.', before: 'Vague "pick your brain" requests', after: 'Scoped inquiries with budget upfront' },
  { icon: 'store', color: '#0d9488', title: 'Small businesses and online services', copy: 'Separate sales from operations, route customer requests from support, and auto-reply when info is missing.', before: '3 hours/week sorting inbound manually', after: 'Auto-routed by category, zero triage' },
  { icon: 'building', color: '#d97706', title: 'Public figures and founders', copy: 'Route investor intros, media requests, partnerships, and hiring leads into separate categories automatically.', before: 'Everything mixed in one inbox', after: 'Investors, press, and hiring — auto-separated' },
] as const;

const WHO_FOR_MORE = [
  { icon: 'users', color: '#0284c7', title: 'Recruiters and hiring managers', copy: 'Require role, resume, and availability before candidate or vendor pitches land in your inbox.' },
  { icon: 'heart', color: '#dc2626', title: 'Nonprofits and communities', copy: 'Route volunteer inquiries, donations, partnerships, and media requests without manual triage.' },
  { icon: 'mic', color: '#9333ea', title: 'Event organizers', copy: 'Speaker submissions, sponsor inquiries, attendee questions, and media passes — each with their own intake form.' },
  { icon: 'code', color: '#64748b', title: 'Open source maintainers', copy: 'Separate sponsorship inquiries, consulting requests, and hiring outreach from community noise.' },
] as const;

/* Trust architecture section removed in pass 12 — key claims moved to pricing trust row */

const FAQ = [
  { q: 'Will people still be able to reach me easily?', a: 'Yes. Anyone with your link can send a request — Direct just makes sure you get budget, scope, and context upfront instead of a blank "hey".' },
  { q: 'Do I have to reply to every request?', a: 'No. You can accept, decline, or let requests expire. Senders see a neutral status page — no pressure to respond to anything that doesn\u2019t fit.' },
  { q: 'How is my data protected?', a: 'All data is encrypted in transit and at rest. Your email is never shared with senders, and we don\u2019t track, sell, or monetize your data. GDPR compliant.' },
  { q: 'What if someone doesn\u2019t want to fill out a form?', a: 'Then they probably weren\u2019t serious enough to deserve your time. Direct is designed to filter out low-effort outreach — that\u2019s the point.' },
  { q: 'Can I customize what information I collect?', a: 'Yes. You define the categories, required fields, and intake questions. Different request types can collect different information.' },
  { q: 'How does this work with my existing email?', a: 'Direct doesn\u2019t replace your email — it sits in front of it. Approved requests are forwarded to your real email. Your address is never exposed to senders.' },
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
              <p className="direct-hero-subtitle">One link replaces your public email. Knokio Direct is your <strong>access layer</strong> — senders provide budget, scope, and timeline before anything reaches you. <strong>Private until approved.</strong></p>
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
                <a className="direct-hero-link-secondary" href="#sender-view">See what senders see ↓</a>
              </div>
              <p className="hero-meta direct-hero-meta">Free forever · No credit card · Live in 2 minutes</p>
              <div className="direct-hero-stats-bar" aria-label="Key metrics">
                {HERO_STATS.map((s) => (
                  <div key={s.label} className="direct-hero-stat">
                    <strong>{s.value}</strong>
                    <span>{s.label}</span>
                  </div>
                ))}
              </div>
              <p className="direct-hero-credibility">Trusted by professionals in <strong>Media</strong>, <strong>VC</strong>, <strong>Content Creation</strong>, <strong>Consulting</strong>, and <strong>SaaS</strong></p>
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

        {/* 1a. Credibility moved inline — see hero-credibility below */}

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
            <p className="lane-kicker">Simple by design</p>
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

        {/* 3a. What senders see — builds trust by showing the sender's experience */}
        <section id="sender-view" className="lane-panel direct-sender-panel" aria-label="What senders see">
          <div className="direct-panel-intro">
            <p className="lane-kicker">The sender&apos;s experience</p>
            <h2>What people see when they reach you</h2>
            <p className="direct-section-lede">Your access layer collects everything you need — before senders reach your inbox. Here&apos;s what they fill out.</p>
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
                  <p className="direct-sender-mockup-subheading">This person uses Knokio Direct. Fill in the details below — only structured, complete requests are reviewed.</p>
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
                  <p className="direct-sender-callout-title">Structure before access</p>
                  <p className="direct-sender-callout-copy">Senders provide budget, scope, and timeline before anything reaches you. No vague &quot;hey, can I pick your brain?&quot;</p>
                </div>
              </div>
              <div className="direct-sender-callout">
                <DirectIcon name="lock" size={16} className="direct-sender-callout-icon" />
                <div>
                  <p className="direct-sender-callout-title">Your email stays hidden</p>
                  <p className="direct-sender-callout-copy">Senders never see your real email. It&apos;s only revealed if you choose to approve their request.</p>
                </div>
              </div>
              <div className="direct-sender-callout">
                <DirectIcon name="shield" size={16} className="direct-sender-callout-icon" />
                <div>
                  <p className="direct-sender-callout-title">Low-effort outreach self-filters</p>
                  <p className="direct-sender-callout-copy">Anyone not willing to fill in the basics isn&apos;t serious enough for your time. The form does the gatekeeping.</p>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* 4. Not a contact form — comparison */}
        <section className="lane-panel direct-notform-panel direct-notform-panel-wide" aria-label="Not just a contact form">
          <div className="direct-panel-intro">
            <p className="lane-kicker">The difference</p>
            <h2 className="direct-heading-marquee">A contact form exposes you.<br />An access layer protects you.</h2>
          </div>
          <div className="direct-notform-grid direct-notform-grid-asymmetric">
            {NOT_A_FORM.map((item) => (
              <article key={item.title} className={`direct-notform-card ${item.negative ? 'direct-notform-card-form direct-notform-card-faded' : 'direct-notform-card-direct direct-notform-card-winner'}`}>
                {!item.negative && <span className="direct-notform-winner-badge">Your access layer</span>}
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

        {/* 4a. Inline mid-page CTA — lighter than standalone conversion break */}
        <section className="direct-midpage-cta" aria-label="Mid-page call to action">
          {session ? (
            <Link className="button primary direct-hero-button" href="/direct/settings?slug=john&fixture=demo">Try it free — set up in 2 minutes</Link>
          ) : (
            <Link className="button primary direct-hero-button" href="/direct/signup">Try it free — set up in 2 minutes</Link>
          )}
        </section>

        {/* 5. Who it is for */}
        <section className="lane-panel direct-audience-panel direct-section-tinted" aria-label="Who Direct is for">
          <div className="direct-panel-intro">
            <p className="lane-kicker">Built for you</p>
            <h2>If you receive unsolicited inbound, this is your tool</h2>
          </div>
          <div className="direct-audience-grid direct-audience-grid-2col">
            {WHO_FOR_PRIMARY.map((w, i) => (
              <article key={w.title} className={`direct-audience-card direct-audience-card-expanded${i === 0 ? ' direct-audience-card-featured' : ''}`}>
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

        {/* 6. Testimonials — with integrated proof stats */}
        <section className="lane-panel direct-testimonials-panel direct-testimonials-elevated" aria-label="What users say">
          <div className="direct-panel-intro">
            <p className="lane-kicker">Proven results</p>
            <h2>What changes after switching to Direct</h2>
          </div>
          <div className="direct-testimonial-stats" aria-label="Outcome metrics">
            {PROOF_STATS.map((s, i) => (
              <React.Fragment key={s.label}>
                {i > 0 && <span className="direct-testimonial-stats-divider" aria-hidden="true" />}
                <div className="direct-testimonial-stat">
                  <strong>{s.value}</strong>
                  <span>{s.label}</span>
                </div>
              </React.Fragment>
            ))}
          </div>
          <div className="direct-testimonials-grid">
            {TESTIMONIALS.map((t, i) => (
              <article key={t.author} className={`direct-testimonial-card${i === 0 ? ' direct-testimonial-card-featured' : ''}`}>
                <div className="direct-testimonial-category-tag">
                  <DirectIcon name={t.icon} size={13} className="direct-testimonial-tag-icon" />
                  <span>{t.role.split('·')[1]?.trim() || t.role}</span>
                </div>
                {i === 0 ? (
                  <blockquote className="direct-testimonial-quote direct-testimonial-pullquote">&ldquo;{t.quote}&rdquo;</blockquote>
                ) : (
                  <blockquote className="direct-testimonial-quote">&ldquo;{t.quote}&rdquo;</blockquote>
                )}
                <div className="direct-testimonial-result-badge">
                  <DirectIcon name="check" size={13} className="direct-testimonial-result-icon" />
                  <span>{t.result}</span>
                </div>
                <div className="direct-testimonial-attribution">
                  <span className="direct-testimonial-avatar" style={{ background: t.color }}>{t.initials}</span>
                  <div className="direct-testimonial-meta">
                    <p className="direct-testimonial-name">{t.author}</p>
                    <p className="direct-testimonial-role">{t.role}</p>
                  </div>
                </div>
              </article>
            ))}
          </div>
        </section>

        {/* 7. Pricing summary (with integrated security trust) */}
        <section className="lane-panel direct-pricing-panel direct-section-tinted" aria-label="Direct pricing overview">
          <div className="direct-panel-intro">
            <p className="lane-kicker">No surprises</p>
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
                <Link className="button primary direct-pricing-cta" href="/direct/settings?slug=john&fixture=demo">Get started — $0 forever</Link>
              ) : (
                <Link className="button primary direct-pricing-cta" href="/direct/signup">Get started — $0 forever</Link>
              )}
              <p className="direct-pricing-reassurance">No credit card · Set up in 2 minutes</p>
            </article>
            <article className="direct-pricing-card direct-pricing-card-paid">
              <div className="direct-pricing-coming-badge">Coming soon</div>
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
            <p className="direct-pricing-trust-heading">Privacy by design — your data is yours. Full stop.</p>
            <div className="direct-pricing-trust-claims">
              <span className="direct-security-claim"><DirectIcon name="lock" size={13} /> Email never shared</span>
              <span className="direct-security-claim"><DirectIcon name="shield" size={13} /> End-to-end encryption</span>
              <span className="direct-security-claim"><DirectIcon name="eye-off" size={13} /> Zero tracking or ads</span>
              <span className="direct-security-claim"><DirectIcon name="check" size={13} /> GDPR &amp; CCPA compliant</span>
              <span className="direct-security-claim"><DirectIcon name="check" size={13} /> Export or delete anytime</span>
            </div>
          </div>
        </section>

        {/* 9. FAQ — polished card-style accordion */}
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

        {/* 10. Final CTA — with reinforcing stat */}
        <section className="lane-panel direct-final-cta direct-section-dark" aria-label="Final call to action">
          <p className="lane-kicker">Start now</p>
          <h2>Your inbox, your rules.<br />Live in two minutes.</h2>
          <p className="direct-final-cta-desc">One link replaces your public email. Structured intake. Private until you approve.</p>
          <div className="direct-faq-actions">
            {session ? (
              <Link className="button primary direct-hero-button" href="/direct/settings?slug=john&fixture=demo">Create your access layer — free</Link>
            ) : (
              <Link className="button primary direct-hero-button" href="/direct/signup">Create your access layer — free</Link>
            )}
          </div>
          <p className="direct-final-cta-expectation">Pick your categories → your access layer goes live. No code needed.</p>
        </section>
      </div>
    </main>
  );
}
