import { ZodError } from 'zod';
import {
  authenticateReachRequest,
  reachDisabledResponse,
  unauthorizedResponse,
  resolveAuthz,
  requirePermission,
  getActorByHandle,
  createSocialVerificationChallenge,
  listSocialVerifications,
  ReachSocialVerificationCreateSchema,
  ReachSocialVerificationError,
} from '../../../../../../lib/reach';
import { logger } from '../../../../../../lib/logger';
import { captureException } from '../../../../../../lib/error-tracking';

const log = logger('reach:actors:social-verifications');

/**
 * GET  /api/reach/actors/:handle/social-verifications
 * POST /api/reach/actors/:handle/social-verifications
 */

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
  const denied = requirePermission(authz, 'ACTOR_READ');
  if (denied) return denied;

  const verifications = await listSocialVerifications(actor.id);
  return Response.json({ ok: true, verifications });
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
  const denied = requirePermission(authz, 'ACTOR_UPDATE');
  if (denied) return denied;

  try {
    const body = await request.json();
    const data = ReachSocialVerificationCreateSchema.parse(body);
    const created = await createSocialVerificationChallenge(actor.id, data);

    return Response.json({ ok: true, verification: created }, { status: 201 });
  } catch (error) {
    if (error instanceof ZodError) {
      return Response.json(
        { ok: false, error: 'Invalid payload', issues: error.issues },
        { status: 400 },
      );
    }

    if (error instanceof ReachSocialVerificationError) {
      return Response.json(
        { ok: false, error: error.message, code: error.code },
        { status: error.statusCode },
      );
    }

    log.error('Request failed', { error });
    void captureException(error, { component: 'reach:actors:social-verifications POST' });
    return Response.json({ ok: false, error: 'Internal server error' }, { status: 500 });
  }
}
