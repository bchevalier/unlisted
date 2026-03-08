/**
 * Shared contract access guards for Reach API routes.
 *
 * Extracted from individual route handlers to avoid duplication and
 * ensure consistent access control across all contract-scoped endpoints.
 */

import type { ReachAuthResult } from './auth';
import { resolveAuthz, hasPermission } from './permissions';
import type { ReachPermission } from './permissions';

/**
 * Check if the authenticated caller can access a contract via direct ownership
 * or org membership on either the initiator or target side.
 *
 * @param auth          – authenticated caller identity
 * @param initiatorId   – the contract's initiator actor ID
 * @param targetId      – the contract's target actor ID
 * @param permission    – the required permission (CONTRACT_READ or CONTRACT_ACT)
 * @returns true if the caller has access
 */
export async function canAccessContract(
  auth: Pick<ReachAuthResult, 'actorId' | 'actorType' | 'userId'>,
  initiatorId: string,
  targetId: string,
  permission: Extract<ReachPermission, 'CONTRACT_READ' | 'CONTRACT_ACT'>,
): Promise<boolean> {
  // Direct party match.
  if (auth.actorId === initiatorId || auth.actorId === targetId) {
    return true;
  }

  // Org membership on initiator side.
  const initiatorAuthz = await resolveAuthz(auth as ReachAuthResult, initiatorId);
  if (initiatorAuthz && hasPermission(initiatorAuthz, permission)) {
    return true;
  }

  // Org membership on target side.
  const targetAuthz = await resolveAuthz(auth as ReachAuthResult, targetId);
  if (targetAuthz && hasPermission(targetAuthz, permission)) {
    return true;
  }

  return false;
}

/**
 * Resolve the event actor label for audit trail purposes.
 *
 * Returns INITIATOR or TARGET based on direct match or org membership with CONTRACT_ACT.
 * Returns null if the caller has no write access to the contract.
 */
export async function resolveContractEventActor(
  auth: Pick<ReachAuthResult, 'actorId' | 'actorType' | 'userId'>,
  initiatorId: string,
  targetId: string,
): Promise<'INITIATOR' | 'TARGET' | null> {
  // Direct match.
  if (auth.actorId === initiatorId) return 'INITIATOR';
  if (auth.actorId === targetId) return 'TARGET';

  // Org membership on initiator side.
  const initiatorAuthz = await resolveAuthz(auth as ReachAuthResult, initiatorId);
  if (initiatorAuthz && hasPermission(initiatorAuthz, 'CONTRACT_ACT')) {
    return 'INITIATOR';
  }

  // Org membership on target side.
  const targetAuthz = await resolveAuthz(auth as ReachAuthResult, targetId);
  if (targetAuthz && hasPermission(targetAuthz, 'CONTRACT_ACT')) {
    return 'TARGET';
  }

  return null;
}
