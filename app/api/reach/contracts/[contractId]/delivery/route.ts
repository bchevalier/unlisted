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
import { resolveAuthz, hasPermission } from '../../../../../../lib/reach/permissions';

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

  const canAccess = await canAccessContract(
    auth,
    contract.initiatorId,
    contract.targetId,
    'CONTRACT_READ',
  );

  if (!canAccess) {
    return Response.json({ ok: false, error: 'Forbidden' }, { status: 403 });
  }

  const status = await getContractDeliveryStatus(contractId);
  if (!status) {
    return Response.json({ ok: false, error: 'Contract not found' }, { status: 404 });
  }

  return Response.json({ ok: true, ...status });
}

async function canAccessContract(
  auth: { actorId: string; actorType: string; userId: string | null },
  initiatorId: string,
  targetId: string,
  permission: 'CONTRACT_READ' | 'CONTRACT_ACT',
): Promise<boolean> {
  if (auth.actorId === initiatorId || auth.actorId === targetId) {
    return true;
  }

  const initiatorAuthz = await resolveAuthz(auth, initiatorId);
  if (initiatorAuthz && hasPermission(initiatorAuthz, permission)) {
    return true;
  }

  const targetAuthz = await resolveAuthz(auth, targetId);
  if (targetAuthz && hasPermission(targetAuthz, permission)) {
    return true;
  }

  return false;
}
