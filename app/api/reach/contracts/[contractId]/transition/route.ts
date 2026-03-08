/**
 * POST /api/reach/contracts/:contractId/transition — Transition contract status.
 *
 * Auth required: caller must be a party to the contract, or an org member
 * with CONTRACT_ACT permission on a party.
 * Body: { status: "ACTIVE" | "FULFILLED" | "REJECTED" | "CANCELLED", note?: string }
 *
 * The actor's role (initiator vs target) determines who is recorded as the event actor:
 *   - Initiator (or org member of initiator) → INITIATOR event actor
 *   - Target (or org member of target) → TARGET event actor
 */

import { z, ZodError } from 'zod';
import { REACH_CONTRACT_STATUSES } from '../../../../../../lib/reach/contracts';
import type { ReachContractStatus, ReachContractEventActor } from '../../../../../../lib/reach/contracts';
import { transitionContract, getContract, ReachError } from '../../../../../../lib/reach';
import {
  authenticateReachRequest,
  reachDisabledResponse,
  unauthorizedResponse,
} from '../../../../../../lib/reach/auth';
import { resolveAuthz, hasPermission } from '../../../../../../lib/reach/permissions';

const TransitionSchema = z.object({
  status: z.enum(REACH_CONTRACT_STATUSES),
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

  // Determine event actor role: check direct party match, then org membership.
  const eventActor = await resolveEventActor(auth, contract.initiatorId, contract.targetId);
  if (!eventActor) {
    return Response.json({ ok: false, error: 'Forbidden' }, { status: 403 });
  }

  try {
    const body = await request.json();
    const { status: newStatus, note } = TransitionSchema.parse(body);

    const updated = await transitionContract(
      contractId,
      newStatus as ReachContractStatus,
      eventActor,
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
    console.error('[reach/contracts/transition POST]', error);
    return Response.json({ ok: false, error: 'Internal server error' }, { status: 500 });
  }
}

/**
 * Resolve the event actor label for audit trail purposes.
 * Returns INITIATOR or TARGET based on direct match or org membership with CONTRACT_ACT.
 */
async function resolveEventActor(
  auth: { actorId: string; actorType: string; userId: string | null },
  initiatorId: string,
  targetId: string,
): Promise<ReachContractEventActor | null> {
  // Direct match.
  if (auth.actorId === initiatorId) return 'INITIATOR';
  if (auth.actorId === targetId) return 'TARGET';

  // Org membership on initiator side.
  const initiatorAuthz = await resolveAuthz(auth, initiatorId);
  if (initiatorAuthz && hasPermission(initiatorAuthz, 'CONTRACT_ACT')) {
    return 'INITIATOR';
  }

  // Org membership on target side.
  const targetAuthz = await resolveAuthz(auth, targetId);
  if (targetAuthz && hasPermission(targetAuthz, 'CONTRACT_ACT')) {
    return 'TARGET';
  }

  return null;
}
