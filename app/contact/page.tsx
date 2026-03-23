import Link from 'next/link';

export default function ContactPage() {
  return (
    <main className="policy-page">
      <section className="policy-stack">
        <h1>Contact</h1>
        <p>For outreach, use the lane that matches your intent:</p>
        <ul className="policy-list">
          <li>
            <strong>Direct:</strong> Use when you already have a person&apos;s Knokio contact entry.
          </li>
          <li>
            <strong>Reach:</strong> Use when you need one-hop discovery with policy and consent checks.
          </li>
        </ul>
        <p>
          Go to <Link href="/direct">Direct</Link> or <Link href="/reach">Reach</Link>.
        </p>
      </section>
    </main>
  );
}
