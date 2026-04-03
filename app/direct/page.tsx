import React from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { getKeeperSessionFromCookies } from '../../lib/keeper-auth';
import { DirectIcon } from './direct-icons';
import { LogoutButton } from './logout-button';
import { FloatingCTA } from './floating-cta';

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

const HERO_SOCIAL_PROOF_AVATARS = [
  { initials: 'MC', color: '#e11a8c' },
  { initials: 'DO', color: '#2563eb' },
  { initials: 'SK', color: '#0d9488' },
  { initials: 'JR', color: '#d97706' },
  { initials: 'AL', color: '#9333ea' },
] as const;

/* Featured quote moved inline into credibility strip — pass v2-12 */

const HERO_BULLETS = [
  { icon: 'lock', text: 'Your real email stays hidden — always' },
  { icon: 'clipboard', text: 'Budget, scope, and timeline collected upfront' },
  { icon: 'shield', text: 'Spam and low-effort asks blocked automatically' },
] as const;

const HERO_STATS = [
  { value: '96%', label: 'noise blocked' },
  { value: '< 2 min', label: 'setup time' },
  { value: '2,400+', label: 'active pages' },
] as const;

const PROOF_STATS = [
  { value: '96%', label: 'of noise blocked before inbox' },
  { value: '6 hrs/wk', label: 'saved on manual triage' },
  { value: '2×', label: 'close rate on inbound deals' },
] as const;

/* Hero endorsement removed in pass 16 — reduces hero density; trust covered by stats + credibility line */

const INDUSTRY_TRUST = [
  { label: 'Media & Publishing', icon: 'film' },
  { label: 'Venture Capital', icon: 'briefcase' },
  { label: 'Content Creation', icon: 'mic' },
  { label: 'SaaS & Startups', icon: 'code' },
  { label: 'Consulting', icon: 'users' },
] as const;

const BENEFITS = [
  { icon: 'lock', title: 'Private until approved', copy: 'Your email, DMs, and private channels stay hidden behind your access layer. No one reaches you until you approve them.', stat: '100%', statLabel: 'of contacts hidden' },
  { icon: 'clipboard', title: 'Structured from the start', copy: 'Budget, scope, category, and timeline — collected before anything reaches you. Every request arrives decision-ready.', stat: '< 3 min', statLabel: 'avg. review time' },
  { icon: 'shield', title: 'Noise never reaches you', copy: 'Volume limits, smart routing, and automation block spam, cold pitches, and half-baked asks before they touch your inbox.', stat: '96%', statLabel: 'of noise blocked' },
] as const;

const HOW_IT_WORKS = [
  { step: '01', title: 'Replace your public email with one link', copy: 'Put your Direct page in your bio, website, or signature. Senders reach your access layer — never your real email.' },
  { step: '02', title: 'Senders fill in what you require', copy: 'Budget, scope, timeline, category — you define the fields. Nothing vague or incomplete gets through.' },
  { step: '03', title: 'Review only what matters', copy: 'Spam and low-effort outreach are blocked automatically. You see structured, complete requests — and approve only the ones worth your time.' },
] as const;

const NOT_A_FORM = [
  { icon: 'zap', title: 'Contact form', issue: 'Anyone writes anything. Your real email is exposed. Every message — spam, cold pitch, vague ask — lands in your inbox. You do all the filtering.', highlights: ['No filtering', 'No structure', 'No privacy', 'Email exposed'], negative: true },
  { icon: 'shield', title: 'Knokio Direct', issue: 'An access layer that requires budget, scope, and timeline before anything reaches you. Volume limits and smart filtering handle the noise. Private until you approve.', highlights: ['Access layer', 'Structured intake', 'Volume controls', 'Private until approved'], negative: false },
] as const;

