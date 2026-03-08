/**
 * Tests for shared contract access guards.
 *
 * Covers:
 *   - canAccessContract: direct party match + org membership fallback
 *   - resolveContractEventActor: maps caller to INITIATOR/TARGET audit label
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// ---------------------------------------------------------------------------
// Mock permissions module
// ---------------------------------------------------------------------------

const mockResolveAuthz = vi.fn();
const mockHasPermission = vi.fn();

vi.mock('./permissions', () => ({
  resolveAuthz: (...args: unknown[]) => mockResolveAuthz(...args),
  hasPermission: (...args: unknown[]) => mockHasPermission(...args),
}));

import { canAccessContract, resolveContractEventActor } from './access';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeAuth(actorId: string, actorType = 'HUMAN', userId: string | null = 'user-1') {
  return { actorId, actorType, userId };
}

// ---------------------------------------------------------------------------
// canAccessContract
// ---------------------------------------------------------------------------

describe('canAccessContract', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns true when caller is the initiator', async () => {
    const result = await canAccessContract(
      makeAuth('actor-init'),
      'actor-init',
      'actor-target',
      'CONTRACT_READ',
    );
    expect(result).toBe(true);
    // Should not check org membership.
    expect(mockResolveAuthz).not.toHaveBeenCalled();
  });

  it('returns true when caller is the target', async () => {
    const result = await canAccessContract(
      makeAuth('actor-target'),
      'actor-init',
      'actor-target',
      'CONTRACT_READ',
    );
    expect(result).toBe(true);
    expect(mockResolveAuthz).not.toHaveBeenCalled();
  });

  it('returns true when caller has org membership on initiator side', async () => {
    const authz = { permissions: new Set(['CONTRACT_READ']) };
    mockResolveAuthz.mockResolvedValueOnce(authz); // initiator side
    mockHasPermission.mockReturnValueOnce(true);

    const result = await canAccessContract(
      makeAuth('org-member'),
      'actor-init',
      'actor-target',
      'CONTRACT_READ',
    );
    expect(result).toBe(true);
    expect(mockResolveAuthz).toHaveBeenCalledTimes(1);
  });

  it('returns true when caller has org membership on target side', async () => {
    mockResolveAuthz.mockResolvedValueOnce(null); // initiator side — no access
    const authz = { permissions: new Set(['CONTRACT_READ']) };
    mockResolveAuthz.mockResolvedValueOnce(authz); // target side
    mockHasPermission.mockReturnValueOnce(true);

    const result = await canAccessContract(
      makeAuth('org-member'),
      'actor-init',
      'actor-target',
      'CONTRACT_READ',
    );
    expect(result).toBe(true);
    expect(mockResolveAuthz).toHaveBeenCalledTimes(2);
  });

  it('returns false when caller has no access', async () => {
    mockResolveAuthz.mockResolvedValueOnce(null); // initiator
    mockResolveAuthz.mockResolvedValueOnce(null); // target

    const result = await canAccessContract(
      makeAuth('stranger'),
      'actor-init',
      'actor-target',
      'CONTRACT_READ',
    );
    expect(result).toBe(false);
  });

  it('returns false when org membership exists but permission is missing', async () => {
    const authz = { permissions: new Set(['POLICY_READ']) };
    mockResolveAuthz.mockResolvedValueOnce(authz); // has authz but wrong perm
    mockHasPermission.mockReturnValueOnce(false);
    mockResolveAuthz.mockResolvedValueOnce(null); // target side

    const result = await canAccessContract(
      makeAuth('org-member'),
      'actor-init',
      'actor-target',
      'CONTRACT_ACT',
    );
    expect(result).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// resolveContractEventActor
// ---------------------------------------------------------------------------

describe('resolveContractEventActor', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns INITIATOR when caller is the initiator', async () => {
    const result = await resolveContractEventActor(
      makeAuth('actor-init'),
      'actor-init',
      'actor-target',
    );
    expect(result).toBe('INITIATOR');
  });

  it('returns TARGET when caller is the target', async () => {
    const result = await resolveContractEventActor(
      makeAuth('actor-target'),
      'actor-init',
      'actor-target',
    );
    expect(result).toBe('TARGET');
  });

  it('returns INITIATOR when caller has org membership on initiator side with CONTRACT_ACT', async () => {
    const authz = { permissions: new Set(['CONTRACT_ACT']) };
    mockResolveAuthz.mockResolvedValueOnce(authz);
    mockHasPermission.mockReturnValueOnce(true);

    const result = await resolveContractEventActor(
      makeAuth('org-member'),
      'actor-init',
      'actor-target',
    );
    expect(result).toBe('INITIATOR');
  });

  it('returns TARGET when caller has org membership on target side with CONTRACT_ACT', async () => {
    mockResolveAuthz.mockResolvedValueOnce(null); // initiator — no access
    const authz = { permissions: new Set(['CONTRACT_ACT']) };
    mockResolveAuthz.mockResolvedValueOnce(authz);
    mockHasPermission.mockReturnValueOnce(true);

    const result = await resolveContractEventActor(
      makeAuth('org-member'),
      'actor-init',
      'actor-target',
    );
    expect(result).toBe('TARGET');
  });

  it('returns null when caller has no write access', async () => {
    mockResolveAuthz.mockResolvedValueOnce(null);
    mockResolveAuthz.mockResolvedValueOnce(null);

    const result = await resolveContractEventActor(
      makeAuth('stranger'),
      'actor-init',
      'actor-target',
    );
    expect(result).toBeNull();
  });
});
