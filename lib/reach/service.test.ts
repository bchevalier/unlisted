/**
 * Unit tests for Reach service layer — pure logic functions.
 *
 * Tests fulfillContract, deactivateActorWithCascade, and expireStaleContracts
 * (batch variant). All DB interactions are mocked.
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
  },
  reachContractEvent: {
    create: vi.fn(),
    createMany: vi.fn(),
  },
  reachPolicy: {
    findMany: vi.fn(),
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

import { fulfillContract, deactivateActorWithCascade, expireStaleContracts, ReachError } from './service';

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
    mockFns.$transaction.mockImplementation(async (cb: Function) => {
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
    mockFns.$transaction.mockImplementation(async (cb: Function) => {
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

    mockFns.$transaction.mockImplementation(async (cb: Function) => {
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

    mockFns.$transaction.mockImplementation(async (cb: Function) => {
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

    mockFns.$transaction.mockImplementation(async (cb: Function) => {
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