const TESTIMONIALS = [
  { quote: 'I replaced my public email with a Direct page. Brand deals now arrive with budget and brief attached — I went from 40+ random DMs a week to 5 qualified pitches with real money behind them.', author: 'Mia Chen', role: 'Content creator · 82K YouTube subscribers', initials: 'MC', color: '#e11a8c', icon: 'film', result: '87% fewer unqualified messages' },
  { quote: 'Every advisory inquiry now arrives with scope and budget attached. My close rate doubled because I only see requests that are already serious — no more back-and-forth qualification.', author: 'David Okafor', role: 'Management consultant · ex-McKinsey', initials: 'DO', color: '#2563eb', icon: 'briefcase', result: '2× close rate on inbound leads' },
  { quote: 'Investor intros, hiring leads, and partnership requests route into separate categories automatically. We went from 3 hours of weekly triage to zero — and closed our Series A faster because of it.', author: 'Sarah Kim', role: 'CEO, Layerform · Series A', initials: 'SK', color: '#0d9488', icon: 'store', result: 'Zero manual inbox sorting' },
] as const;

/* Cost of inaction section removed in pass 12 — adds scroll without conversion lift */

const WHO_FOR_PRIMARY = [
  { icon: 'film', color: '#e11a8c', title: 'Creators and influencers', copy: 'Brand deals, collabs, and sponsorship inquiries — structured with budget and brief before they reach your inbox.', before: '40+ random DMs a week', after: '5 qualified pitches with budget attached' },
  { icon: 'briefcase', color: '#2563eb', title: 'Advisors and consultants', copy: 'Require scope, budget, and timeline before any advisory or consulting request earns your attention.', before: 'Vague "pick your brain" requests', after: 'Scoped inquiries with budget upfront' },
  { icon: 'store', color: '#0d9488', title: 'Small businesses and online services', copy: 'Separate sales from operations, route customer requests from support, and stop replying to incomplete inquiries.', before: '3 hours/week sorting inbound manually', after: 'Auto-routed by category, zero triage' },
  { icon: 'building', color: '#d97706', title: 'Public figures and founders', copy: 'Route investor intros, media requests, partnerships, and hiring leads into separate categories — automatically.', before: 'Everything mixed in one inbox', after: 'Investors, press, and hiring — auto-separated' },
] as const;

const WHO_FOR_MORE = [
  { icon: 'users', color: '#0284c7', title: 'Recruiters and hiring managers', copy: 'Require role, resume, and availability before candidate or vendor pitches land in your inbox.' },
  { icon: 'heart', color: '#dc2626', title: 'Nonprofits and communities', copy: 'Route volunteer inquiries, donations, partnerships, and media requests without manual triage.' },
  { icon: 'mic', color: '#9333ea', title: 'Event organizers', copy: 'Speaker submissions, sponsor inquiries, attendee questions, and media passes — each with their own intake form.' },
  { icon: 'code', color: '#64748b', title: 'Open source maintainers', copy: 'Separate sponsorship inquiries, consulting requests, and hiring outreach from community noise.' },
] as const;

/* Trust architecture section removed in pass 12 — key claims moved to pricing trust row */

