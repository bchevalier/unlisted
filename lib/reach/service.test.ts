/**
 * Unit tests for Reach service layer — DB-backed operations.
 *
 * Tests proposeContract, fulfillContract, deactivateActorWithCascade, and
 * expireStaleContracts (batch variant). All DB interactions are mocked.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// ---------------------------------------------------------------------------
// Mock DB
// ---------------------------------------------------------------------------

const mockFns = vi.hoisted(() => ({
  reachActor: {
    findUnique: vi.fn(),
    update: vi.fn(),
  },
  reachContract: {
    findUnique: vi.fn(),
    findMany: vi.fn(),
    update: vi.fn(),
    updateMany: vi.fn(),
    count: vi.fn(),
    create: vi.fn(),
  },
  reachContractEvent: {
    create: vi.fn(),
    createMany: vi.fn(),
  },
  reachPolicy: {
    findMany: vi.fn(),
  },
  reachBlockedActor: {
    findUnique: vi.fn(),
  },
  $transaction: vi.fn(),
}));

vi.mock('../db', () => ({
  db: {
    ...mockFns,
    $transaction: mockFns.$transaction,
  },
}));

// Mock webhook dispatch (fire-and-forget, don't need real behavior)
vi.mock('./webhooks', () => ({
  dispatchWebhookEvent: vi.fn().mockResolvedValue(undefined),
}));

// Mock router dispatch
vi.mock('./router', () => ({
  dispatchContract: vi.fn().mockResolvedValue(undefined),
}));

// Mock safety module — we want to control blocklist/rate-limit behavior per test
const mockSafety = vi.hoisted(() => ({
  isBlocked: vi.fn().mockResolvedValue(false),
  enforceActorRateLimit: vi.fn().mockResolvedValue(undefined),
  enforcePairCooldown: vi.fn().mockResolvedValue(undefined),
  ReachSafetyError: class ReachSafetyError extends Error {
    code: string;
    statusCode: number;
    constructor(message: string, code: string, statusCode = 400) {
      super(message);
      this.name = 'ReachSafetyError';
      this.code = code;
      this.statusCode = statusCode;
    }
  },
}));

vi.mock('./safety', () => mockSafety);

import {
  proposeContract,
  fulfillContract,
  deactivateActorWithCascade,
  expireStaleContracts,
  ReachError,
} from './service';

// ---------------------------------------------------------------------------
// Helpers — proposeContract
// ---------------------------------------------------------------------------

function makeActorRecord(overrides: Record<string, unknown> = {}) {
  return {
    id: 'actor-init',
    type: 'HUMAN',
    handle: 'alice',
    displayName: 'Alice',
    isActive: true,
    userId: 'user-1',
    ...overrides,
  };
}

function makeTargetRecord(overrides: Record<string, unknown> = {}) {
  return {
    id: 'actor-target',
    type: 'HUMAN',
    handle: 'bob',
    displayName: 'Bob',
    isActive: true,
    userId: 'user-2',
    ...overrides,
  };
}

/**
 * Set up standard mocks for a successful proposeContract call.
 * Returns the created contract object and allows customizing policy behavior.
 */
