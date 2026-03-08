/**
 * Reach permission scopes and role-based access control.
 *
 * Defines what each actor role can do and provides guard helpers for
 * API routes. Permissions cascade through org membership:
 * an org member inherits scoped permissions based on their role.
 *
 * Permission model:
 *   - Direct actor (owns the actor) → full self-management permissions
 *   - Org OWNER → all permissions on the org actor
 *   - Org ADMIN → policy + contract + settings management
 *   - Org MEMBER → propose + read contracts, read policies
 */

import { db } from '../db';
import type { ReachAuthResult } from './auth';

// ---------------------------------------------------------------------------
// Permission enum (mirrors Prisma but usable without generated client)
// ---------------------------------------------------------------------------

export const REACH_PERMISSIONS = [
  'ACTOR_READ',
  'ACTOR_UPDATE',
  'ACTOR_DEACTIVATE',
  'KEY_ROTATE',
  'POLICY_READ',
  'POLICY_WRITE',
  'CONTRACT_PROPOSE',
  'CONTRACT_READ',
  'CONTRACT_ACT',
  'ORG_MEMBERS_READ',
  'ORG_MEMBERS_WRITE',
] as const;

export type ReachPermission = (typeof REACH_PERMISSIONS)[number];

// ---------------------------------------------------------------------------
// Org roles (mirrors Prisma enum)
// ---------------------------------------------------------------------------

export const REACH_ORG_ROLES = ['OWNER', 'ADMIN', 'MEMBER'] as const;
export type ReachOrgRole = (typeof REACH_ORG_ROLES)[number];

// ---------------------------------------------------------------------------
// Role → Permission mapping
// ---------------------------------------------------------------------------

/** Permissions granted to org members by role. */
const ORG_ROLE_PERMISSIONS: Record<ReachOrgRole, readonly ReachPermission[]> = {
  OWNER: [
    'ACTOR_READ',
    'ACTOR_UPDATE',
    'ACTOR_DEACTIVATE',
    'KEY_ROTATE',
    'POLICY_READ',
    'POLICY_WRITE',
    'CONTRACT_PROPOSE',
    'CONTRACT_READ',
    'CONTRACT_ACT',
    'ORG_MEMBERS_READ',
    'ORG_MEMBERS_WRITE',
  ],
  ADMIN: [
    'ACTOR_READ',
    'ACTOR_UPDATE',
    'POLICY_READ',
    'POLICY_WRITE',
    'CONTRACT_PROPOSE',
    'CONTRACT_READ',
    'CONTRACT_ACT',
    'ORG_MEMBERS_READ',
  ],
  MEMBER: [
    'ACTOR_READ',
    'POLICY_READ',
    'CONTRACT_PROPOSE',
    'CONTRACT_READ',
  ],
};

/** All permissions for direct actor self-access. */
const SELF_PERMISSIONS: readonly ReachPermission[] = [
  'ACTOR_READ',
  'ACTOR_UPDATE',
  'ACTOR_DEACTIVATE',
  'KEY_ROTATE',
  'POLICY_READ',
  'POLICY_WRITE',
  'CONTRACT_PROPOSE',
  'CONTRACT_READ',
  'CONTRACT_ACT',
];

// ---------------------------------------------------------------------------
// Authorization context
// ---------------------------------------------------------------------------

export interface AuthzContext {
  /** The authenticated actor making the request (may be the delegator if acting via delegation). */
  callerId: string;
  callerType: string;
  /** The target actor being acted upon. */
  targetActorId: string;
  /** Granted permissions for this caller on the target. */
  permissions: ReadonlySet<ReachPermission>;
  /** If the caller is acting via org membership, the role. */
  orgRole?: ReachOrgRole;
  /** Whether the caller is acting on their own actor (direct access). */
  isSelf: boolean;
  /** When acting via X-Reach-Act-As delegation, the original actor ID (for audit). */
  delegatorActorId?: string;
}

