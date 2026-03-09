import { logger } from '../../../../../../lib/logger';
import { captureException } from '../../../../../../lib/error-tracking';

const log = logger('reach:webhooks POST');

/**
 * POST /api/reach/actors/:handle/webhooks — Register a new webhook.
 * GET  /api/reach/actors/:handle/webhooks — List webhooks for an actor.
 *
 * Auth required. Caller must own the actor or have ACTOR_UPDATE permission
 * on the actor's org.
 */

import { ZodError } from 'zod';
import {
  authenticateReachRequest,
  reachDisabledResponse,
  unauthorizedResponse,
} from '../../../../../../lib/reach/auth';
import { resolveAuthz, requirePermission } from '../../../../../../lib/reach/permissions';
import {
  getActorByHandle,
  ReachError,
} from '../../../../../../lib/reach/service';
import {
  createWebhook,
  listWebhooks,
  ReachWebhookCreateSchema,
} from '../../../../../../lib/reach/webhooks';

export async function POST(
  request: Request,
  { params }: { params: Promise<{ handle: string }> },
) {
  const blocked = reachDisabledResponse();
  if (blocked) return blocked;

  const auth = await authenticateReachRequest(request);
  if (!auth) return unauthorizedResponse();

  try {
    const { handle } = await params;
    const actor = await getActorByHandle(handle);
    if (!actor) {
      return Response.json({ ok: false, error: 'Actor not found' }, { status: 404 });
    }

    // Must be the actor owner or have ACTOR_UPDATE permission.
    if (actor.id !== auth.actorId) {
      const authz = await resolveAuthz(auth, actor.id);
      const denied = requirePermission(authz, 'ACTOR_UPDATE');
      if (denied) return denied;
    }

    const body = await request.json();
    const data = ReachWebhookCreateSchema.parse(body);
    const result = await createWebhook(actor.id, data);

    return Response.json(
      {
        ok: true,
        webhook: result.webhook,
        // Plaintext secret — shown only once.
        secret: result.secret,
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
    log.error('Request failed', { error });
    void captureException(error, { component: 'reach:webhooks POST' });
    return Response.json({ ok: false, error: 'Internal server error' }, { status: 500 });
  }
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ handle: string }> },
) {
  const blocked = reachDisabledResponse();
  if (blocked) return blocked;

  const auth = await authenticateReachRequest(request);
  if (!auth) return unauthorizedResponse();

  try {
    const { handle } = await params;
    const actor = await getActorByHandle(handle);
    if (!actor) {
      return Response.json({ ok: false, error: 'Actor not found' }, { status: 404 });
    }

    if (actor.id !== auth.actorId) {
      const authz = await resolveAuthz(auth, actor.id);
      const denied = requirePermission(authz, 'ACTOR_READ');
      if (denied) return denied;
    }

    const url = new URL(request.url);
    const includeInactive = url.searchParams.get('includeInactive') === 'true';
    const webhooks = await listWebhooks(actor.id, includeInactive);

    return Response.json({ ok: true, webhooks });
  } catch (error) {
    log.error('Request failed', { error });
    void captureException(error, { component: 'reach:webhooks POST' });
    return Response.json({ ok: false, error: 'Internal server error' }, { status: 500 });
  }
}