function setupProposeDefaults(opts: {
  initiator?: Record<string, unknown>;
  target?: Record<string, unknown>;
  policies?: Record<string, unknown>[];
  weeklyCount?: number;
} = {}) {
  const initiator = makeActorRecord(opts.initiator);
  const target = makeTargetRecord(opts.target);

  // findUnique calls: first for initiator (by id), second for target (by handle)
  mockFns.reachActor.findUnique
    .mockResolvedValueOnce(initiator)  // initiatorId lookup
    .mockResolvedValueOnce(target);    // targetHandle lookup

  // Safety mocks default to pass-through (set in vi.mock above)
  mockSafety.isBlocked.mockResolvedValue(false);
  mockSafety.enforceActorRateLimit.mockResolvedValue(undefined);
  mockSafety.enforcePairCooldown.mockResolvedValue(undefined);

  // Policies
  const defaultPolicies = opts.policies ?? [
    {
      id: 'pol-1',
      isActive: true,
      contractTypes: ['HUMAN_HUMAN'],
      action: 'ACCEPT',
      maxWeeklyInbound: null,
      requireVerifiedSender: false,
      autoAcceptMatching: false,
      escalateToHuman: false,
      filters: null,
      priority: 0,
    },
  ];
  mockFns.reachPolicy.findMany.mockResolvedValue(defaultPolicies);

  // Weekly count
  mockFns.reachContract.count.mockResolvedValue(opts.weeklyCount ?? 0);

  // Transaction — execute the callback with mock tx objects
  const createdContract = {
    id: 'contract-1',
    type: 'HUMAN_HUMAN',
    status: 'PROPOSED',
    initiatorId: initiator.id,
    targetId: target.id,
    purpose: 'Test purpose',
    message: null,
    structuredData: null,
    expiresAt: null,
    createdAt: new Date(),
    routedAt: null,
    resolvedAt: null,
    policyId: 'pol-1',
  };

  mockFns.$transaction.mockImplementation(async (cb: (tx: unknown) => unknown) => {
    const tx = {
      reachContract: {
        create: vi.fn().mockResolvedValue(createdContract),
        update: vi.fn().mockImplementation(async ({ data }: { data: Record<string, unknown> }) => ({
          ...createdContract,
          ...data,
        })),
      },
      reachContractEvent: {
        create: vi.fn().mockResolvedValue({}),
      },
    };
    return cb(tx);
  });

  return { initiator, target, createdContract };
}

// ---------------------------------------------------------------------------
// proposeContract
// ---------------------------------------------------------------------------

