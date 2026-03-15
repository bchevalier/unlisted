import { ZodError } from 'zod';
import {
  authenticateReachRequest,
  reachDisabledResponse,
  unauthorizedResponse,
  resolveAuthz,
  requirePermission,
  getActorByHandle,
  verifySocialVerification,
  ReachSocialVerificationVerifySchema,
  ReachSocialVerificationError,
  reachWriteLimiter,
  reachAuthLimiter,
  socialVerificationVerifyLimiter,
  getClientIp,
  rateLimitResponse,
  addRateLimitHeaders,
} from '../../../../../../../../lib/reach';
import { logger } from '../../../../../../../../lib/logger';
import { captureException } from '../../../../../../../../lib/error-tracking';

const log = logger('reach:actors:social-verifications:verify');

/**
 * POST /api/reach/actors/:handle/social-verifications/:verificationId/verify
 */
export async function POST(
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

  // Actor-level rate limit for verify attempts (20/hr per actor).
  const actorCheck = socialVerificationVerifyLimiter.check(actor.id);
  if (!actorCheck.allowed) return rateLimitResponse(actorCheck);

  try {
    const body = await request.json().catch(() => ({}));
    const data = ReachSocialVerificationVerifySchema.parse(body);
    const verification = await verifySocialVerification(actor.id, verificationId, data);

    return addRateLimitHeaders(
      Response.json({ ok: true, verification }),
      actorCheck,
    );
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

    log.error('Request failed', { error, verificationId });
    void captureException(error, {
      component: 'reach:actors:social-verifications:verify POST',
      verificationId,
    });
    return Response.json({ ok: false, error: 'Internal server error' }, { status: 500 });
  }
}
