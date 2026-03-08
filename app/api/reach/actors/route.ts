/**
 * POST /api/reach/actors — Register a new Reach actor.
 * GET  /api/reach/actors — List actors (auth required).
 *
 * For human users: requires keeper session; links actor to user.
 * For headless actors: no auth required (returns API key on creation).
 *
 * GET query params:
 *   - type:     filter by actor type (HUMAN, AI_AGENT, ORGANIZATION)
 *   - search:   keyword search on handle or displayName (case-insensitive)
 *   - inactive: include inactive actors (default: false)
 *   - limit:    max results (1–100, default 50)
 *   - offset:   pagination offset (default 0)
 */

import { ZodError } from 'zod';
import { createActor, ReachError } from '../../../../lib/reach';
import { listActors } from '../../../../lib/reach/service';
import { ReachActorCreateSchema } from '../../../../lib/reach/contracts';
import { getKeeperSessionFromRequest } from '../../../../lib/keeper-auth';
import {
  authenticateReachRequest,
  reachDisabledResponse,
  unauthorizedResponse,
} from '../../../../lib/reach/auth';
import {
  reachWriteLimiter,
  reachReadLimiter,
  getClientIp,
  rateLimitResponse,
} from '../../../../lib/reach/rate-limit';

export async function POST(request: Request) {
  const blocked = reachDisabledResponse();
  if (blocked) return blocked;

  // IP-based rate limiting for actor creation.
  const clientIp = getClientIp(request);
  const ipCheck = reachWriteLimiter.check(clientIp);
  if (!ipCheck.allowed) return rateLimitResponse(ipCheck);

  try {
    const body = await request.json();
    const data = ReachActorCreateSchema.parse(body);

    // If the actor type is HUMAN, require keeper session to link.
    let userId: string | undefined;
    if (data.type === 'HUMAN') {
      const session = getKeeperSessionFromRequest(request);
      if (!session) {
        return Response.json(
          { ok: false, error: 'Keeper session required to register a human actor' },
          { status: 401 },
        );
      }
      userId = session.userId;
    }

    // For ORGANIZATION actors, inject the creator's actor ID so the service
    // layer can auto-enroll them as OWNER.
    if (data.type === 'ORGANIZATION') {
      const auth = await authenticateReachRequest(request);
      if (auth) {
        data._creatorActorId = auth.actorId;
      }
    }

    const { actor, apiKey } = await createActor(data, userId);

    return Response.json(
      {
        ok: true,
        actor: {
          id: actor.id,
          type: actor.type,
          handle: actor.handle,
          displayName: actor.displayName,
          isActive: actor.isActive,
          endpoint: actor.endpoint,
          agentMeta: actor.agentMeta ?? undefined,
          apiKeyScopes: actor.apiKeyScopes?.length ? actor.apiKeyScopes : undefined,
          createdAt: actor.createdAt,
        },
        // Only returned once, for headless actors.
        ...(apiKey ? { apiKey } : {}),
      },
      { status: 201 },
    );
  } catch (error) {
    if (error instanceof ZodError) {
      return Response.json(
        { ok: false, error: 'Invalid payload', issues: error.issues },
        { status: 400 },
      );
    }
    if (error instanceof ReachError) {
      return Response.json(
        { ok: false, error: error.message, code: error.code },
        { status: error.statusCode },
      );
    }
    console.error('[reach/actors POST]', error);
    return Response.json({ ok: false, error: 'Internal server error' }, { status: 500 });
  }
}

export async function GET(request: Request) {
  const blocked = reachDisabledResponse();
  if (blocked) return blocked;

  const clientIp = getClientIp(request);
  const ipCheck = reachReadLimiter.check(clientIp);
  if (!ipCheck.allowed) return rateLimitResponse(ipCheck);

  const auth = await authenticateReachRequest(request);
  if (!auth) return unauthorizedResponse();

  try {
    const url = new URL(request.url);
    const limit = Math.min(Math.max(parseInt(url.searchParams.get('limit') || '50', 10) || 50, 1), 100);
    const offset = Math.max(parseInt(url.searchParams.get('offset') || '0', 10) || 0, 0);

    const type = url.searchParams.get('type') ?? undefined;
    const search = url.searchParams.get('search') ?? undefined;
    const includeInactive = url.searchParams.get('inactive') === 'true';

    const { actors, totalCount } = await listActors({
      type,
      search,
      includeInactive,
      limit,
      offset,
    });

    return Response.json({
      ok: true,
      actors,
      pagination: { totalCount, limit, offset },
    });
  } catch (error) {
    console.error('[reach/actors GET]', error);
    return Response.json({ ok: false, error: 'Internal server error' }, { status: 500 });
  }
}
