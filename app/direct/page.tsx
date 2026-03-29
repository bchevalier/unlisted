import React from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { DIRECT_PRESET_METADATA } from '../../features/direct/preset-metadata';
import { getKeeperSessionFromCookies } from '../../lib/keeper-auth';
import { DirectWalkthroughBanner } from './direct-walkthrough-banner';
import { LogoutButton } from './logout-button';

const VALUE_CARDS = [
  {
    icon: '🔒',
    title: 'Stop publishing your personal inbox',
    description: 'Share one Direct page while your private email and contact details stay hidden by default.',
  },
  {
    icon: '📋',
    title: 'Stop chasing missing details',
    description: 'Collect budget, brief, category, and timeline before a request can reach your inbox.',
  },
  {
    icon: '🚫',
    title: 'Stop low-signal noise from becoming work',
    description: 'Use caps, routing, and auto-replies so low-quality inbound never turns into manual triage.',
  },
] as const;

const HOW_IT_WORKS = [
  {
    icon: '🔗',
    title: 'Share one public Direct page',
    description: 'Use one public intake page instead of exposing your inbox, DMs, or personal email.',
  },
  {
    icon: '✏️',
    title: 'Ask for the right details upfront',
    description: 'Require the information you need before you spend time reading or replying.',
  },
  {
    icon: '⚡',
    title: 'Let Direct filter what reaches you',
    description: 'Qualified requests go through. Low-signal inbound gets capped, auto-replied to, routed, or ignored.',
  },
] as const;

const BEFORE_AFTER = {
  without: [
    'Your email or DMs are exposed',
    'Requests arrive with missing context',
    'You have to ask basic questions manually',
    'Low-signal inbound mixes with real opportunities',
  ],
  with: [
    'Your real inbox stays private',
    'Requesters choose a category',
    'Budget, brief, and timeline are collected upfront',
    'Incomplete or low-signal requests are filtered before they reach you',
  ],
} as const;

const WHO_FOR = [
  {
    icon: '🎨',
    title: 'Creators and public-facing professionals',
    description:
      'Get brand deals and collaboration asks without exposing your private inbox or letting low-quality DMs consume your week.',
  },
  {
    icon: '💼',
    title: 'Advisors, consultants, and operators',
    description:
      'Stop chasing missing details manually. Collect scope, budget, and timeline before requests earn your attention.',
  },
  {
    icon: '👥',
    title: 'Teams handling constant outreach',
    description:
      'Keep your team reachable while filtering low-signal requests before they become operational noise.',
  },
] as const;

const REQUESTER_FIELDS = ['Request type', 'Short brief', 'Budget', 'Timeline', 'Relevant links'] as const;
const KEEPER_OUTCOMES = [
  'accepted into inbox',
  'auto-replied for missing info',
  'capped or ignored if low-signal',
  'routed based on request type',
] as const;

const HERO_TRUST_POINTS = ['No credit card to start', 'Keep your existing inbox', 'Turn Direct off anytime'] as const;

const HERO_PREVIEW_FLOW = [
  {
    title: 'A request starts at your Direct page',
    detail: 'People use one structured intake page instead of random DMs or open email threads.',
  },
  {
    title: 'Direct collects required context',
    detail: 'Budget, brief, category, and timeline are captured before your inbox review starts.',
  },
  {
    title: 'Only qualified inbound reaches your inbox',
    detail: 'Everything else can be capped, routed, auto-replied, or ignored using your rules.',
  },
] as const;

const FIT_SIGNALS = [
  'You get too many vague “quick question” emails or DMs.',
  'You repeatedly ask for basics like budget, timeline, or scope.',
  'You want to stay reachable without exposing private contact details.',
] as const;

const FIT_OUTCOMES = [
  'One public intake page replaces scattered contact points.',
  'Requesters provide structure before they can take your time.',
  'You decide what gets accepted, auto-replied, routed, capped, or ignored.',
] as const;

