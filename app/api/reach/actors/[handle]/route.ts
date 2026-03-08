/**
 * GET /api/reach/actors/:handle — Look up an actor by handle.
 *
 * Public endpoint (no auth required) — returns non-sensitive actor info.
 * This allows initiators to discover target handles before proposing contracts.
 */

import { getActorByHandle } from '../../../../../lib/reach';
import { reachDisabledResponse } from '../../../../../lib/reach/auth';

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
      createdAt: actor.createdAt,
    },
  });
}
