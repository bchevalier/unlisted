/**
 * Reach API authentication middleware.
 *
 * Supports two auth modes:
 *   1. API key (headless actors: AI_AGENT, ORGANIZATION) — `Authorization: Bearer knk_...`
 *   2. Keeper session cookie (human actors) — standard browser session
 *
 * Returns the authenticated ReachActor or null.
 */

import * as crypto from 'crypto';
import { db } from '../db';
import { getKeeperSessionFromRequest } from '../keeper-auth';
import { isReachEnabled } from '../flags';

export interface ReachAuthResult {
  actorId: string;
  actorType: string;
  userId: string | null;
}

/**
 * Authenticate a Reach API request.
 * Tries API key first, then falls back to keeper session.
 */
export async function authenticateReachRequest(
  request: Request,
): Promise<ReachAuthResult | null> {
  // 1. Try API key auth (headless actors).
  const authHeader = request.headers.get('authorization');
  if (authHeader?.startsWith('Bearer knk_')) {
    const apiKey = authHeader.slice(7); // strip "Bearer "
    const hash = crypto.createHash('sha256').update(apiKey).digest('hex');
    const actor = await db.reachActor.findFirst({
      where: { apiKeyHash: hash, isActive: true },
      select: { id: true, type: true, userId: true },
    });
    if (actor) {
      return { actorId: actor.id, actorType: actor.type, userId: actor.userId };
    }
    return null; // invalid API key
  }

  // 2. Try keeper session (human actors).
  const session = getKeeperSessionFromRequest(request);
  if (session) {
    const actor = await db.reachActor.findUnique({
      where: { userId: session.userId },
      select: { id: true, type: true, userId: true },
    });
    if (actor) {
      return { actorId: actor.id, actorType: actor.type, userId: actor.userId };
    }
    // Authenticated user but no Reach actor yet — return null (they need to register).
    return null;
  }

  return null;
}

/**
 * Gate helper: returns a 403 JSON response if Reach is disabled.
 */
export function reachDisabledResponse(): Response | null {
  if (!isReachEnabled()) {
    return Response.json(
      { ok: false, error: 'Reach is currently disabled' },
      { status: 403 },
    );
  }
  return null;
}

/**
 * Gate helper: returns a 401 JSON response.
 */
export function unauthorizedResponse(): Response {
  return Response.json(
    { ok: false, error: 'Authentication required' },
    { status: 401 },
  );
}