/**
 * Resolve the authorization context for a caller acting on a target actor.
 *
 * Checks:
 *   1. Direct ownership (caller is the target actor)
 *   2. Delegation (caller is acting on behalf of an org via X-Reach-Act-As)
 *   3. Org membership (caller is a member of the target org)
 *
 * Scoped API keys: if the auth result has non-empty apiKeyScopes, the
 * effective permissions are intersected with those scopes.
 *
 * Returns null if the caller has no relationship to the target.
 */
export async function resolveAuthz(
  auth: ReachAuthResult,
  targetActorId: string,
): Promise<AuthzContext | null> {
  let authz: AuthzContext | null = null;

  // 1. Direct self-access (including delegation — if acting as the org, actorId is already the org).
  if (auth.actorId === targetActorId) {
    // When delegating, resolve permissions via the delegator's org membership role.
    if (auth.delegatorActorId) {
      const membership = await db.reachOrgMember.findUnique({
        where: {
          orgId_memberId: {
            orgId: targetActorId,
            memberId: auth.delegatorActorId,
          },
        },
        select: { role: true, isActive: true },
      });

      if (membership && membership.isActive) {
        const role = membership.role as ReachOrgRole;
        authz = {
          callerId: auth.delegatorActorId,
          callerType: auth.delegatorActorType ?? auth.actorType,
          targetActorId,
          permissions: new Set(ORG_ROLE_PERMISSIONS[role]),
          orgRole: role,
          isSelf: false,
          delegatorActorId: auth.delegatorActorId,
        };
      }
    } else {
      authz = {
        callerId: auth.actorId,
        callerType: auth.actorType,
        targetActorId,
        permissions: new Set(SELF_PERMISSIONS),
        isSelf: true,
      };
    }
  }

  // 2. Org membership: check if the target is an ORGANIZATION and caller is a member.
  if (!authz) {
    const lookupMemberId = auth.delegatorActorId ?? auth.actorId;
    const membership = await db.reachOrgMember.findUnique({
      where: {
        orgId_memberId: {
          orgId: targetActorId,
          memberId: lookupMemberId,
        },
      },
      select: { role: true, isActive: true },
    });

    if (membership && membership.isActive) {
      const role = membership.role as ReachOrgRole;
      authz = {
        callerId: lookupMemberId,
        callerType: auth.delegatorActorType ?? auth.actorType,
        targetActorId,
        permissions: new Set(ORG_ROLE_PERMISSIONS[role]),
        orgRole: role,
        isSelf: false,
        ...(auth.delegatorActorId ? { delegatorActorId: auth.delegatorActorId } : {}),
      };
    }
  }

  if (!authz) return null;

  // 3. Enforce scoped API key restrictions.
  if (auth.apiKeyScopes && auth.apiKeyScopes.length > 0) {
    const scopeSet = new Set<string>(auth.apiKeyScopes);
    const restricted = new Set<ReachPermission>();
    for (const perm of authz.permissions) {
      if (scopeSet.has(perm)) {
        restricted.add(perm);
      }
    }
    authz = { ...authz, permissions: restricted };
  }

  return authz;
}

/**
 * Check whether an authz context has a specific permission.
 */
export function hasPermission(
  authz: AuthzContext,
  permission: ReachPermission,
): boolean {
  return authz.permissions.has(permission);
}

/**
 * Require a permission, returning a 403 Response if denied.
 * Returns null if permitted (caller should proceed).
 */
export function requirePermission(
  authz: AuthzContext | null,
  permission: ReachPermission,
): Response | null {
  if (!authz) {
    return Response.json(
      { ok: false, error: 'Forbidden: no access to this actor' },
      { status: 403 },
    );
  }
  if (!hasPermission(authz, permission)) {
    return Response.json(
      { ok: false, error: `Forbidden: missing permission ${permission}` },
      { status: 403 },
    );
  }
  return null;
}

/**
 * Get permissions for an org role (useful for API responses).
 */
export function getPermissionsForRole(role: ReachOrgRole): readonly ReachPermission[] {
  return ORG_ROLE_PERMISSIONS[role];
}
