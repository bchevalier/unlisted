import { describe, it, expect } from 'vitest';
import {
  hasPermission,
  requirePermission,
  getPermissionsForRole,
  REACH_PERMISSIONS,
  REACH_ORG_ROLES,
} from './permissions';
import type { AuthzContext, ReachPermission, ReachOrgRole } from './permissions';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeSelfAuthz(overrides?: Partial<AuthzContext>): AuthzContext {
  return {
    callerId: 'actor-1',
    callerType: 'HUMAN',
    targetActorId: 'actor-1',
    permissions: new Set<ReachPermission>([
      'ACTOR_READ',
      'ACTOR_UPDATE',
      'ACTOR_DEACTIVATE',
      'KEY_ROTATE',
      'POLICY_READ',
      'POLICY_WRITE',
      'CONTRACT_PROPOSE',
      'CONTRACT_READ',
      'CONTRACT_ACT',
    ]),
    isSelf: true,
    ...overrides,
  };
}

function makeOrgAuthz(role: ReachOrgRole): AuthzContext {
  return {
    callerId: 'member-1',
    callerType: 'HUMAN',
    targetActorId: 'org-1',
    permissions: new Set<ReachPermission>(getPermissionsForRole(role)),
    orgRole: role,
    isSelf: false,
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('REACH_PERMISSIONS', () => {
  it('contains all expected permissions', () => {
    expect(REACH_PERMISSIONS).toContain('ACTOR_READ');
    expect(REACH_PERMISSIONS).toContain('ORG_MEMBERS_WRITE');
    expect(REACH_PERMISSIONS.length).toBe(11);
  });
});

describe('REACH_ORG_ROLES', () => {
  it('contains OWNER, ADMIN, MEMBER', () => {
    expect(REACH_ORG_ROLES).toEqual(['OWNER', 'ADMIN', 'MEMBER']);
  });
});

describe('hasPermission', () => {
  it('returns true for self-access with owned permission', () => {
    const authz = makeSelfAuthz();
    expect(hasPermission(authz, 'ACTOR_READ')).toBe(true);
    expect(hasPermission(authz, 'POLICY_WRITE')).toBe(true);
    expect(hasPermission(authz, 'CONTRACT_ACT')).toBe(true);
  });

  it('returns false for self-access missing org permissions', () => {
    const authz = makeSelfAuthz();
    expect(hasPermission(authz, 'ORG_MEMBERS_READ')).toBe(false);
    expect(hasPermission(authz, 'ORG_MEMBERS_WRITE')).toBe(false);
  });

  it('org OWNER has all permissions', () => {
    const authz = makeOrgAuthz('OWNER');
    for (const perm of REACH_PERMISSIONS) {
      expect(hasPermission(authz, perm)).toBe(true);
    }
  });

  it('org ADMIN has read/write but not deactivate or key rotate or member write', () => {
    const authz = makeOrgAuthz('ADMIN');
    expect(hasPermission(authz, 'ACTOR_READ')).toBe(true);
    expect(hasPermission(authz, 'ACTOR_UPDATE')).toBe(true);
    expect(hasPermission(authz, 'POLICY_WRITE')).toBe(true);
    expect(hasPermission(authz, 'CONTRACT_ACT')).toBe(true);
    expect(hasPermission(authz, 'ORG_MEMBERS_READ')).toBe(true);
    // Denied for ADMIN:
    expect(hasPermission(authz, 'ACTOR_DEACTIVATE')).toBe(false);
    expect(hasPermission(authz, 'KEY_ROTATE')).toBe(false);
    expect(hasPermission(authz, 'ORG_MEMBERS_WRITE')).toBe(false);
  });

  it('org MEMBER has read-only + propose', () => {
    const authz = makeOrgAuthz('MEMBER');
    expect(hasPermission(authz, 'ACTOR_READ')).toBe(true);
    expect(hasPermission(authz, 'POLICY_READ')).toBe(true);
    expect(hasPermission(authz, 'CONTRACT_PROPOSE')).toBe(true);
    expect(hasPermission(authz, 'CONTRACT_READ')).toBe(true);
    // Denied for MEMBER:
    expect(hasPermission(authz, 'ACTOR_UPDATE')).toBe(false);
    expect(hasPermission(authz, 'POLICY_WRITE')).toBe(false);
    expect(hasPermission(authz, 'CONTRACT_ACT')).toBe(false);
    expect(hasPermission(authz, 'ORG_MEMBERS_READ')).toBe(false);
    expect(hasPermission(authz, 'ORG_MEMBERS_WRITE')).toBe(false);
  });
});

describe('requirePermission', () => {
  it('returns null when permission is granted', () => {
    const authz = makeSelfAuthz();
    expect(requirePermission(authz, 'ACTOR_READ')).toBeNull();
  });

  it('returns 403 when authz is null', async () => {
    const response = requirePermission(null, 'ACTOR_READ');
    expect(response).not.toBeNull();
    expect(response!.status).toBe(403);
    const body = await response!.json();
    expect(body.error).toContain('no access');
  });

  it('returns 403 with missing permission detail', async () => {
    const authz = makeOrgAuthz('MEMBER');
    const response = requirePermission(authz, 'POLICY_WRITE');
    expect(response).not.toBeNull();
    expect(response!.status).toBe(403);
    const body = await response!.json();
    expect(body.error).toContain('POLICY_WRITE');
  });
});

describe('getPermissionsForRole', () => {
  it('OWNER gets all 11 permissions', () => {
    expect(getPermissionsForRole('OWNER').length).toBe(11);
  });

  it('ADMIN gets 8 permissions', () => {
    expect(getPermissionsForRole('ADMIN').length).toBe(8);
  });

  it('MEMBER gets 4 permissions', () => {
    expect(getPermissionsForRole('MEMBER').length).toBe(4);
  });

  it('role permissions are subsets of higher roles', () => {
    const memberPerms = new Set(getPermissionsForRole('MEMBER'));
    const adminPerms = new Set(getPermissionsForRole('ADMIN'));
    const ownerPerms = new Set(getPermissionsForRole('OWNER'));

    for (const p of memberPerms) {
      expect(adminPerms.has(p)).toBe(true);
    }
    for (const p of adminPerms) {
      expect(ownerPerms.has(p)).toBe(true);
    }
  });
});
