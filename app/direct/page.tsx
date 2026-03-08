import Link from 'next/link';

export default function DirectClientPage() {
  return (
    <main>
      <h1>Knokio Direct</h1>
      <p>Filtered inbound for people who want to stay reachable without inbox chaos.</p>

      <ul>
        <li>
          Demo public door: <Link href="/u/john">/u/john</Link>
        </li>
        <li>
          Demo inbox: <Link href="/direct/inbox?slug=john">/direct/inbox?slug=john</Link>
        </li>
      </ul>

      <p>
        If this is a fresh environment, run <code>npm run db:seed</code> first.
      </p>
    </main>
  );
}
