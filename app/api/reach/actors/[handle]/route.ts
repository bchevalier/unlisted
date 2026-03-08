/**
 * GET    /api/reach/actors/:handle — Look up an actor by handle (public).
 * PATCH  /api/reach/actors/:handle — Update actor profile (auth + ACTOR_UPDATE).
 * DELETE /api/reach/actors/:handle — Deactivate actor + cascade cancel in-flight contracts (auth + ACTOR_DEACTIVATE).
 */

import { ZodError } from 'zod';
import {
  getActorByHandle,
  updateActor,
  deactivateActorWithCascade,
  ReachActorUpdateSchema,
  ReachError,
} from '../../../../../lib/reach';
import {
  authenticateReachRequest,
  reachDisabledResponse,
  unauthorizedResponse,
} from '../../../../../lib/reach/auth';
import { resolveAuthz, requirePermission } from '../../../../../lib/reach/permissions';

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ handle: string }> },
) {
  const blocked = reachDisabledResponse();
  if (blocked) return blocked;

  const { handle } = await params;

  const actor = await getActorByHandle(handle);
  if (!actor || !actor.isActive) {
    return Response.json(
      { ok: false, error: 'Actor not found' },
      { status: 404 },
    );
  }

  return Response.json({
    ok: true,
    actor: {
      id: actor.id,
      type: actor.type,
      handle: actor.handle,
      displayName: actor.displayName,
      isActive: actor.isActive,
      capabilities: actor.capabilities,
      endpoint: actor.endpoint,
      agentMeta: actor.agentMeta ?? undefined,
      createdAt: actor.createdAt,
    },
  });
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ handle: string }> },
) {
  const blocked = reachDisabledResponse();
  if (blocked) return blocked;

  const auth = await authenticateReachRequest(request);
  if (!auth) return unauthorizedResponse();

  const { handle } = await params;
  const actor = await getActorByHandle(handle);
  if (!actor) {
    return Response.json({ ok: false, error: 'Actor not found' }, { status: 404 });
  }

  const authz = await resolveAuthz(auth, actor.id);
  const denied = requirePermission(authz, 'ACTOR_UPDATE');
  if (denied) return denied;

  try {
    const body = await request.json();
    const data = ReachActorUpdateSchema.parse(body);
    const updated = await updateActor(actor.id, data);

    return Response.json({
      ok: true,
      actor: {
        id: updated.id,
        type: updated.type,
        handle: updated.handle,
        displayName: updated.displayName,
        capabilities: updated.capabilities,
        endpoint: updated.endpoint,
        updatedAt: updated.updatedAt,
      },
    });
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
    console.error('[reach/actors/:handle PATCH]', error);
    return Response.json({ ok: false, error: 'Internal server error' }, { status: 500 });
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ handle: string }> },
) {
  const blocked = reachDisabledResponse();
  if (blocked) return blocked;

  const auth = await authenticateReachRequest(request);
  if (!auth) return unauthorizedResponse();

  const { handle } = await params;
  const actor = await getActorByHandle(handle);
  if (!actor) {
    return Response.json({ ok: false, error: 'Actor not found' }, { status: 404 });
  }

  const authz = await resolveAuthz(auth, actor.id);
  const denied = requirePermission(authz, 'ACTOR_DEACTIVATE');
  if (denied) return denied;

  try {
    const result = await deactivateActorWithCascade(actor.id);

    return Response.json({
      ok: true,
      actor: {
        id: result.actor.id,
        handle: result.actor.handle,
        isActive: result.actor.isActive,
      },
      cancelledContracts: result.cancelledContracts,
    });
  } catch (error) {
    if (error instanceof ReachError) {
      return Response.json(
        { ok: false, error: error.message, code: error.code },
        { status: error.statusCode },
      );
    }
    console.error('[reach/actors/:handle DELETE]', error);
    return Response.json({ ok: false, error: 'Internal server error' }, { status: 500 });
  }
}
