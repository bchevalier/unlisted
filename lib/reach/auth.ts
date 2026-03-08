/**
 * Reach API authentication middleware.
 *
 * Supports two auth modes:
 *   1. API key (headless actors: AI_AGENT, ORGANIZATION) — `Authorization: Bearer knk_...`
 *   2. Keeper session cookie (human actors) — standard browser session
 *
 * Delegation:
 *   The `X-Reach-Act-As` header allows an authenticated actor to act on behalf
 *   of an org they are a member of. The resolved auth result will include both
 *   the effective actor ID and the delegator's original identity for audit.
 *
 * Scoped API keys:
 *   If apiKeyScopes is non-empty, the key's permissions are limited to those scopes.
 *   The scopes are returned in the auth result for downstream permission enforcement.
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
  /** When acting via delegation, the original caller's actor ID. */
  delegatorActorId?: string;
  /** When acting via delegation, the original caller's actor type. */
  delegatorActorType?: string;
  /** API key scopes (empty = full access). */
  apiKeyScopes?: string[];
}

/**
 * Authenticate a Reach API request.
 * Tries API key first, then falls back to keeper session.
 * Handles `X-Reach-Act-As` delegation header for org actions.
 */
export async function authenticateReachRequest(
  request: Request,
): Promise<ReachAuthResult | null> {
  let baseAuth: ReachAuthResult | null = null;
  let apiKeyScopes: string[] = [];

  // 1. Try API key auth (headless actors).
  const authHeader = request.headers.get('authorization');
  if (authHeader?.startsWith('Bearer knk_')) {
    const apiKey = authHeader.slice(7); // strip "Bearer "
    const hash = crypto.createHash('sha256').update(apiKey).digest('hex');
    const actor = await db.reachActor.findFirst({
      where: { apiKeyHash: hash, isActive: true },
      select: { id: true, type: true, userId: true, apiKeyScopes: true },
    });
    if (actor) {
      apiKeyScopes = actor.apiKeyScopes ?? [];
      baseAuth = {
        actorId: actor.id,
        actorType: actor.type,
        userId: actor.userId,
        apiKeyScopes,
      };
    } else {
      return null; // invalid API key
    }
  }

  // 2. Try keeper session (human actors).
  if (!baseAuth) {
    const session = getKeeperSessionFromRequest(request);
    if (session) {
      const actor = await db.reachActor.findUnique({
        where: { userId: session.userId },
        select: { id: true, type: true, userId: true },
      });
      if (actor) {
        baseAuth = { actorId: actor.id, actorType: actor.type, userId: actor.userId };
      } else {
        return null; // authenticated user but no Reach actor
      }
    }
  }

  if (!baseAuth) return null;

  // 3. Handle X-Reach-Act-As delegation header.
  const actAsHandle = request.headers.get('x-reach-act-as');
  if (actAsHandle) {
    const targetActor = await db.reachActor.findUnique({
      where: { handle: actAsHandle },
      select: { id: true, type: true, isActive: true },
    });

    if (!targetActor || !targetActor.isActive) {
      return null; // delegation target not found or inactive
    }

    // Verify the caller is a member of the target org.
    if (targetActor.type !== 'ORGANIZATION') {
      return null; // can only delegate to organizations
    }

    const membership = await db.reachOrgMember.findUnique({
      where: {
        orgId_memberId: {
          orgId: targetActor.id,
          memberId: baseAuth.actorId,
        },
      },
      select: { isActive: true },
    });

    if (!membership || !membership.isActive) {
      return null; // not a member of the org
    }

    return {
      actorId: targetActor.id,
      actorType: targetActor.type,
      userId: baseAuth.userId,
      delegatorActorId: baseAuth.actorId,
      delegatorActorType: baseAuth.actorType,
      apiKeyScopes,
    };
  }

  return baseAuth;
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
