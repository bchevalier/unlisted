import Link from 'next/link';

export default function TermsPage() {
  return (
    <main className="policy-page">
      <section className="policy-stack">
        <h1>Terms</h1>
        <p>
          By using Knokio, you agree to use Direct and Reach for legitimate, policy-compliant contact and introductions.
        </p>
        <ul className="policy-list">
          <li>No abuse, harassment, or unauthorized scraping.</li>
          <li>No attempts to bypass verification, consent, or rate-limits.</li>
          <li>Respect recipient intent and configured access controls.</li>
        </ul>
        <p>
          Start with <Link href="/direct">Direct</Link> or <Link href="/reach">Reach</Link>.
        </p>
      </section>
    </main>
  );
}