describe('proposeContract', () => {
  beforeEach(() => vi.clearAllMocks());

  // --- Input validation ---

  it('rejects when initiator is not found', async () => {
    mockFns.reachActor.findUnique
      .mockResolvedValueOnce(null) // initiator
      .mockResolvedValueOnce(makeTargetRecord());

    await expect(
      proposeContract('missing-actor', {
        type: 'HUMAN_HUMAN',
        targetHandle: 'bob',
        purpose: 'Test',
      }),
    ).rejects.toThrow('Initiator not found');
  });

  it('rejects when initiator is inactive', async () => {
    mockFns.reachActor.findUnique
      .mockResolvedValueOnce(makeActorRecord({ isActive: false }))
      .mockResolvedValueOnce(makeTargetRecord());

    await expect(
      proposeContract('actor-init', {
        type: 'HUMAN_HUMAN',
        targetHandle: 'bob',
        purpose: 'Test',
      }),
    ).rejects.toThrow('not active');
  });

  it('rejects when target is not found', async () => {
    mockFns.reachActor.findUnique
      .mockResolvedValueOnce(makeActorRecord())
      .mockResolvedValueOnce(null);

    await expect(
      proposeContract('actor-init', {
        type: 'HUMAN_HUMAN',
        targetHandle: 'nobody',
        purpose: 'Test',
      }),
    ).rejects.toThrow('Target not found');
  });

  it('rejects when target is inactive', async () => {
    mockFns.reachActor.findUnique
      .mockResolvedValueOnce(makeActorRecord())
      .mockResolvedValueOnce(makeTargetRecord({ isActive: false }));

    await expect(
      proposeContract('actor-init', {
        type: 'HUMAN_HUMAN',
        targetHandle: 'bob',
        purpose: 'Test',
      }),
    ).rejects.toThrow('not active');
  });

  it('rejects self-reach (initiator === target)', async () => {
    const actor = makeActorRecord({ id: 'same-id', handle: 'alice' });
    mockFns.reachActor.findUnique
      .mockResolvedValueOnce(actor)
      .mockResolvedValueOnce(actor);

    await expect(
      proposeContract('same-id', {
        type: 'HUMAN_HUMAN',
        targetHandle: 'alice',
        purpose: 'Test',
      }),
    ).rejects.toThrow('Cannot reach yourself');
  });

  it('rejects incompatible actor types for contract type', async () => {
    mockFns.reachActor.findUnique
      .mockResolvedValueOnce(makeActorRecord({ type: 'HUMAN' }))
      .mockResolvedValueOnce(makeTargetRecord({ type: 'HUMAN' }));

    mockSafety.isBlocked.mockResolvedValue(false);
    mockSafety.enforceActorRateLimit.mockResolvedValue(undefined);
    mockSafety.enforcePairCooldown.mockResolvedValue(undefined);

    await expect(
      proposeContract('actor-init', {
        type: 'AI_AI', // needs AI_AGENT actors
        targetHandle: 'bob',
        purpose: 'Test',
      }),
    ).rejects.toThrow('incompatible');
  });

  // --- Safety checks ---

  it('rejects when target has blocked the initiator', async () => {
    mockFns.reachActor.findUnique
      .mockResolvedValueOnce(makeActorRecord())
      .mockResolvedValueOnce(makeTargetRecord());

    mockSafety.isBlocked.mockResolvedValue(true);

    await expect(
      proposeContract('actor-init', {
        type: 'HUMAN_HUMAN',
        targetHandle: 'bob',
        purpose: 'Test',
      }),
    ).rejects.toThrow('blocked');
  });

  it('rejects when actor rate limit is exceeded', async () => {
    mockFns.reachActor.findUnique
      .mockResolvedValueOnce(makeActorRecord())
      .mockResolvedValueOnce(makeTargetRecord());

    mockSafety.isBlocked.mockResolvedValue(false);
    mockSafety.enforceActorRateLimit.mockRejectedValue(
      new mockSafety.ReachSafetyError('Rate limit exceeded', 'ACTOR_RATE_LIMIT', 429),
    );

    await expect(
      proposeContract('actor-init', {
        type: 'HUMAN_HUMAN',
        targetHandle: 'bob',
        purpose: 'Test',
      }),
    ).rejects.toThrow('Rate limit exceeded');
  });

  it('rejects when pair cooldown is active', async () => {
    mockFns.reachActor.findUnique
      .mockResolvedValueOnce(makeActorRecord())
      .mockResolvedValueOnce(makeTargetRecord());

    mockSafety.isBlocked.mockResolvedValue(false);
    mockSafety.enforceActorRateLimit.mockResolvedValue(undefined);
    mockSafety.enforcePairCooldown.mockRejectedValue(
      new mockSafety.ReachSafetyError('Please wait', 'PAIR_COOLDOWN', 429),
    );

    await expect(
      proposeContract('actor-init', {
        type: 'HUMAN_HUMAN',
        targetHandle: 'bob',
        purpose: 'Test',
      }),
    ).rejects.toThrow('Please wait');
  });

  // --- Policy evaluation ---

  it('rejects when no active policies exist for the target', async () => {
    setupProposeDefaults({
      policies: [{ id: 'pol-1', isActive: false, contractTypes: ['HUMAN_HUMAN'], action: 'ACCEPT', maxWeeklyInbound: null, requireVerifiedSender: false, autoAcceptMatching: false, escalateToHuman: false, filters: null, priority: 0 }],
    });

    await expect(
      proposeContract('actor-init', {
        type: 'HUMAN_HUMAN',
        targetHandle: 'bob',
        purpose: 'Test purpose',
      }),
    ).rejects.toThrow('not accepted');
  });

  it('rejects when weekly cap is exceeded', async () => {
    setupProposeDefaults({
      policies: [{
        id: 'pol-1',
        isActive: true,
        contractTypes: ['HUMAN_HUMAN'],
        action: 'ACCEPT',
        maxWeeklyInbound: 5,
        requireVerifiedSender: false,
        autoAcceptMatching: false,
        escalateToHuman: false,
        filters: null,
        priority: 0,
      }],
      weeklyCount: 10,
    });

    await expect(
      proposeContract('actor-init', {
        type: 'HUMAN_HUMAN',
        targetHandle: 'bob',
        purpose: 'Test purpose',
      }),
    ).rejects.toThrow('not accepted');
  });

  // --- Happy paths ---

  it('creates a PROPOSED contract when policy matches (no auto-accept)', async () => {
    const { createdContract } = setupProposeDefaults();

    const result = await proposeContract('actor-init', {
      type: 'HUMAN_HUMAN',
      targetHandle: 'bob',
      purpose: 'Test purpose',
    });

    expect(result.id).toBe(createdContract.id);
    expect(result.status).toBe('PROPOSED');
    // Transaction was called
    expect(mockFns.$transaction).toHaveBeenCalledOnce();
  });

  it('auto-accepts contract when policy has autoAcceptMatching + ACCEPT action', async () => {
    setupProposeDefaults({
      policies: [{
        id: 'pol-auto',
        isActive: true,
        contractTypes: ['HUMAN_HUMAN'],
        action: 'ACCEPT',
        maxWeeklyInbound: null,
        requireVerifiedSender: false,
        autoAcceptMatching: true,
        escalateToHuman: false,
        filters: null,
        priority: 0,
      }],
    });

    const result = await proposeContract('actor-init', {
      type: 'HUMAN_HUMAN',
      targetHandle: 'bob',
      purpose: 'Test purpose',
    });

    // Auto-accepted → status should be ACTIVE
    expect(result.status).toBe('ACTIVE');
    expect(result.routedAt).toBeInstanceOf(Date);
  });

  it('routes contract when policy action is ROUTE', async () => {
    setupProposeDefaults({
      policies: [{
        id: 'pol-route',
        isActive: true,
        contractTypes: ['HUMAN_HUMAN'],
        action: 'ROUTE',
        maxWeeklyInbound: null,
        requireVerifiedSender: false,
        autoAcceptMatching: false,
        escalateToHuman: false,
        filters: null,
        priority: 0,
      }],
    });

    const result = await proposeContract('actor-init', {
      type: 'HUMAN_HUMAN',
      targetHandle: 'bob',
      purpose: 'Test purpose',
    });

    // Routed → still PROPOSED but with routedAt set
    expect(result.routedAt).toBeInstanceOf(Date);
  });

  it('escalates contract when policy has escalateToHuman', async () => {
    setupProposeDefaults({
      policies: [{
        id: 'pol-escalate',
        isActive: true,
        contractTypes: ['HUMAN_HUMAN'],
        action: 'ACCEPT',
        maxWeeklyInbound: null,
        requireVerifiedSender: false,
        autoAcceptMatching: false,
        escalateToHuman: true,
        filters: null,
        priority: 0,
      }],
    });

    const result = await proposeContract('actor-init', {
      type: 'HUMAN_HUMAN',
      targetHandle: 'bob',
      purpose: 'Test purpose',
    });

    // Escalated → routedAt should be set
    expect(result.routedAt).toBeInstanceOf(Date);
  });

  it('rejects at the gate when policy action is REJECT', async () => {
    setupProposeDefaults({
      policies: [{
        id: 'pol-reject',
        isActive: true,
        contractTypes: ['HUMAN_HUMAN'],
        action: 'REJECT',
        maxWeeklyInbound: null,
        requireVerifiedSender: false,
        autoAcceptMatching: false,
        escalateToHuman: false,
        filters: null,
        priority: 0,
      }],
    });

    const result = await proposeContract('actor-init', {
      type: 'HUMAN_HUMAN',
      targetHandle: 'bob',
      purpose: 'Test purpose',
    });

    // Rejected by policy → REJECTED status with resolvedAt
    expect(result.status).toBe('REJECTED');
    expect(result.resolvedAt).toBeInstanceOf(Date);
  });

  // --- Expiry ---

  it('computes expiresAt from expiresInHours', async () => {
    const { createdContract } = setupProposeDefaults();

    // Override transaction to capture the create call's expiresAt
    let capturedExpiresAt: Date | null = null;
    mockFns.$transaction.mockImplementation(async (cb: (tx: unknown) => unknown) => {
      const tx = {
        reachContract: {
          create: vi.fn().mockImplementation(async ({ data }: { data: { expiresAt: Date | null } }) => {
            capturedExpiresAt = data.expiresAt;
            return { ...createdContract, expiresAt: data.expiresAt };
          }),
          update: vi.fn().mockResolvedValue(createdContract),
        },
        reachContractEvent: {
          create: vi.fn().mockResolvedValue({}),
        },
      };
      return cb(tx);
    });

    const before = Date.now();
    await proposeContract('actor-init', {
      type: 'HUMAN_HUMAN',
      targetHandle: 'bob',
      purpose: 'Test purpose',
      expiresInHours: 48,
    });
    const after = Date.now();

    expect(capturedExpiresAt).toBeInstanceOf(Date);
    const expectedMin = before + 48 * 60 * 60 * 1000;
    const expectedMax = after + 48 * 60 * 60 * 1000;
    expect(capturedExpiresAt!.getTime()).toBeGreaterThanOrEqual(expectedMin);
    expect(capturedExpiresAt!.getTime()).toBeLessThanOrEqual(expectedMax);
  });

  // --- Dispatch & webhook fire ---

  it('dispatches delivery for auto-accepted contracts', async () => {
    const { dispatchContract } = await import('./router');

    setupProposeDefaults({
      policies: [{
        id: 'pol-auto',
        isActive: true,
        contractTypes: ['HUMAN_HUMAN'],
        action: 'ACCEPT',
        maxWeeklyInbound: null,
        requireVerifiedSender: false,
        autoAcceptMatching: true,
        escalateToHuman: false,
        filters: null,
        priority: 0,
      }],
    });

    await proposeContract('actor-init', {
      type: 'HUMAN_HUMAN',
      targetHandle: 'bob',
      purpose: 'Test',
    });

    // dispatchContract should have been called
    expect(dispatchContract).toHaveBeenCalledWith('contract-1', 'ACCEPT');
  });

  it('does not dispatch delivery for policy-rejected contracts', async () => {
    const { dispatchContract } = await import('./router');

    setupProposeDefaults({
      policies: [{
        id: 'pol-reject',
        isActive: true,
        contractTypes: ['HUMAN_HUMAN'],
        action: 'REJECT',
        maxWeeklyInbound: null,
        requireVerifiedSender: false,
        autoAcceptMatching: false,
        escalateToHuman: false,
        filters: null,
        priority: 0,
      }],
    });

    await proposeContract('actor-init', {
      type: 'HUMAN_HUMAN',
      targetHandle: 'bob',
      purpose: 'Test',
    });

    // dispatchContract should NOT have been called
    expect(dispatchContract).not.toHaveBeenCalled();
  });

  it('fires webhook event for the target actor', async () => {
    const { dispatchWebhookEvent } = await import('./webhooks');

    setupProposeDefaults();

    await proposeContract('actor-init', {
      type: 'HUMAN_HUMAN',
      targetHandle: 'bob',
      purpose: 'Test',
    });

    // dispatchWebhookEvent should have been called with target actor ID
    expect(dispatchWebhookEvent).toHaveBeenCalledWith(
      'contract-1',
      expect.any(String),
      'actor-target',
    );
  });

  // --- Zod validation ---

  it('rejects invalid input (empty purpose)', async () => {
    await expect(
      proposeContract('actor-init', {
        type: 'HUMAN_HUMAN',
        targetHandle: 'bob',
        purpose: '', // invalid
      }),
    ).rejects.toThrow();
  });

  it('rejects invalid input (expiresInHours > 720)', async () => {
    await expect(
      proposeContract('actor-init', {
        type: 'HUMAN_HUMAN',
        targetHandle: 'bob',
        purpose: 'Test',
        expiresInHours: 800,
      }),
    ).rejects.toThrow();
  });
});

