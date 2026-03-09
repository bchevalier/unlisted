import { logger } from '../../../../../../lib/logger';
import { captureException } from '../../../../../../lib/error-tracking';

const log = logger('reach:contracts:override POST');

/**
 * POST /api/reach/contracts/:contractId/override — Human override of a policy decision.
 *
 * Auth required: caller must be the target actor or an org member with CONTRACT_ACT
 * on the target actor.
 * Body: { action: "REOPEN" | "ACCEPT", note?: string }
 *
 * Allows the target to reopen a REJECTED contract (policy override) or
 * directly accept it, recording an OVERRIDDEN audit event.
 */

import { z, ZodError } from 'zod';
import { overrideContractDecision, getContract, ReachError } from '../../../../../../lib/reach';
import {
  authenticateReachRequest,
  reachDisabledResponse,
  unauthorizedResponse,
} from '../../../../../../lib/reach/auth';
import { resolveAuthz, hasPermission } from '../../../../../../lib/reach/permissions';

const OverrideSchema = z.object({
  action: z.enum(['REOPEN', 'ACCEPT']),
  note: z.string().max(1000).optional(),
});

export async function POST(
  request: Request,
  { params }: { params: Promise<{ contractId: string }> },
) {
  const blocked = reachDisabledResponse();
  if (blocked) return blocked;

  const auth = await authenticateReachRequest(request);
  if (!auth) return unauthorizedResponse();

  const { contractId } = await params;

  // Verify contract exists.
  const contract = await getContract(contractId);
  if (!contract) {
    return Response.json({ ok: false, error: 'Contract not found' }, { status: 404 });
  }

  // Only target (or org member of target with CONTRACT_ACT) can override.
  let canOverride = contract.targetId === auth.actorId;
  if (!canOverride) {
    const targetAuthz = await resolveAuthz(auth, contract.targetId);
    canOverride = !!targetAuthz && hasPermission(targetAuthz, 'CONTRACT_ACT');
  }

  if (!canOverride) {
    return Response.json({ ok: false, error: 'Forbidden' }, { status: 403 });
  }

  try {
    const body = await request.json();
    const { action, note } = OverrideSchema.parse(body);

    // Use the actual target actor ID for the service call (not the org member).
    const updated = await overrideContractDecision(
      contractId,
      contract.targetId,
      action,
      note,
    );

    return Response.json({ ok: true, contract: updated });
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
    void captureException(error, { component: 'reach:contracts:override POST' });
    return Response.json({ ok: false, error: 'Internal server error' }, { status: 500 });
  }
}
