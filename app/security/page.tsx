export default function SecurityPage() {
  return (
    <main className="policy-page">
      <section className="policy-stack">
        <h1>Security</h1>
        <p>Knokio applies layered controls to keep inbound access safe and traceable.</p>
        <ul className="policy-list">
          <li>Authentication and session controls for account access.</li>
          <li>Rate limits and anti-abuse checks on inbound paths.</li>
          <li>Verification gates and policy enforcement by lane.</li>
          <li>Operational monitoring and incident response runbooks.</li>
        </ul>
      </section>
    </main>
  );
}
