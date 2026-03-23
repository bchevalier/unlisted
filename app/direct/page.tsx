import React from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { DIRECT_PRESET_METADATA, getDirectPresetMetadata } from '../../features/direct/preset-metadata';
import { getKeeperSessionFromCookies } from '../../lib/keeper-auth';
import { DirectWalkthroughBanner } from './direct-walkthrough-banner';
import { LogoutButton } from './logout-button';

export default async function DirectClientPage() {
  const session = await getKeeperSessionFromCookies();
  const creatorPreset = getDirectPresetMetadata('CREATOR');
  const advisorPreset = getDirectPresetMetadata('ADVISOR');
  const publicFacingPreset = getDirectPresetMetadata('PUBLIC_FACING');

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

          <div className="direct-hero-content">
            <p className="hero-word">KNOKIO DIRECT</p>
            <h1 className="hero-title direct-hero-title">Protect your inbox. Stay reachable for serious inbound.</h1>
            <p className="hero-subtitle direct-hero-subtitle">
              Built for creators, advisors, influencers, and other public-facing professionals who want brand outreach,
              advisory requests, and business inquiries to arrive with structure before they touch a private inbox.
            </p>

            <div className="lane-action-row direct-hero-actions">
              {session ? (
                <>
                  <Link className="button primary direct-hero-button" href="/direct/inbox?slug=john&fixture=demo">
                    Open demo inbox
                  </Link>
                  <Link className="button secondary direct-hero-button" href="/direct/settings?slug=john&fixture=demo">
                    Open demo settings
                  </Link>
                </>
              ) : (
                <>
                  <Link className="button primary direct-hero-button" href="/direct/signup">
                    Create account
                  </Link>
                  <Link className="button secondary direct-hero-button" href="/u/john">
                    View demo door
                  </Link>
                </>
              )}
            </div>

            <p className="hero-meta direct-hero-meta">Private by default · Structured inbound · High-intent access lanes</p>
          </div>
        </section>

        <DirectWalkthroughBanner currentStep={session ? 'inbox' : 'signup'} />

        <section className="lane-panel direct-system-showcase" aria-label="Direct system walkthrough">
          <div className="direct-system-intro">
            <p className="lane-kicker">Demo configuration</p>
            <h2>See the door, the rules, and the outcome in one place.</h2>
            <p>
              The fastest way to understand Knokio Direct is to see how one door is configured for {creatorPreset.label.toLowerCase()}, {advisorPreset.label.toLowerCase()}, and {publicFacingPreset.label.toLowerCase()} inbound: what the requester is asked, what the system automates, and what finally earns inbox space.
            </p>
          </div>

          <div className="direct-system-preset-row">
            {DIRECT_PRESET_METADATA.map((preset) => (
              <article key={preset.value} className="direct-system-preset-card">
                <p className="direct-system-card-label">Starting preset</p>
                <h3>{preset.label}</h3>
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
            <article className="direct-system-card">
              <div className="direct-system-card-head">
                <span className="direct-system-card-label">Door setup</span>
                <span className="direct-system-plan-pill">Free default</span>
              </div>
              <h3>{creatorPreset.label} preset</h3>
              <ul className="direct-config-list">
                <li><strong>Door:</strong> john.knokio / @john</li>
                <li><strong>Audience:</strong> {creatorPreset.copy}</li>
                <li><strong>Privacy:</strong> real inbox hidden</li>
                <li><strong>Form-type doors:</strong> 1 on Free, more on Paid</li>
              </ul>
              <div className="direct-chip-row">
                {creatorPreset.categories.map((category) => (
                  <span key={category}>{category}</span>
                ))}
              </div>
            </article>

            <article className="direct-system-card">
              <div className="direct-system-card-head">
                <span className="direct-system-card-label">System rules</span>
                <span className="direct-system-plan-pill direct-system-plan-pill-cyan">Core automation</span>
              </div>
              <h3>Categorize once, then automate</h3>
              <ul className="direct-config-list">
                <li><strong>Required fields:</strong> context, budget, brief, timeline</li>
                <li><strong>Caps:</strong> weekly door cap + category caps on Free</li>
                <li><strong>Routing:</strong> serious inbound to inbox, noise to auto-ignore</li>
                <li><strong>Auto-reply:</strong> request missing details before delivery across {advisorPreset.categories[0].toLowerCase()} and {publicFacingPreset.categories[0].toLowerCase()}</li>
              </ul>
            </article>

            <article className="direct-system-card direct-system-card-preview">
              <div className="direct-system-card-head">
                <span className="direct-system-card-label">Requester view</span>
                <span className="direct-system-plan-pill direct-system-plan-pill-magenta">Intent filter</span>
              </div>
              <h3>What they see</h3>
              <div className="direct-preview-box">
                <p className="direct-preview-title">{creatorPreset.categories[0]}</p>
                <p className="direct-preview-copy">Brand, campaign brief, budget, timeline, landing page</p>
                <p className="direct-preview-meta">{creatorPreset.launch[1]}. Paid lanes are optional: use them when a request should prove serious intent before it earns your time.</p>
              </div>
            </article>

            <article className="direct-system-card direct-system-card-preview">
              <div className="direct-system-card-head">
                <span className="direct-system-card-label">Keeper outcome</span>
                <span className="direct-system-plan-pill">Inbox result</span>
              </div>
              <h3>What finally reaches you</h3>
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
        </section>

        <section className="lane-grid direct-lane-grid">
          <article className="lane-panel direct-lane-panel">
            <h2>Knokio Direct</h2>
            <ul className="lane-list direct-feature-list">
              <li>
                <div>
                  <strong>A public door, not a public inbox.</strong>
                  <span>
                    Ideal for creators, advisors, and public-facing operators who need to stay reachable without
                    exposing a real inbox or private contact details.
                  </span>
                </div>
              </li>
              <li>
                <div>
                  <strong>Categorize once. Let Direct handle the flow.</strong>
                  <span>
                    Categories, required fields, caps, and abuse checks let Knokio reroute, auto-reply, auto-ignore,
                    or limit low-signal inbound before it reaches you.
                  </span>
                </div>
              </li>
              <li>
                <div>
                  <strong>Create a protected access lane for serious outreach.</strong>
                  <span>
                    Useful for product placement, advisory access, creator partnerships, and other inbound where a paid
                    request can act as an intent filter rather than a vanity paywall.
                  </span>
                </div>
              </li>
            </ul>
          </article>

          <article className="lane-panel direct-lane-panel">
            <h2>Plans at a glance</h2>
            <ul className="lane-list direct-feature-list direct-plan-list">
              <li>
                <div>
                  <strong>Free doors cover core control.</strong>
                  <span>
                    Use caps, routing, and silence as an answer to stay reachable without exposing private contact.
                  </span>
                </div>
              </li>
              <li>
                <div>
                  <strong>Paid plans open more capacity.</strong>
                  <span>
                    Add doors, remove inbound caps, and unlock more flexible rerouting for higher-volume or commercial
                    access.
                  </span>
                </div>
              </li>
              <li>
                <div>
                  <strong>Paid requests work as an intent filter.</strong>
                  <span>
                    Use them when you want serious outreach to pass through a protected access lane, not when you want
                    to put a vanity paywall on ordinary contact.
                  </span>
                </div>
              </li>
            </ul>
          </article>
        </section>

        <section className="direct-support-row" aria-label="Direct demo shortcuts">
          <p className="direct-support-label">Explore the demo</p>
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
        </section>
      </div>
    </main>
  );
}
