/**
 * GET  /api/reach/actors/:handle/members — List org members.
 * POST /api/reach/actors/:handle/members — Add a member to the org.
 *
 * Auth required. GET needs ORG_MEMBERS_READ, POST needs ORG_MEMBERS_WRITE.
 */

import { z, ZodError } from 'zod';
import {
  getActorByHandle,
  addOrgMember,
  listOrgMembers,
  ReachError,
} from '../../../../../../lib/reach';
import {
  authenticateReachRequest,
  reachDisabledResponse,
  unauthorizedResponse,
} from '../../../../../../lib/reach/auth';
import { resolveAuthz, requirePermission } from '../../../../../../lib/reach/permissions';

const AddMemberSchema = z.object({
  memberId: z.string().min(1),
  role: z.enum(['OWNER', 'ADMIN', 'MEMBER']).default('MEMBER'),
});

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
  const denied = requirePermission(authz, 'ORG_MEMBERS_READ');
  if (denied) return denied;

  try {
    const members = await listOrgMembers(actor.id);
    return Response.json({
      ok: true,
      members: members.map((m) => ({
        id: m.id,
        role: m.role,
        isActive: m.isActive,
        member: m.member,
        createdAt: m.createdAt,
      })),
    });
  } catch (error) {
    if (error instanceof ReachError) {
      return Response.json(
        { ok: false, error: error.message, code: error.code },
        { status: error.statusCode },
      );
    }
    console.error('[reach/actors/:handle/members GET]', error);
    return Response.json({ ok: false, error: 'Internal server error' }, { status: 500 });
  }
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
  const denied = requirePermission(authz, 'ORG_MEMBERS_WRITE');
  if (denied) return denied;

  try {
    const body = await request.json();
    const data = AddMemberSchema.parse(body);
    const membership = await addOrgMember(actor.id, data.memberId, data.role);

    return Response.json(
      {
        ok: true,
        membership: {
          id: membership.id,
          orgId: membership.orgId,
          memberId: membership.memberId,
          role: membership.role,
          isActive: membership.isActive,
          createdAt: membership.createdAt,
        },
      },
      { status: 201 },
    );
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
    console.error('[reach/actors/:handle/members POST]', error);
    return Response.json({ ok: false, error: 'Internal server error' }, { status: 500 });
  }
}
