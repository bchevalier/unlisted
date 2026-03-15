import {
  authenticateReachRequest,
  reachDisabledResponse,
  unauthorizedResponse,
  resolveAuthz,
  requirePermission,
  getActorByHandle,
  deleteSocialVerification,
  ReachSocialVerificationError,
} from '../../../../../../../lib/reach';
import { logger } from '../../../../../../../lib/logger';
import { captureException } from '../../../../../../../lib/error-tracking';

const log = logger('reach:actors:social-verifications:delete');

/**
 * DELETE /api/reach/actors/:handle/social-verifications/:verificationId
 */
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ handle: string; verificationId: string }> },
) {
  const blocked = reachDisabledResponse();
  if (blocked) return blocked;

  const auth = await authenticateReachRequest(request);
  if (!auth) return unauthorizedResponse();

  const { handle, verificationId } = await params;
  const actor = await getActorByHandle(handle);
  if (!actor) {
    return Response.json({ ok: false, error: 'Actor not found' }, { status: 404 });
  }

  const authz = await resolveAuthz(auth, actor.id);
  const denied = requirePermission(authz, 'ACTOR_UPDATE');
  if (denied) return denied;

  try {
    await deleteSocialVerification(actor.id, verificationId);
    return Response.json({ ok: true });
  } catch (error) {
    if (error instanceof ReachSocialVerificationError) {
      return Response.json(
        { ok: false, error: error.message, code: error.code },
        { status: error.statusCode },
      );
    }

    log.error('Request failed', { error, verificationId });
    void captureException(error, {
      component: 'reach:actors:social-verifications DELETE',
      verificationId,
    });
    return Response.json({ ok: false, error: 'Internal server error' }, { status: 500 });
  }
}
