import Link from 'next/link';
import { getPublicDoorBySlug } from '../../../features/direct/server/door';
import { KnockForm } from './knock-form';

type DoorPageProps = {
  params: Promise<{
    slug: string;
  }>;
};

export default async function DoorPage({ params }: DoorPageProps) {
  const { slug } = await params;
  const door = await getPublicDoorBySlug(slug);

  if (!door) {
    return (
      <main>
        <h1>Door unavailable</h1>
        <p>This door is invalid or currently disabled.</p>
      </main>
    );
  }

  return (
    <main className="door-page">
      <header className="door-page__header">
        <p className="door-page__eyebrow">Knokio Direct</p>
        <h1>{door.displayName}</h1>
        {door.headline ? <p>{door.headline}</p> : null}
      </header>

      <section className="door-page__body">
        <KnockForm door={door} />
      </section>

      <footer className="door-page__footer">
        <p>
          Private by default. Reachable without searchable. <Link href="/">Back to Knokio portal</Link>
        </p>
      </footer>
    </main>
  );
}