// ---------------------------------------------------------------------------
// fulfillContract
// ---------------------------------------------------------------------------

describe('fulfillContract', () => {
  beforeEach(() => vi.clearAllMocks());

  it('fulfills an ACTIVE contract with response data', async () => {
    mockFns.reachContract.findUnique.mockResolvedValue({
      id: 'c-1',
      status: 'ACTIVE',
      targetId: 'actor-target',
    });

    const mockUpdated = { id: 'c-1', status: 'FULFILLED', responseData: { answer: 42 } };

    // $transaction executes the callback
    mockFns.$transaction.mockImplementation(async (cb: (...args: unknown[]) => unknown) => {
      mockFns.reachContract.update.mockResolvedValue(mockUpdated);
      mockFns.reachContractEvent.create.mockResolvedValue({});
      return cb({
        reachContract: { update: mockFns.reachContract.update },
        reachContractEvent: { create: mockFns.reachContractEvent.create },
      });
    });

    const result = await fulfillContract('c-1', 'actor-target', { answer: 42 }, 'Done');
    expect(result.status).toBe('FULFILLED');

    // Verify update was called with responseData
    const updateCall = mockFns.reachContract.update.mock.calls[0][0];
    expect(updateCall.data.status).toBe('FULFILLED');
    expect(updateCall.data.resolvedAt).toBeInstanceOf(Date);
    expect(updateCall.data.responseData).toEqual({ answer: 42 });

    // Verify event was created
    const eventCall = mockFns.reachContractEvent.create.mock.calls[0][0];
    expect(eventCall.data.type).toBe('FULFILLED');
    expect(eventCall.data.actor).toBe('TARGET');
    expect(eventCall.data.note).toBe('Done');
  });

  it('fulfills without response data', async () => {
    mockFns.reachContract.findUnique.mockResolvedValue({
      id: 'c-2',
      status: 'ACTIVE',
      targetId: 'actor-target',
    });

    const mockUpdated = { id: 'c-2', status: 'FULFILLED' };
    mockFns.$transaction.mockImplementation(async (cb: (...args: unknown[]) => unknown) => {
      mockFns.reachContract.update.mockResolvedValue(mockUpdated);
      mockFns.reachContractEvent.create.mockResolvedValue({});
      return cb({
        reachContract: { update: mockFns.reachContract.update },
        reachContractEvent: { create: mockFns.reachContractEvent.create },
      });
    });

    const result = await fulfillContract('c-2', 'actor-target');
    expect(result.status).toBe('FULFILLED');

    // Should not include responseData in update
    const updateCall = mockFns.reachContract.update.mock.calls[0][0];
    expect(updateCall.data.responseData).toBeUndefined();
  });

  it('throws if contract not found', async () => {
    mockFns.reachContract.findUnique.mockResolvedValue(null);

    await expect(fulfillContract('missing', 'actor-1'))
      .rejects.toThrow('Contract not found');
  });

  it('throws if caller is not the target', async () => {
    mockFns.reachContract.findUnique.mockResolvedValue({
      id: 'c-1',
      status: 'ACTIVE',
      targetId: 'actor-target',
    });

    await expect(fulfillContract('c-1', 'actor-wrong'))
      .rejects.toThrow('Only the target actor can fulfill');
  });

  it('throws if contract is not ACTIVE', async () => {
    mockFns.reachContract.findUnique.mockResolvedValue({
      id: 'c-1',
      status: 'PROPOSED',
      targetId: 'actor-target',
    });

    await expect(fulfillContract('c-1', 'actor-target'))
      .rejects.toThrow('must be ACTIVE');
  });
});

