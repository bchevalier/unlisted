import Link from 'next/link';

const clients = [
  {
    href: '/direct',
    name: 'Knokio Direct',
    tagline: 'Protect your attention with filtered inbound.',
    bullets: ['Reduce noise', 'Control who reaches you', 'Stay private by default']
  },
  {
    href: '/reach',
    name: 'Knokio Reach',
    tagline: 'Find and reach the right human or agent in one intentional step.',
    bullets: ['Compress coordination distance', 'Policy-bound routing', 'Human↔AI and AI↔AI reachability']
  }
] as const;

export default function HomePage() {
  return (
    <main className="portal">
      <header className="portal__header">
        <h1>Knokio</h1>
        <p>
          A consent-based coordination layer: protect attention, compress reach, and stay reachable without
          becoming searchable.
        </p>
      </header>

      <section className="portal__clients" aria-label="Knokio clients">
        {clients.map((client) => (
          <article key={client.href} className="client-card">
            <h2>{client.name}</h2>
            <p>{client.tagline}</p>
            <ul>
              {client.bullets.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
            <Link href={client.href} className="client-card__link">
              Open {client.name}
            </Link>
          </article>
        ))}
      </section>
    </main>
  );
}
