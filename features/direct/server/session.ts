import { redirect } from 'next/navigation';
import { getKeeperSessionFromCookies } from '../../../lib/keeper-auth';

export async function requireKeeperSession(nextPath?: string) {
  const session = await getKeeperSessionFromCookies();

  if (!session) {
    const target = nextPath ? `/direct/login?next=${encodeURIComponent(nextPath)}` : '/direct/login';
    redirect(target);
  }

  return session;
}
