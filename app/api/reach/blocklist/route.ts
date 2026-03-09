import { logger } from '../../../../lib/logger';
import { captureException } from '../../../../lib/error-tracking';

const log = logger('reach:blocklist GET');

/**
 * GET  /api/reach/blocklist         — List blocked actors
 * POST /api/reach/blocklist         — Block an actor
 * DELETE /api/reach/blocklist       — Unblock an actor
 *
 * Auth required. Operates on the authenticated actor's blocklist.
 * Supports ?actorId= for org delegation.
 */

import { ZodError } from 'zod';
import {
  blockActor,
  unblockActor,
  listBlockedActors,
  ReachSafetyError,
} from '../../../../lib/reach';
import {
  authenticateReachRequest,
  reachDisabledResponse,
  unauthorizedResponse,
} from '../../../../lib/reach/auth';
import { resolveAuthz, requirePermission } from '../../../../lib/reach/permissions';
import {
  reachWriteLimiter,
  reachReadLimiter,
  getClientIp,
  rateLimitResponse,
} from '../../../../lib/reach/rate-limit';

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
    let actorId = auth.actorId;

    const onBehalfOf = url.searchParams.get('actorId');
    if (onBehalfOf && onBehalfOf !== auth.actorId) {
      const authz = await resolveAuthz(auth, onBehalfOf);
      const denied = requirePermission(authz, 'ACTOR_UPDATE');
      if (denied) return denied;
      actorId = onBehalfOf;
    }

    const entries = await listBlockedActors(actorId);
    return Response.json({ ok: true, blockedActors: entries });
  } catch (error) {
    log.error('Request failed', { error });
    void captureException(error, { component: 'reach:blocklist GET' });
    return Response.json({ ok: false, error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const blocked = reachDisabledResponse();
  if (blocked) return blocked;

  const clientIp = getClientIp(request);
  const ipCheck = reachWriteLimiter.check(clientIp);
  if (!ipCheck.allowed) return rateLimitResponse(ipCheck);

  const auth = await authenticateReachRequest(request);
  if (!auth) return unauthorizedResponse();

  try {
    const body = await request.json();

    const url = new URL(request.url);
    let actorId = auth.actorId;

    const onBehalfOf = url.searchParams.get('actorId');
    if (onBehalfOf && onBehalfOf !== auth.actorId) {
      const authz = await resolveAuthz(auth, onBehalfOf);
      const denied = requirePermission(authz, 'ACTOR_UPDATE');
      if (denied) return denied;
      actorId = onBehalfOf;
    }

    const entry = await blockActor(actorId, body);
    return Response.json({ ok: true, block: entry }, { status: 201 });
  } catch (error) {
    if (error instanceof ZodError) {
      return Response.json(
        { ok: false, error: 'Invalid payload', issues: error.issues },
        { status: 400 },
      );
    }
    if (error instanceof ReachSafetyError) {
      return Response.json(
        { ok: false, error: error.message, code: error.code },
        { status: error.statusCode },
      );
    }
    log.error('Request failed', { error });
    void captureException(error, { component: 'reach:blocklist GET' });
    return Response.json({ ok: false, error: 'Internal server error' }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  const blocked = reachDisabledResponse();
  if (blocked) return blocked;

  const clientIp = getClientIp(request);
  const ipCheck = reachWriteLimiter.check(clientIp);
  if (!ipCheck.allowed) return rateLimitResponse(ipCheck);

  const auth = await authenticateReachRequest(request);
  if (!auth) return unauthorizedResponse();

  try {
    const body = await request.json();
    const handle = body?.blockedHandle;

    if (!handle || typeof handle !== 'string') {
      return Response.json(
        { ok: false, error: 'blockedHandle is required' },
        { status: 400 },
      );
    }

    const url = new URL(request.url);
    let actorId = auth.actorId;

    const onBehalfOf = url.searchParams.get('actorId');
    if (onBehalfOf && onBehalfOf !== auth.actorId) {
      const authz = await resolveAuthz(auth, onBehalfOf);
      const denied = requirePermission(authz, 'ACTOR_UPDATE');
      if (denied) return denied;
      actorId = onBehalfOf;
    }

    const result = await unblockActor(actorId, handle);
    return Response.json({ ok: true, ...result });
  } catch (error) {
    if (error instanceof ReachSafetyError) {
      return Response.json(
        { ok: false, error: error.message, code: error.code },
        { status: error.statusCode },
      );
    }
    log.error('Request failed', { error });
    void captureException(error, { component: 'reach:blocklist GET' });
    return Response.json({ ok: false, error: 'Internal server error' }, { status: 500 });
  }
}