// ---------------------------------------------------------------------------
// deactivateActorWithCascade
// ---------------------------------------------------------------------------

describe('deactivateActorWithCascade', () => {
  beforeEach(() => vi.clearAllMocks());

  it('deactivates actor and cancels in-flight contracts', async () => {
    mockFns.reachActor.findUnique.mockResolvedValue({
      id: 'actor-1',
      handle: 'alice',
      isActive: true,
    });

    mockFns.reachContract.findMany.mockResolvedValue([
      { id: 'c-1', targetId: 'actor-2' },
      { id: 'c-2', targetId: 'actor-1' },
    ]);

    const mockResult = {
      actor: { id: 'actor-1', isActive: false },
      cancelledContracts: 2,
    };

    mockFns.$transaction.mockImplementation(async (cb: (...args: unknown[]) => unknown) => {
      mockFns.reachActor.update.mockResolvedValue(mockResult.actor);
      mockFns.reachContract.updateMany.mockResolvedValue({ count: 2 });
      mockFns.reachContractEvent.createMany.mockResolvedValue({ count: 2 });
      return cb({
        reachActor: { update: mockFns.reachActor.update },
        reachContract: { updateMany: mockFns.reachContract.updateMany },
        reachContractEvent: { createMany: mockFns.reachContractEvent.createMany },
      });
    });

    const result = await deactivateActorWithCascade('actor-1');
    expect(result.actor.isActive).toBe(false);
    expect(result.cancelledContracts).toBe(2);

    // Verify batch update
    const updateManyCall = mockFns.reachContract.updateMany.mock.calls[0][0];
    expect(updateManyCall.where.id.in).toEqual(['c-1', 'c-2']);
    expect(updateManyCall.data.status).toBe('CANCELLED');

    // Verify batch events
    const createManyCall = mockFns.reachContractEvent.createMany.mock.calls[0][0];
    expect(createManyCall.data).toHaveLength(2);
    expect(createManyCall.data[0].type).toBe('CANCELLED');
    expect(createManyCall.data[0].note).toContain('alice');
  });

  it('deactivates actor with no in-flight contracts', async () => {
    mockFns.reachActor.findUnique.mockResolvedValue({
      id: 'actor-1',
      handle: 'alice',
      isActive: true,
    });

    mockFns.reachContract.findMany.mockResolvedValue([]);

    mockFns.$transaction.mockImplementation(async (cb: (...args: unknown[]) => unknown) => {
      mockFns.reachActor.update.mockResolvedValue({ id: 'actor-1', isActive: false });
      return cb({
        reachActor: { update: mockFns.reachActor.update },
        reachContract: { updateMany: mockFns.reachContract.updateMany },
        reachContractEvent: { createMany: mockFns.reachContractEvent.createMany },
      });
    });

    const result = await deactivateActorWithCascade('actor-1');
    expect(result.cancelledContracts).toBe(0);
    // updateMany should not be called when no contracts to cancel
    expect(mockFns.reachContract.updateMany).not.toHaveBeenCalled();
  });

  it('throws if actor not found', async () => {
    mockFns.reachActor.findUnique.mockResolvedValue(null);

    await expect(deactivateActorWithCascade('missing'))
      .rejects.toThrow('Actor not found');
  });

  it('throws if actor already inactive', async () => {
    mockFns.reachActor.findUnique.mockResolvedValue({
      id: 'actor-1',
      isActive: false,
    });

    await expect(deactivateActorWithCascade('actor-1'))
      .rejects.toThrow('already inactive');
  });
});

