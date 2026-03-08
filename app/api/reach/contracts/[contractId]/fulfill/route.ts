/**
 * POST /api/reach/contracts/:contractId/fulfill — Fulfill a contract with optional response data.
 *
 * Auth required: caller must be the target actor or an org member with CONTRACT_ACT
 * on the target actor.
 * Body: { responseData?: Record<string, unknown>, note?: string }
 *
 * Transitions an ACTIVE contract to FULFILLED and optionally stores a response payload.
 */

import { z, ZodError } from 'zod';
import { fulfillContract, getContract, ReachError } from '../../../../../../lib/reach';
import {
  authenticateReachRequest,
  reachDisabledResponse,
  unauthorizedResponse,
} from '../../../../../../lib/reach/auth';
import { resolveAuthz, hasPermission } from '../../../../../../lib/reach/permissions';

const FulfillSchema = z.object({
  responseData: z.record(z.unknown()).optional(),
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

  // Only target (or org member of target with CONTRACT_ACT) can fulfill.
  let actorId = contract.targetId;
  let canFulfill = contract.targetId === auth.actorId;
  if (!canFulfill) {
    const targetAuthz = await resolveAuthz(auth, contract.targetId);
    canFulfill = !!targetAuthz && hasPermission(targetAuthz, 'CONTRACT_ACT');
  }

  if (!canFulfill) {
    return Response.json({ ok: false, error: 'Forbidden' }, { status: 403 });
  }

  try {
    const body = await request.json();
    const { responseData, note } = FulfillSchema.parse(body);

    const updated = await fulfillContract(contractId, actorId, responseData, note);

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
    console.error('[reach/contracts/fulfill POST]', error);
    return Response.json({ ok: false, error: 'Internal server error' }, { status: 500 });
  }
}
