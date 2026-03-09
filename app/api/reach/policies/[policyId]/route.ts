import { logger } from '../../../../../lib/logger';
import { captureException } from '../../../../../lib/error-tracking';

const log = logger('reach:policies PATCH');

/**
 * PATCH  /api/reach/policies/:policyId — Update a policy.
 * DELETE /api/reach/policies/:policyId — Deactivate a policy.
 *
 * Auth required: caller must own the actor that owns the policy,
 * or have POLICY_WRITE permission via org membership.
 */

import { z, ZodError } from 'zod';
import { db } from '../../../../../lib/db';
import { updatePolicy, deactivatePolicy, ReachError } from '../../../../../lib/reach';
import { ReachPolicyCreateSchema } from '../../../../../lib/reach/contracts';
import {
  authenticateReachRequest,
  reachDisabledResponse,
  unauthorizedResponse,
} from '../../../../../lib/reach/auth';
import { resolveAuthz, requirePermission } from '../../../../../lib/reach/permissions';

const PolicyUpdateSchema = ReachPolicyCreateSchema.partial()
  .omit({ name: true })
  .extend({ isActive: z.boolean().optional() });

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ policyId: string }> },
) {
  const blocked = reachDisabledResponse();
  if (blocked) return blocked;

  const auth = await authenticateReachRequest(request);
  if (!auth) return unauthorizedResponse();

  const { policyId } = await params;

  // Verify policy exists.
  const policy = await db.reachPolicy.findUnique({
    where: { id: policyId },
    select: { id: true, actorId: true },
  });
  if (!policy) {
    return Response.json({ ok: false, error: 'Policy not found' }, { status: 404 });
  }

  // RBAC check: direct ownership or org membership with POLICY_WRITE.
  const authz = await resolveAuthz(auth, policy.actorId);
  const denied = requirePermission(authz, 'POLICY_WRITE');
  if (denied) return denied;

  try {
    const body = await request.json();
    const { isActive, ...fieldUpdates } = PolicyUpdateSchema.parse(body);

    // Handle isActive toggle separately.
    if (isActive !== undefined) {
      await db.reachPolicy.update({ where: { id: policyId }, data: { isActive } });
    }

    // Apply remaining field updates if any.
    let updated;
    if (Object.keys(fieldUpdates).length > 0) {
      updated = await updatePolicy(policyId, fieldUpdates);
    } else {
      updated = await db.reachPolicy.findUnique({ where: { id: policyId } });
    }

    return Response.json({ ok: true, policy: updated });
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
    void captureException(error, { component: 'reach:policies PATCH' });
    return Response.json({ ok: false, error: 'Internal server error' }, { status: 500 });
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ policyId: string }> },
) {
  const blocked = reachDisabledResponse();
  if (blocked) return blocked;

  const auth = await authenticateReachRequest(request);
  if (!auth) return unauthorizedResponse();

  const { policyId } = await params;

  const policy = await db.reachPolicy.findUnique({
    where: { id: policyId },
    select: { id: true, actorId: true },
  });
  if (!policy) {
    return Response.json({ ok: false, error: 'Policy not found' }, { status: 404 });
  }

  // RBAC check: direct ownership or org membership with POLICY_WRITE.
  const authz = await resolveAuthz(auth, policy.actorId);
  const denied = requirePermission(authz, 'POLICY_WRITE');
  if (denied) return denied;

  try {
    await deactivatePolicy(policyId);
    return Response.json({ ok: true });
  } catch (error) {
    if (error instanceof ReachError) {
      return Response.json(
        { ok: false, error: error.message, code: error.code },
        { status: error.statusCode },
      );
    }
    log.error('Request failed', { error });
    void captureException(error, { component: 'reach:policies PATCH' });
    return Response.json({ ok: false, error: 'Internal server error' }, { status: 500 });
  }
}
