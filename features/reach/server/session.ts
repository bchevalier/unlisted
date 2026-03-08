/**
 * Reach session helpers for server components.
 *
 * Extends the keeper session to resolve the Reach actor for the
 * currently logged-in user. Redirects to /reach if no actor is found.
 */

import { redirect } from 'next/navigation';
import { getKeeperSessionFromCookies } from '../../../lib/keeper-auth';
import { db } from '../../../lib/db';

export interface ReachSession {
  userId: string;
  email: string;
  actorId: string;
  actorType: string;
  actorHandle: string;
  actorDisplayName: string;
}

/**
 * Require an authenticated keeper session with a linked Reach actor.
 * Redirects to login if not authenticated, or to /reach if no actor exists.
 */
export async function requireReachSession(nextPath?: string): Promise<ReachSession> {
  const session = await getKeeperSessionFromCookies();

  if (!session) {
    const target = nextPath
      ? `/direct/login?next=${encodeURIComponent(nextPath)}`
      : '/direct/login?next=/reach';
    redirect(target);
  }

  const actor = await db.reachActor.findUnique({
    where: { userId: session.userId },
    select: {
      id: true,
      type: true,
      handle: true,
      displayName: true,
    },
  });

  if (!actor) {
    redirect('/reach/register');
  }

  return {
    userId: session.userId,
    email: session.email,
    actorId: actor.id,
    actorType: actor.type,
    actorHandle: actor.handle,
    actorDisplayName: actor.displayName,
  };
}

/**
 * Get the keeper session + actor if exists (non-redirecting variant).
 * Returns null if not logged in or no actor.
 */
export async function getReachSession(): Promise<ReachSession | null> {
  const session = await getKeeperSessionFromCookies();
  if (!session) return null;

  const actor = await db.reachActor.findUnique({
    where: { userId: session.userId },
    select: {
      id: true,
      type: true,
      handle: true,
      displayName: true,
    },
  });

  if (!actor) return null;

  return {
    userId: session.userId,
    email: session.email,
    actorId: actor.id,
    actorType: actor.type,
    actorHandle: actor.handle,
    actorDisplayName: actor.displayName,
  };
}
