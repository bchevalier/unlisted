import Link from 'next/link';
import {
  listDoorsForKeeper,
  listRequestsByDoorSlugForKeeper
} from '../../../features/direct/server/requests';
import { getKeeperSecurityProfile } from '../../../features/direct/server/security';
import { requireKeeperSession } from '../../../features/direct/server/session';
import { SettingsPanel } from './settings-panel';
import { TwoFactorPanel } from './two-factor-panel';

type DirectSettingsPageProps = {
  searchParams?: Promise<{
    slug?: string;
  }>;
};

export default async function DirectSettingsPage({ searchParams }: DirectSettingsPageProps) {
  const session = await requireKeeperSession('/direct/settings');
  const resolvedSearchParams = (await searchParams) ?? {};

  const doors = await listDoorsForKeeper(session.userId);
  const selectedSlug = resolvedSearchParams.slug ?? doors[0]?.slug;

  if (!selectedSlug) {
    return (
      <main>
        <h1>Knokio Direct Settings</h1>
        <p>No door found for this account.</p>
      </main>
    );
  }

  const [door, securityProfile] = await Promise.all([
    listRequestsByDoorSlugForKeeper(session.userId, selectedSlug),
    getKeeperSecurityProfile(session.userId)
  ]);

  if (!door) {
    return (
      <main>
        <h1>Knokio Direct Settings</h1>
        <p>Door not found or not owned by this account.</p>
      </main>
    );
  }

  return (
    <main>
      <h1>Knokio Direct Settings</h1>
      <p>
        Signed in as <strong>{session.email}</strong>
      </p>
      <p className="inbox-links">
        {doors.map((item) => (
          <Link key={item.slug} href={`/direct/settings?slug=${item.slug}`}>
            {item.displayName} ({item.plan})
          </Link>
        ))}
      </p>
      <p>
        Active door plan: <strong>{door.plan}</strong>
      </p>
      <p className="inbox-links">
        <Link href={`/direct/inbox?slug=${door.slug}`}>Inbox</Link>
        <Link href={`/u/${door.slug}`} target="_blank">
          Open public door
        </Link>
      </p>

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
          categories: door.categories
        }}
      />
    </main>
  );
}
