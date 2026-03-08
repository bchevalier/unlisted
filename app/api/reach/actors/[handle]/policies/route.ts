/**
 * POST /api/reach/actors/:handle/policies — Create a policy for an actor.
 * GET  /api/reach/actors/:handle/policies — List policies for an actor.
 *
 * Auth required: caller must own the actor (matched via auth result).
 */

import { ZodError } from 'zod';
import {
  createPolicy,
  listPolicies,
  getActorByHandle,
  ReachError,
} from '../../../../../../lib/reach';
import { ReachPolicyCreateSchema } from '../../../../../../lib/reach/contracts';
import {
  authenticateReachRequest,
  reachDisabledResponse,
  unauthorizedResponse,
} from '../../../../../../lib/reach/auth';

export async function GET(
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

  // Only the actor owner can view their policies.
  if (actor.id !== auth.actorId) {
    return Response.json({ ok: false, error: 'Forbidden' }, { status: 403 });
  }

  const policies = await listPolicies(actor.id);
  return Response.json({ ok: true, policies });
}

export async function POST(
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

  if (actor.id !== auth.actorId) {
    return Response.json({ ok: false, error: 'Forbidden' }, { status: 403 });
  }

  try {
    const body = await request.json();
    const data = ReachPolicyCreateSchema.parse(body);
    const policy = await createPolicy(actor.id, data);

    return Response.json({ ok: true, policy }, { status: 201 });
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
    console.error('[reach/actors/policies POST]', error);
    return Response.json({ ok: false, error: 'Internal server error' }, { status: 500 });
  }
}