const START_HERE_STEPS = [
  {
    title: 'Explore the live inbox demo',
    detail: 'See real examples of accepted, auto-replied, and ignored inbound.',
    timing: '2 min',
    signedOutHref: '/direct/inbox?slug=john&fixture=demo',
    signedInHref: '/direct/inbox?slug=john&fixture=demo',
    signedOutLabel: 'Explore demo inbox',
    signedInLabel: 'Explore demo inbox',
  },
  {
    title: 'Launch your Direct page',
    detail: 'Create one public intake page instead of sharing personal email and DMs.',
    timing: '3 min',
    signedOutHref: '/direct/signup',
    signedInHref: '/direct/settings?slug=john&fixture=demo',
    signedOutLabel: 'Create my free Direct page',
    signedInLabel: 'Open page settings',
  },
  {
    title: 'Set your inbox rules',
    detail: 'Define categories, required fields, limits, and outcomes before requests reach you.',
    timing: '5 min',
    signedOutHref: '/direct/signup',
    signedInHref: '/direct/settings?slug=john&fixture=demo',
    signedOutLabel: 'Start with a preset',
    signedInLabel: 'Tune my rules',
  },
] as const;

const CONTACT_FORM_DIFF = [
  {
    title: 'Intake quality',
    contactForm: 'Anyone can send unstructured messages that become manual follow-up work.',
    direct: 'Requesters must provide the context you require before inbox review starts.',
  },
  {
    title: 'Inbox exposure',
    contactForm: 'Your personal inbox or DMs are usually still exposed somewhere.',
    direct: 'You share one public Direct page while private contact details stay hidden by default.',
  },
  {
    title: 'Outcomes',
    contactForm: 'Every message feels like a conversation you now need to manage.',
    direct: 'You can accept, auto-reply for missing info, route, cap, or ignore low-signal inbound.',
  },
] as const;

const PLAN_FEATURES = {
  free: ['Public Direct page', 'Structured request intake', 'Basic caps and filtering', 'Manual inbox review'],
  paid: ['Higher inbound volume limits', 'Priority and paid request lanes', 'Advanced routing + automation', 'Workflow-friendly controls for heavy inbound'],
} as const;

const FAQ = [
  {
    question: 'Will people still be able to reach me easily?',
    answer: 'Yes. Direct keeps you reachable, but turns random inbound into structured requests.',
  },
  {
    question: 'Do I have to reply to every request?',
    answer: 'No. Direct helps you filter, cap, route, and ignore requests that are not worth your time.',
  },
  {
    question: 'Is this just another contact form?',
    answer:
      'No. A contact form collects messages. Direct adds rule-based filtering, required context, and outcome control before requests ever hit your private inbox.',
  },
] as const;

const DEMO_HUMAN_LABELS: Record<string, string> = {
  CREATOR: 'Creators getting brand deals and collabs',
  ADVISOR: 'Advisors handling consulting and speaking inbound',
  PUBLIC_FACING: 'Public-facing operators handling media and business requests',
};

