/**
 * GET /api/reach/contracts/:contractId — Get contract detail with events.
 *
 * Auth required: caller must be initiator, target, or an org member of either
 * with CONTRACT_READ permission.
 */

import { getContract } from '../../../../../lib/reach';
import {
  authenticateReachRequest,
  reachDisabledResponse,
  unauthorizedResponse,
} from '../../../../../lib/reach/auth';
import { canAccessContract } from '../../../../../lib/reach/access';

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

  const hasAccess = await canAccessContract(
    auth,
    contract.initiatorId,
    contract.targetId,
    'CONTRACT_READ',
  );

  if (!hasAccess) {
    return Response.json({ ok: false, error: 'Forbidden' }, { status: 403 });
  }

  return Response.json({ ok: true, contract });
}
