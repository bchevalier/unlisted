/**
 * GET /api/reach/contracts/:contractId/delivery — Get delivery status.
 *
 * Returns a unified delivery status combining contract event metadata
 * and webhook delivery records. Useful for debugging failed deliveries
 * and for operators to see which webhooks succeeded/failed.
 *
 * Auth required: caller must be initiator, target, or an org member of either
 * with CONTRACT_READ permission.
 */

import {
  getContract,
  getContractDeliveryStatus,
} from '../../../../../../lib/reach';
import {
  authenticateReachRequest,
  reachDisabledResponse,
  unauthorizedResponse,
} from '../../../../../../lib/reach/auth';
import { canAccessContract } from '../../../../../../lib/reach/access';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ contractId: string }> },
) {
  const blocked = reachDisabledResponse();
  if (blocked) return blocked;

  const auth = await authenticateReachRequest(request);
  if (!auth) return unauthorizedResponse();

  const { contractId } = await params;

  // Verify contract exists and caller has access.
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

  const status = await getContractDeliveryStatus(contractId);
  if (!status) {
    return Response.json({ ok: false, error: 'Contract not found' }, { status: 404 });
  }

  return Response.json({ ok: true, ...status });
}