export default async function DirectClientPage() {
  const session = await getKeeperSessionFromCookies();

  return (
    <main className="lane-page lane-page-direct direct-page">
      <header className="home-topbar direct-topbar">
        <Link href="/" className="home-topbar-brand direct-topbar-brand">
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
          <span className="direct-topbar-separator" aria-hidden="true">
            /
          </span>
          <span className="direct-topbar-context">Direct</span>
        </Link>

        <nav className="home-topbar-actions" aria-label="Direct actions">
          {session ? (
            <>
              <span className="direct-topbar-session">{session.email}</span>
              <div className="direct-topbar-logout">
                <LogoutButton />
              </div>
            </>
          ) : (
            <>
              <Link className="topbar-link" href="/direct/login">
                Log in
              </Link>
              <Link className="topbar-button" href="/direct/signup">
                Create account
              </Link>
            </>
          )}
        </nav>
      </header>

      <div className="direct-main-shell">
        <section className="lane-hero-panel direct-hero-panel" aria-label="Knokio Direct overview">
          <div className="direct-hero-bg" aria-hidden="true">
            <div className="home-hero-grid direct-hero-grid" />
            <div className="hero-gradient-rainbow direct-hero-gradient" />
          </div>

          <div className="direct-hero-layout">
            <div className="direct-hero-content">
              <p className="hero-word">KNOKIO DIRECT</p>
              <h1 className="hero-title direct-hero-title">
                A public contact page that filters inbound before it hits your real inbox.
              </h1>
              <p className="hero-subtitle direct-hero-subtitle">
                Direct turns random emails and DMs into structured requests you can accept, route, auto-reply, or
                ignore.
              </p>
              <p className="direct-hero-anchor">
                Built for creators, advisors, and operators handling constant inbound.
              </p>
              <p className="direct-hero-concrete-line">
                You stay reachable. Your private channels stay private until you choose otherwise.
              </p>

              <div className="lane-action-row direct-hero-actions">
                {session ? (
                  <Link className="button primary direct-hero-button" href="/direct/settings?slug=john&fixture=demo">
                    Protect inbox in settings
                  </Link>
                ) : (
                  <Link className="button primary direct-hero-button" href="/direct/signup">
                    Create my free Direct page
                  </Link>
                )}
              </div>
              <p className="direct-hero-action-note">No credit card needed. Launch your page in minutes.</p>
              <p className="direct-hero-secondary-link">
                <Link href="/direct/inbox?slug=john&fixture=demo">Explore demo inbox first →</Link>
              </p>

              <p className="hero-meta direct-hero-meta">Setup in minutes · Keep your existing inbox · Turn Direct off anytime</p>
              <ul className="direct-hero-trust-list" aria-label="Direct signup reassurance">
                {HERO_TRUST_POINTS.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </div>

            <aside className="direct-hero-preview" aria-label="Direct filtering preview">
              <p className="direct-hero-preview-label">Live workflow preview</p>
              <h2>See how Direct qualifies a request before it ever hits your private inbox.</h2>
              <div className="direct-hero-preview-stack">
                {HERO_PREVIEW_FLOW.map((step, index) => (
                  <article key={step.title} className="direct-hero-preview-card">
                    <span className="direct-hero-preview-step">0{index + 1}</span>
                    <div>
                      <h3>{step.title}</h3>
                      <p>{step.detail}</p>
                    </div>
                  </article>
                ))}
              </div>
              <p className="direct-hero-preview-note">
                Launch with a preset, then tune categories and limits in settings.
              </p>
              <p className="direct-hero-preview-link">
                <Link href="/direct/inbox?slug=john&fixture=demo">Explore demo inbox →</Link>
              </p>
            </aside>
          </div>
        </section>

        <section className="direct-proof-strip" aria-label="Direct value proof">
          {VALUE_CARDS.map((item) => (
            <article key={item.title} className="direct-proof-card">
              <span className="direct-proof-icon" aria-hidden="true">{item.icon}</span>
              <p className="direct-proof-title">{item.title}</p>
              <p className="direct-proof-copy">{item.description}</p>
            </article>
          ))}
        </section>

        <div className="direct-social-proof-strip" aria-label="Early traction">
          <div className="direct-social-proof-note">Live and accepting requests</div>
          <span className="direct-social-proof-divider" aria-hidden="true" />
          <span className="direct-social-proof-note">Built for creators, advisors, and operators</span>
          <span className="direct-social-proof-divider" aria-hidden="true" />
          <span className="direct-social-proof-note">Free to start — no credit card</span>
        </div>

        <section className="lane-panel direct-diff-panel direct-section-accent" aria-label="How Direct differs from a contact form">
          <div className="direct-panel-intro">
            <p className="lane-kicker">Not just another contact form</p>
            <h2>Direct is an inbound control layer, not a passive message box.</h2>
          </div>
          <div className="direct-diff-grid">
            {CONTACT_FORM_DIFF.map((item) => (
              <article key={item.title} className="direct-diff-card">
                <h3>{item.title}</h3>
                <p>
                  <strong>Typical contact form:</strong> {item.contactForm}
                </p>
                <p>
                  <strong>With Direct:</strong> {item.direct}
                </p>
              </article>
            ))}
          </div>
        </section>

        <section className="lane-panel direct-fit-panel" aria-label="Who Direct is a fit for">
          <div className="direct-panel-intro">
            <p className="lane-kicker">Quick fit check</p>
            <h2>Direct is for people who need inbound control, not more inbox volume.</h2>
          </div>
          <div className="direct-fit-grid">
            <article className="direct-fit-card">
              <p className="direct-fit-label">If this sounds like you</p>
              <ul>
                {FIT_SIGNALS.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </article>
            <article className="direct-fit-card direct-fit-card-outcomes">
              <p className="direct-fit-label">What changes with Direct</p>
              <ul>
                {FIT_OUTCOMES.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </article>
          </div>
        </section>

        <section className="lane-panel direct-start-here-panel" aria-label="First-time Direct setup path">
          <div className="direct-panel-intro">
            <p className="lane-kicker">Start here (first 10 minutes)</p>
            <h2>Use this quick path to understand Direct before you commit.</h2>
            <p>See the workflow live, launch your page, then tune inbox rules.</p>
          </div>
          <div className="direct-start-here-grid">
            {START_HERE_STEPS.map((step, index) => {
              const href = session ? step.signedInHref : step.signedOutHref;
              const label = session ? step.signedInLabel : step.signedOutLabel;

              return (
                <article key={step.title} className="direct-start-here-card">
                  <div className="direct-start-here-head">
                    <span className="direct-start-here-step">0{index + 1}</span>
                    <span className="direct-start-here-timing">{step.timing}</span>
                  </div>
                  <h3>{step.title}</h3>
                  <p>{step.detail}</p>
                  <Link className="direct-start-here-link" href={href}>
                    {label} →
                  </Link>
                </article>
              );
            })}
          </div>
        </section>

        <section className="lane-panel direct-steps-panel direct-section-tinted" aria-label="How Direct works">
          <div className="direct-steps-intro">
            <p className="lane-kicker">How Direct works</p>
            <h2>Three steps from public contact to a cleaner inbox.</h2>
          </div>
          <div className="direct-steps-grid">
            {HOW_IT_WORKS.map((step, index) => (
              <article key={step.title} className="direct-step-card">
                <div className="direct-step-head">
                  <span className="direct-step-number">0{index + 1}</span>
                  <span className="direct-step-icon" aria-hidden="true">{step.icon}</span>
                </div>
                <h3>{step.title}</h3>
                <p>{step.description}</p>
              </article>
            ))}
          </div>
        </section>

        <div className="direct-inline-cta" aria-label="Mid-page call to action">
          <p>See the workflow live before you commit, then launch your page in minutes.</p>
          <div className="direct-inline-cta-actions">
            {session ? (
              <Link className="button primary" href="/direct/settings?slug=john&fixture=demo">
                Open page settings
              </Link>
            ) : (
              <Link className="button primary" href="/direct/signup">
                Create my free Direct page
              </Link>
            )}
            <Link className="button secondary" href="/direct/inbox?slug=john&fixture=demo">
              Explore demo inbox
            </Link>
          </div>
        </div>

        <section className="lane-panel direct-before-after" aria-label="Direct before and after comparison">
          <div className="direct-before-after-intro">
            <p className="lane-kicker">From public contact to a cleaner inbox</p>
            <h2>What changes when Direct stands in front of your private channels.</h2>
          </div>

          <div className="direct-before-after-grid">
            <article className="direct-compare-card direct-compare-card-before">
              <p className="direct-compare-label">⚠️ Without Direct</p>
              <ul>
                {BEFORE_AFTER.without.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </article>

            <article className="direct-compare-card direct-compare-card-after">
              <p className="direct-compare-label">✅ With Direct</p>
              <ul>
                {BEFORE_AFTER.with.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </article>
          </div>
        </section>

        <section className="lane-panel direct-audience-panel direct-section-tinted" aria-label="Who Direct is for">
          <div className="direct-panel-intro">
            <p className="lane-kicker">Who Direct is for</p>
            <h2>Designed for people who need to stay reachable without becoming exposed.</h2>
          </div>
          <div className="direct-audience-grid">
            {WHO_FOR.map((item) => (
              <article key={item.title} className="direct-audience-card">
                <span className="direct-audience-icon" aria-hidden="true">{item.icon}</span>
                <h3>{item.title}</h3>
                <p>{item.description}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="lane-panel direct-example-panel direct-section-tinted" aria-label="Direct request example">
          <div className="direct-panel-intro">
            <p className="lane-kicker">Simple example</p>
            <h2>What requesters see, and what finally reaches you.</h2>
          </div>
          <div className="direct-example-grid">
            <article className="direct-example-card">
              <h3>What requesters see</h3>
              <p>A requester fills out a structured form like:</p>
              <ul>
                {REQUESTER_FIELDS.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </article>

            <article className="direct-example-card">
              <h3>What reaches you</h3>
              <p>Only the requests that meet your rules:</p>
              <ul>
                {KEEPER_OUTCOMES.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </article>
          </div>
        </section>

        <section className="lane-panel direct-faq-panel" aria-label="Common first-time Direct questions">
          <div className="direct-faq-intro">
            <p className="lane-kicker">Common questions</p>
            <h2>Objections answered before you commit.</h2>
          </div>

          <div className="direct-faq-grid">
            {FAQ.map((item) => (
              <article key={item.question} className="direct-faq-card">
                <h3>{item.question}</h3>
                <p>{item.answer}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="lane-panel direct-pricing-panel" aria-label="Direct pricing overview">
          <div className="direct-panel-intro">
            <p className="lane-kicker">Plans at a glance</p>
            <h2>Start with free inbox protection, then upgrade once volume or routing needs increase.</h2>
          </div>
          <div className="direct-pricing-grid">
            <article className="direct-pricing-card direct-pricing-card-free">
              <p className="direct-compare-label">Free plan</p>
              <p className="direct-pricing-amount">$0<span>/forever</span></p>
              <h3>Launch a Direct page and protect your baseline inbound.</h3>
              <p>Best when you want immediate control without changing your current workflow.</p>
              <ul className="direct-pricing-list">
                {PLAN_FEATURES.free.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
              {!session && (
                <Link className="button secondary direct-pricing-cta" href="/direct/signup">
                  Start free
                </Link>
              )}
            </article>
            <article className="direct-pricing-card direct-pricing-card-paid direct-pricing-card-recommended">
              <div className="direct-pricing-card-head">
                <p className="direct-compare-label">Paid plan</p>
                <span className="direct-pricing-pill">Recommended</span>
              </div>
              <p className="direct-pricing-amount">Custom<span> pricing</span></p>
              <h3>Scale Direct with higher limits, automation, and protected paid lanes.</h3>
              <p>Best for operators handling frequent, commercial, or high-stakes requests.</p>
              <ul className="direct-pricing-list">
                {PLAN_FEATURES.paid.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
              <Link className="button primary direct-pricing-cta" href="/direct/settings?slug=john&fixture=demo">
                Compare plans
              </Link>
            </article>
          </div>
          <div className="direct-pricing-actions">
            <Link className="button secondary" href="/direct/settings?slug=john&fixture=demo">
              Compare plans in settings
            </Link>
          </div>
        </section>

        <section className="lane-panel direct-final-cta direct-section-accent" aria-label="Direct final call to action">
          <div className="direct-panel-intro">
            <p className="lane-kicker">Ready to take control?</p>
            <h2>Keep your inbox private. Stay reachable for real opportunities.</h2>
            <p>
              Start with one public Direct page, gather context upfront, and choose which requests deserve your time.
            </p>
          </div>
          <div className="direct-faq-actions">
            {session ? (
              <>
                <Link className="button primary direct-hero-button" href="/direct/settings?slug=john&fixture=demo">
                  Protect inbox in settings
                </Link>
                <Link className="button secondary" href="/direct/inbox?slug=john&fixture=demo">
                  Explore demo inbox
                </Link>
              </>
            ) : (
              <>
                <Link className="button primary direct-hero-button" href="/direct/signup">
                  Create my free Direct page →
                </Link>
                <Link className="button secondary" href="/direct/inbox?slug=john&fixture=demo">
                  Explore demo inbox
                </Link>
              </>
            )}
          </div>
        </section>

        <section className="lane-panel direct-footer-note" aria-label="How Knokio works for Direct">
          <div className="direct-panel-intro">
            <p className="lane-kicker">How Knokio works</p>
            <p>
              Knokio is an access layer. Direct protects inbound before it reaches your inbox, DMs, or personal email.
              Private contact details stay hidden unless you choose otherwise.
            </p>
          </div>
        </section>

        <details className="lane-panel direct-demo-disclosure">
          <summary>Explore live demo</summary>
          <div className="direct-demo-disclosure-body">
            <DirectWalkthroughBanner currentStep={session ? 'inbox' : 'signup'} />
            <div className="inbox-links direct-support-links">
              <Link href="/u/john">Door preview</Link>
              <Link href="/direct/inbox?slug=john&fixture=demo">Inbox</Link>
              <Link href="/direct/settings?slug=john&fixture=demo">Settings</Link>
            </div>
            {session ? (
              <p className="direct-support-note">
                Signed in as <strong>{session.email}</strong>
              </p>
            ) : null}
          </div>
        </details>

        <details className="lane-panel direct-demo-disclosure">
          <summary>See demo configuration</summary>
          <div className="direct-demo-disclosure-body">
            <div className="direct-system-intro">
              <p className="lane-kicker">Demo configuration</p>
              <h2>Detailed setup examples for creators, advisors, and public-facing professionals.</h2>
              <p>
                This is the deeper product-demo layer: presets, categories, required context, and example outcomes.
              </p>
            </div>

            <div className="direct-system-preset-row">
              {DIRECT_PRESET_METADATA.map((preset) => (
                <article key={preset.value} className="direct-system-preset-card">
                  <p className="direct-system-card-label">Preset example</p>
                  <h3>{DEMO_HUMAN_LABELS[preset.value]}</h3>
                  <p>{preset.copy}</p>
                  <div className="direct-chip-row">
                    {preset.categories.map((category) => (
                      <span key={category}>{category}</span>
                    ))}
                  </div>
                </article>
              ))}
            </div>

            <div className="direct-system-grid">
              <article className="direct-system-card direct-system-card-preview">
                <div className="direct-system-card-head">
                  <span className="direct-system-card-label">What requesters see</span>
                  <span className="direct-system-plan-pill direct-system-plan-pill-magenta">Structured intake</span>
                </div>
                <h3>Example requester form</h3>
                <div className="direct-preview-box">
                  <p className="direct-preview-title">Brand / Product Placement</p>
                  <p className="direct-preview-copy">Brand, campaign brief, budget, timeline, landing page</p>
                  <p className="direct-preview-meta">Direct asks for the signal you need before a request can earn inbox space.</p>
                </div>
              </article>

              <article className="direct-system-card direct-system-card-preview">
                <div className="direct-system-card-head">
                  <span className="direct-system-card-label">What reaches you</span>
                  <span className="direct-system-plan-pill">Outcome</span>
                </div>
                <h3>Example keeper outcomes</h3>
                <div className="direct-inbox-mini">
                  <div>
                    <strong>Accepted into inbox</strong>
                    <span>Verified org · Budget included · Complete brief</span>
                  </div>
                  <div>
                    <strong>Auto-replied</strong>
                    <span>Missing budget → ask for more detail first</span>
                  </div>
                  <div>
                    <strong>Ignored or capped</strong>
                    <span>Low-signal or overflow never turns into inbox clutter</span>
                  </div>
                </div>
              </article>
            </div>
          </div>
        </details>
      </div>
    </main>
  );
}