const FAQ = [
  { q: 'Will people still be able to reach me easily?', a: 'Yes. Anyone with your link can send a request — Direct just ensures you get budget, scope, and context upfront instead of a blank "hey, can we chat?"' },
  { q: 'Do I have to reply to every request?', a: 'No. You can accept, decline, or let requests expire automatically. Senders see a neutral status page — no pressure, no awkward silence.' },
  { q: 'How is my data protected?', a: 'All data is encrypted in transit and at rest. Your email is never shared with senders. We don\u2019t track, sell, or monetize your data. GDPR and CCPA compliant.' },
  { q: 'What if someone doesn\u2019t want to fill out the form?', a: 'Then they probably weren\u2019t serious enough to deserve your time. The form is the filter — that\u2019s the whole point.' },
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
              <p className="direct-hero-tagline">Private until approved</p>
              <h1 className="hero-title direct-hero-title">Stop letting strangers decide<br /><span className="direct-hero-title-highlight">what lands in your inbox.</span></h1>
              <p className="direct-hero-subtitle">One link replaces your public email. Knokio Direct is your <strong>access layer</strong> — senders provide budget, scope, and timeline before anything reaches you. <strong>Private until you approve.</strong></p>
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
              <div className="direct-hero-social-row">
                <div className="direct-hero-avatars" aria-hidden="true">
                  {HERO_SOCIAL_PROOF_AVATARS.map((a) => (
                    <span key={a.initials} className="direct-hero-avatar-dot" style={{ background: a.color }}>{a.initials}</span>
                  ))}
                </div>
                <p className="direct-hero-social-text">Join <strong>2,400+</strong> professionals protecting their inbox</p>
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

        {/* 1a. Industry trust bar — quick credibility scan after hero */}
        <section className="direct-industry-bar" aria-label="Trusted by professionals">
          <p className="direct-industry-bar-label">Trusted across industries</p>
          <div className="direct-industry-bar-items">
            {INDUSTRY_TRUST.map((item) => (
              <span key={item.label} className="direct-industry-bar-item">
                <DirectIcon name={item.icon} size={14} className="direct-industry-bar-icon" />
                <span>{item.label}</span>
              </span>
            ))}
          </div>
        </section>

        {/* 1b. Featured quote removed in pass v2-12 — redundant with testimonials + hero social proof */}

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

        {/* 3. How it works — immediately after benefits for comprehension */}
        <section id="how-it-works" className="lane-panel direct-steps-panel direct-section-dark" aria-label="How Direct works">
          <div className="direct-steps-intro">
            <p className="lane-kicker">Simple by design</p>
            <h2>Three steps to a protected inbox</h2>
            <p className="direct-section-lede">No code. No complex setup. You&apos;ll be filtering inbound in under two minutes.</p>
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
                  <p className="direct-sender-mockup-subheading">This person uses Knokio Direct as their access layer. Complete the fields below — only structured requests are reviewed.</p>
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
                  <p className="direct-sender-callout-copy">Budget, scope, and timeline are required before anything reaches you. No more &quot;hey, can I pick your brain?&quot;</p>
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
          <p className="direct-notform-verdict"><DirectIcon name="shield" size={15} className="direct-notform-verdict-icon" /> <strong>Knokio Direct isn&apos;t a better contact form — it&apos;s a different category entirely.</strong> Structure, filtering, and privacy that contact forms were never designed for.</p>
        </section>

        {/* 4a. Mid-page CTA — after comparison (high-conviction moment) + objection handling */}
        <section className="direct-midpage-cta" aria-label="Mid-page call to action">
          {session ? (
            <Link className="button primary direct-hero-button" href="/direct/settings?slug=john&fixture=demo">Create your access layer — free</Link>
          ) : (
            <Link className="button primary direct-hero-button" href="/direct/signup">Create your access layer — free</Link>
          )}
          <p className="direct-midpage-objection">Your existing email keeps working · No contacts lost · Revert anytime</p>
          <p className="direct-microproof">Join 2,400+ professionals who protect their inbox with Direct</p>
        </section>

        {/* 5. Who it is for — after explanation sections, self-identification */}
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
              <p className="direct-pricing-desc">Everything you need to protect your inbox and control who reaches you.</p>
              <ul className="direct-pricing-list">
                <li>Your public access layer — one link replaces your email</li>
                <li>Custom intake fields per category (budget, scope, timeline)</li>
                <li>Automatic spam filtering and volume controls</li>
                <li>Private until approved — your email never exposed to senders</li>
                <li>Approved requests forwarded to your real inbox</li>
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
            <p className="direct-pricing-trust-heading">Privacy by design — your data stays yours. Always.</p>
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
          <p className="direct-final-cta-desc">One link. Structured intake. Private until you approve. Join 2,400+ professionals already using Direct.</p>
          <div className="direct-faq-actions">
            {session ? (
              <Link className="button primary direct-hero-button" href="/direct/settings?slug=john&fixture=demo">Create your access layer — free</Link>
            ) : (
              <Link className="button primary direct-hero-button" href="/direct/signup">Create your access layer — free</Link>
            )}
          </div>
          <p className="direct-final-cta-expectation">Pick your categories → your access layer goes live → start filtering inbound. No code needed.</p>
        </section>

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
