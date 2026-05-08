import React from 'react';
import Link from 'next/link';
import { getDirectDemoPublicDoorFixture, isDirectDemoFixture } from '../../../features/direct/demo-fixtures';
import { getPublicDoorBySlug } from '../../../features/direct/server/door';
import { getTurnstileSiteKey } from '../../../lib/turnstile';
import { KnockForm } from './knock-form';

type DoorPageProps = {
  params: Promise<{
    slug: string;
  }>;
  searchParams?: Promise<{ fixture?: string }>;
};

export default async function DoorPage({ params, searchParams }: DoorPageProps) {
  const { slug } = await params;
  const resolvedSearchParams = (await searchParams) ?? {};
  const door = isDirectDemoFixture(resolvedSearchParams.fixture)
    ? getDirectDemoPublicDoorFixture(slug)
    : await getPublicDoorBySlug(slug);

  if (!door) {
    return (
      <main>
        <h1>Door unavailable</h1>
        <p>This door is invalid or currently disabled.</p>
      </main>
    );
  }

  const turnstileSiteKey = getTurnstileSiteKey();

  return (
    <main className="door-page direct-surface-shell">
      <header className="door-page__header direct-surface-card direct-surface-card-header">
        <p className="door-page__eyebrow direct-surface-eyebrow">Knokio Direct</p>
        <h1>{door.displayName}</h1>
        {door.headline ? <p>{door.headline}</p> : null}
        <p>
          Requests here are structured before they reach a private inbox. Contact details stay hidden unless the keeper
          chooses to reveal them later.
        </p>
      </header>

      <section className="door-page__body direct-surface-card">
        <KnockForm door={door} turnstileSiteKey={turnstileSiteKey} />
      </section>

      <footer className="door-page__footer direct-surface-card direct-surface-card-footer">
        <p>
          Private by default. Reachable without searchable. <Link href="/">Back to Knokio portal</Link>
        </p>
      </footer>
    </main>
  );
}
