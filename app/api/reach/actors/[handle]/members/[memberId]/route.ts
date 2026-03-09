import { logger } from '../../../../../../../lib/logger';
import { captureException } from '../../../../../../../lib/error-tracking';

const log = logger('reach:actors::handle:members::memberId PATCH');

/**
 * PATCH  /api/reach/actors/:handle/members/:memberId — Update member role.
 * DELETE /api/reach/actors/:handle/members/:memberId — Remove member from org.
 *
 * Auth required. Caller must have ORG_MEMBERS_WRITE permission.
 */

import { z, ZodError } from 'zod';
import {
  getActorByHandle,
  removeOrgMember,
  updateOrgMemberRole,
  ReachError,
} from '../../../../../../../lib/reach';
import {
  authenticateReachRequest,
  reachDisabledResponse,
  unauthorizedResponse,
} from '../../../../../../../lib/reach/auth';
import { resolveAuthz, requirePermission } from '../../../../../../../lib/reach/permissions';

const UpdateRoleSchema = z.object({
  role: z.enum(['OWNER', 'ADMIN', 'MEMBER']),
});

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ handle: string; memberId: string }> },
) {
  const blocked = reachDisabledResponse();
  if (blocked) return blocked;

  const auth = await authenticateReachRequest(request);
  if (!auth) return unauthorizedResponse();

  const { handle, memberId } = await params;
  const actor = await getActorByHandle(handle);
  if (!actor) {
    return Response.json({ ok: false, error: 'Actor not found' }, { status: 404 });
  }

  const authz = await resolveAuthz(auth, actor.id);
  const denied = requirePermission(authz, 'ORG_MEMBERS_WRITE');
  if (denied) return denied;

  try {
    const body = await request.json();
    const data = UpdateRoleSchema.parse(body);
    const updated = await updateOrgMemberRole(actor.id, memberId, data.role);

    return Response.json({
      ok: true,
      membership: {
        id: updated.id,
        orgId: updated.orgId,
        memberId: updated.memberId,
        role: updated.role,
        isActive: updated.isActive,
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
    log.error('Request failed', { error });
    void captureException(error, { component: 'reach:actors::handle:members::memberId PATCH' });
    return Response.json({ ok: false, error: 'Internal server error' }, { status: 500 });
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ handle: string; memberId: string }> },
) {
  const blocked = reachDisabledResponse();
  if (blocked) return blocked;

  const auth = await authenticateReachRequest(request);
  if (!auth) return unauthorizedResponse();

  const { handle, memberId } = await params;
  const actor = await getActorByHandle(handle);
  if (!actor) {
    return Response.json({ ok: false, error: 'Actor not found' }, { status: 404 });
  }

  const authz = await resolveAuthz(auth, actor.id);
  const denied = requirePermission(authz, 'ORG_MEMBERS_WRITE');
  if (denied) return denied;

  try {
    await removeOrgMember(actor.id, memberId);
    return Response.json({ ok: true });
  } catch (error) {
    if (error instanceof ReachError) {
      return Response.json(
        { ok: false, error: error.message, code: error.code },
        { status: error.statusCode },
      );
    }
    log.error('Request failed', { error });
    void captureException(error, { component: 'reach:actors::handle:members::memberId PATCH' });
    return Response.json({ ok: false, error: 'Internal server error' }, { status: 500 });
  }
}
