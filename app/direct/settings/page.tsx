import React from 'react';
import Link from 'next/link';
import {
  DIRECT_DEMO_SLUG,
  getDirectDemoInboxFixture,
  isDirectDemoFixture,
} from '../../../features/direct/demo-fixtures';
import {
  listDoorsForKeeper,
  listRequestsByDoorSlugForKeeper
} from '../../../features/direct/server/requests';
import { getKeeperSecurityProfile } from '../../../features/direct/server/security';
import { requireKeeperSession } from '../../../features/direct/server/session';
import { DirectWalkthroughBanner } from '../direct-walkthrough-banner';
import { SettingsPanel } from './settings-panel';
import { TwoFactorPanel } from './two-factor-panel';

type DirectSettingsPageProps = {
  searchParams?: Promise<{
    slug?: string;
    fixture?: string;
  }>;
};

export default async function DirectSettingsPage({ searchParams }: DirectSettingsPageProps) {
  const resolvedSearchParams = (await searchParams) ?? {};
  const useDemoFixture = isDirectDemoFixture(resolvedSearchParams.fixture);
  const session = useDemoFixture
    ? { userId: 'direct_demo_fixture', email: 'demo@knokio.example' }
    : await requireKeeperSession('/direct/settings');

  const doors = useDemoFixture ? [] : await listDoorsForKeeper(session.userId);
  const selectedSlug = resolvedSearchParams.slug ?? doors[0]?.slug ?? (useDemoFixture ? DIRECT_DEMO_SLUG : undefined);

  if (!selectedSlug) {
    return (
      <main className="direct-surface-shell direct-settings-shell">
        <section className="direct-surface-card direct-surface-card-header">
          <h1>Knokio Direct Settings</h1>
          <p>No door found for this account.</p>
        </section>
      </main>
    );
  }

  const [door, securityProfile] = await Promise.all([
    useDemoFixture
      ? Promise.resolve(getDirectDemoInboxFixture({ doorSlug: selectedSlug }))
      : listRequestsByDoorSlugForKeeper(session.userId, selectedSlug),
    getKeeperSecurityProfile(session.userId)
  ]);

  if (!door) {
    return (
      <main className="direct-surface-shell direct-settings-shell">
        <section className="direct-surface-card direct-surface-card-header">
          <h1>Knokio Direct Settings</h1>
          <p>Door not found or not owned by this account.</p>
        </section>
      </main>
    );
  }

  const doorLinks = useDemoFixture && !doors.some((item) => item.slug === door.slug)
    ? [{ slug: door.slug, displayName: `${door.displayName} demo`, plan: door.plan }, ...doors]
    : doors;

  return (
    <main className="direct-surface-shell direct-settings-shell">
      <section className="direct-surface-card direct-surface-card-header">
        <p className="direct-surface-eyebrow">Knokio Direct</p>
        <h1>Settings</h1>
        <p>
          Signed in as <strong>{session.email}</strong>
        </p>
        <p>
          This is where you define how Direct protects your inbox: what gets through, what needs more detail, and what
          stays outside your private contact surface.
        </p>
      </section>
      <DirectWalkthroughBanner currentStep="settings" doorSlug={door.slug} useDemoFixture={useDemoFixture} />

      <section className="direct-surface-card direct-surface-card-toolbar">
        <p className="inbox-links">
          {doorLinks.map((item) => (
            <Link
              key={item.slug}
              href={`/direct/settings?slug=${item.slug}${useDemoFixture ? '&fixture=demo' : ''}`}
            >
              {item.displayName} ({item.plan})
            </Link>
          ))}
        </p>
        <p>
          Active door plan: <strong>{door.plan}</strong>
        </p>
        <p className="inbox-links">
          <Link href={`/direct/inbox?slug=${door.slug}${useDemoFixture ? '&fixture=demo' : ''}`}>Inbox</Link>
          <Link href={`/u/${door.slug}`} target="_blank">
            Open public door
          </Link>
        </p>
      </section>

      {securityProfile ? (
        <TwoFactorPanel
          email={securityProfile.email}
          emailVerified={Boolean(securityProfile.emailVerifiedAt)}
          twoFactorEnabled={securityProfile.twoFactorEnabled}
        />
      ) : null}

      <SettingsPanel
        door={{
          slug: door.slug,
          displayName: door.displayName,
          plan: door.plan,
          settings: door.settings,
          categories: door.categories,
          emailAliases: door.emailAliases ?? []
        }}
      />
    </main>
  );
}
