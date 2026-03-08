/**
 * POST /api/reach/contracts/:contractId/override — Human override of a policy decision.
 *
 * Auth required: caller must be the target actor of the contract.
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

  // Only target can override.
  if (contract.targetId !== auth.actorId) {
    return Response.json({ ok: false, error: 'Forbidden' }, { status: 403 });
  }

  try {
    const body = await request.json();
    const { action, note } = OverrideSchema.parse(body);

    const updated = await overrideContractDecision(contractId, auth.actorId, action, note);

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
    console.error('[reach/contracts/override POST]', error);
    return Response.json({ ok: false, error: 'Internal server error' }, { status: 500 });
  }
}