// ---------------------------------------------------------------------------
// expireStaleContracts (batch)
// ---------------------------------------------------------------------------

describe('expireStaleContracts (batch)', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns 0 when no stale contracts', async () => {
    mockFns.reachContract.findMany.mockResolvedValue([]);

    const count = await expireStaleContracts();
    expect(count).toBe(0);
    expect(mockFns.$transaction).not.toHaveBeenCalled();
  });

  it('batch expires multiple stale contracts', async () => {
    mockFns.reachContract.findMany.mockResolvedValue([
      { id: 'c-1', targetId: 'actor-a' },
      { id: 'c-2', targetId: 'actor-b' },
      { id: 'c-3', targetId: 'actor-a' },
    ]);

    mockFns.$transaction.mockImplementation(async (cb: (...args: unknown[]) => unknown) => {
      mockFns.reachContract.updateMany.mockResolvedValue({ count: 3 });
      mockFns.reachContractEvent.createMany.mockResolvedValue({ count: 3 });
      return cb({
        reachContract: { updateMany: mockFns.reachContract.updateMany },
        reachContractEvent: { createMany: mockFns.reachContractEvent.createMany },
      });
    });

    const count = await expireStaleContracts();
    expect(count).toBe(3);

    // Verify batch update
    const updateCall = mockFns.reachContract.updateMany.mock.calls[0][0];
    expect(updateCall.where.id.in).toEqual(['c-1', 'c-2', 'c-3']);
    expect(updateCall.data.status).toBe('EXPIRED');

    // Verify batch events
    const eventsCall = mockFns.reachContractEvent.createMany.mock.calls[0][0];
    expect(eventsCall.data).toHaveLength(3);
    expect(eventsCall.data.every((e: { type: string }) => e.type === 'EXPIRED')).toBe(true);
    expect(eventsCall.data.every((e: { note: string }) => e.note === 'Auto-expired')).toBe(true);
  });
});
