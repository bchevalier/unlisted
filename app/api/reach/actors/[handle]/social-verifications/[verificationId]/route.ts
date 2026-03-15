import {
  authenticateReachRequest,
  reachDisabledResponse,
  unauthorizedResponse,
  resolveAuthz,
  requirePermission,
  getActorByHandle,
  deleteSocialVerification,
  ReachSocialVerificationError,
  reachWriteLimiter,
  reachAuthLimiter,
  socialVerificationDeleteLimiter,
  getClientIp,
  rateLimitResponse,
  addRateLimitHeaders,
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

  // IP-based rate limiting (defense-in-depth, before auth).
  const clientIp = getClientIp(request);
  const ipCheck = reachWriteLimiter.check(clientIp);
  if (!ipCheck.allowed) return rateLimitResponse(ipCheck);

  const auth = await authenticateReachRequest(request);
  if (!auth) {
    reachAuthLimiter.check(clientIp);
    return unauthorizedResponse();
  }

  const { handle, verificationId } = await params;
  const actor = await getActorByHandle(handle);
  if (!actor) {
    return Response.json({ ok: false, error: 'Actor not found' }, { status: 404 });
  }

  const authz = await resolveAuthz(auth, actor.id);
  const denied = requirePermission(authz, 'ACTOR_UPDATE');
  if (denied) return denied;

  // Actor-level rate limit for deletes (20/hr per actor).
  const actorCheck = socialVerificationDeleteLimiter.check(actor.id);
  if (!actorCheck.allowed) return rateLimitResponse(actorCheck);

  try {
    await deleteSocialVerification(actor.id, verificationId);
    return addRateLimitHeaders(
      Response.json({ ok: true }),
      actorCheck,
    );
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
