import Link from 'next/link';

export default function PrivacyPage() {
  return (
    <main className="policy-page">
      <section className="policy-stack">
        <h1>Privacy</h1>
        <p>
          Knokio is designed for controlled reachability: people can contact you without exposing your personal inbox,
          DMs, or profile details.
        </p>
        <ul className="policy-list">
          <li>Private-by-default routing.</li>
          <li>Structured inbound requests instead of raw message spam.</li>
          <li>Verification and policy checks before delivery where configured.</li>
        </ul>
        <p>
          Product specifics are handled by lane: <Link href="/direct">Direct</Link> and <Link href="/reach">Reach</Link>.
        </p>
      </section>
    </main>
  );
}
