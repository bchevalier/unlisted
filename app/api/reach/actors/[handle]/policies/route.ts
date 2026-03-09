import { logger } from '../../../../../../lib/logger';
import { captureException } from '../../../../../../lib/error-tracking';

const log = logger('reach:actors:policies POST');

/**
 * GET  /api/reach/actors/:handle/policies — List policies for an actor.
 * POST /api/reach/actors/:handle/policies — Create a policy for an actor.
 *
 * Auth required. Uses RBAC: GET needs POLICY_READ, POST needs POLICY_WRITE.
 * Both direct actor ownership and org membership (with appropriate role) work.
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
import { resolveAuthz, requirePermission } from '../../../../../../lib/reach/permissions';

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

  const authz = await resolveAuthz(auth, actor.id);
  const denied = requirePermission(authz, 'POLICY_READ');
  if (denied) return denied;

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

  const authz = await resolveAuthz(auth, actor.id);
  const denied = requirePermission(authz, 'POLICY_WRITE');
  if (denied) return denied;

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
    log.error('Request failed', { error });
    void captureException(error, { component: 'reach:actors:policies POST' });
    return Response.json({ ok: false, error: 'Internal server error' }, { status: 500 });
  }
}
