/**
 * POST /api/reach/actors/:handle/key — Rotate API key for a headless actor.
 *
 * Auth required. Caller must have KEY_ROTATE permission on the target actor.
 * Returns the new plaintext API key (only shown once).
 */

import {
  getActorByHandle,
  rotateApiKey,
  ReachError,
} from '../../../../../../lib/reach';
import {
  authenticateReachRequest,
  reachDisabledResponse,
  unauthorizedResponse,
} from '../../../../../../lib/reach/auth';
import { resolveAuthz, requirePermission } from '../../../../../../lib/reach/permissions';

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
  const denied = requirePermission(authz, 'KEY_ROTATE');
  if (denied) return denied;

  try {
    const { apiKey } = await rotateApiKey(actor.id);
    return Response.json({
      ok: true,
      apiKey,
      warning: 'Store this key securely. It will not be shown again.',
    });
  } catch (error) {
    if (error instanceof ReachError) {
      return Response.json(
        { ok: false, error: error.message, code: error.code },
        { status: error.statusCode },
      );
    }
    console.error('[reach/actors/:handle/key POST]', error);
    return Response.json({ ok: false, error: 'Internal server error' }, { status: 500 });
  }
}
