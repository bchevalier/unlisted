import { logger } from '../../../../../../lib/logger';
import { captureException } from '../../../../../../lib/error-tracking';

const log = logger('reach:contracts:transition POST');

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
import type { ReachContractStatus } from '../../../../../../lib/reach/contracts';
import { transitionContract, getContract, ReachError } from '../../../../../../lib/reach';
import {
  authenticateReachRequest,
  reachDisabledResponse,
  unauthorizedResponse,
} from '../../../../../../lib/reach/auth';
import { resolveContractEventActor } from '../../../../../../lib/reach/access';

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
  const eventActor = await resolveContractEventActor(auth, contract.initiatorId, contract.targetId);
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
    log.error('Request failed', { error });
    void captureException(error, { component: 'reach:contracts:transition POST' });
    return Response.json({ ok: false, error: 'Internal server error' }, { status: 500 });
  }
}
