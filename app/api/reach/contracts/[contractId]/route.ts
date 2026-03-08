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
import { resolveAuthz, hasPermission } from '../../../../../lib/reach/permissions';

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

  // Check access: direct party match OR org membership on either side.
  const canAccess = await canAccessContract(
    auth,
    contract.initiatorId,
    contract.targetId,
    'CONTRACT_READ',
  );

  if (!canAccess) {
    return Response.json({ ok: false, error: 'Forbidden' }, { status: 403 });
  }

  return Response.json({ ok: true, contract });
}

/**
 * Check if the authenticated caller can access a contract via direct ownership
 * or org membership on either the initiator or target side.
 */
async function canAccessContract(
  auth: { actorId: string; actorType: string; userId: string | null },
  initiatorId: string,
  targetId: string,
  permission: 'CONTRACT_READ' | 'CONTRACT_ACT',
): Promise<boolean> {
  // Direct party match.
  if (auth.actorId === initiatorId || auth.actorId === targetId) {
    return true;
  }

  // Org membership on initiator side.
  const initiatorAuthz = await resolveAuthz(auth, initiatorId);
  if (initiatorAuthz && hasPermission(initiatorAuthz, permission)) {
    return true;
  }

  // Org membership on target side.
  const targetAuthz = await resolveAuthz(auth, targetId);
  if (targetAuthz && hasPermission(targetAuthz, permission)) {
    return true;
  }

  return false;
}
