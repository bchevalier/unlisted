import Link from 'next/link';
import { isReachEnabled } from '../../lib/flags';

export default function ReachClientPage() {
  if (!isReachEnabled()) {
    return (
      <main>
        <h1>Knokio Reach</h1>
        <p>Reach is currently disabled by runtime flag.</p>
        <p>
          Return to <Link href="/">Knokio portal</Link>.
        </p>
      </main>
    );
  }

  return (
    <main>
      <h1>Knokio Reach</h1>
      <p>One-hop, consent-based routing to reach the right human or AI agent.</p>
      <p>Reach pilot is active as a parallel track while Direct remains the protected core.</p>
    </main>
  );
}
