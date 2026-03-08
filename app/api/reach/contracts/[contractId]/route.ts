/**
 * GET /api/reach/contracts/:contractId — Get contract detail with events.
 *
 * Auth required: caller must be initiator or target of the contract.
 */

import { getContract } from '../../../../../lib/reach';
import {
  authenticateReachRequest,
  reachDisabledResponse,
  unauthorizedResponse,
} from '../../../../../lib/reach/auth';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ contractId: string }> },
) {
  const blocked = reachDisabledResponse();
  if (blocked) return blocked;

  const auth = await authenticateReachRequest(request);
  if (!auth) return unauthorizedResponse();

  const { contractId } = await params;
  const contract = await getContract(contractId);

  if (!contract) {
    return Response.json({ ok: false, error: 'Contract not found' }, { status: 404 });
  }

  // Only parties to the contract can view it.
  if (contract.initiatorId !== auth.actorId && contract.targetId !== auth.actorId) {
    return Response.json({ ok: false, error: 'Forbidden' }, { status: 403 });
  }

  return Response.json({ ok: true, contract });
}
