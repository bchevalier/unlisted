/**
 * Reach service layer — DB-backed operations for actors, policies, and contracts.
 *
 * All mutations go through this module so the domain rules (validation, transitions,
 * policy evaluation) are enforced in one place. API routes should call these
 * functions rather than touching Prisma directly.
 */

import { db } from '../db';
import {
  canTransition,
  validateActorTypes,
  ReachActorCreateSchema,
  ReachPolicyCreateSchema,
  ReachContractCreateSchema,
} from './contracts';
import type {
  ReachActorCreate,
  ReachPolicyCreate,
  ReachContractCreate,
  ReachContractStatus,
  ReachContractEventType,
  ReachContractEventActor,
  ReachActorType,
} from './contracts';
import { evaluatePolicies } from './policy-engine';
import type { PolicyRecord } from './policy-engine';
import { dispatchContract } from './router';
import * as crypto from 'crypto';

// ---------------------------------------------------------------------------
// Errors
// ---------------------------------------------------------------------------

export class ReachError extends Error {
  constructor(
    message: string,
    public code: string,
    public statusCode: number = 400,
  ) {
    super(message);
    this.name = 'ReachError';
  }
}

// ---------------------------------------------------------------------------
// Actors
// ---------------------------------------------------------------------------

export async function createActor(input: ReachActorCreate, userId?: string) {
  const data = ReachActorCreateSchema.parse(input);

  const existing = await db.reachActor.findUnique({ where: { handle: data.handle } });
  if (existing) {
    throw new ReachError('Handle already taken', 'HANDLE_TAKEN', 409);
  }

  if (userId) {
    const linked = await db.reachActor.findUnique({ where: { userId } });
    if (linked) {
      throw new ReachError('User already has an actor', 'USER_ALREADY_ACTOR', 409);
    }
  }

  // For headless actors (AI_AGENT, ORGANIZATION without userId), generate an API key.
  let apiKey: string | undefined;
  let apiKeyHash: string | undefined;
  if (!userId && (data.type === 'AI_AGENT' || data.type === 'ORGANIZATION')) {
    apiKey = `knk_${crypto.randomBytes(32).toString('hex')}`;
    apiKeyHash = crypto.createHash('sha256').update(apiKey).digest('hex');
  }

  const actor = await db.reachActor.create({
    data: {
      userId: userId ?? null,
      type: data.type,
      handle: data.handle,
      displayName: data.displayName,
      capabilities: (data.capabilities ?? undefined) as Parameters<typeof db.reachActor.create>[0]['data']['capabilities'],
      endpoint: data.endpoint ?? null,
      apiKeyHash: apiKeyHash ?? null,
    },
  });

  // Return plaintext API key only on creation (never stored).
  return { actor, apiKey };
}

export async function getActorByHandle(handle: string) {
  return db.reachActor.findUnique({ where: { handle } });
}

export async function getActorByUserId(userId: string) {
  return db.reachActor.findUnique({ where: { userId } });
}

export async function deactivateActor(actorId: string) {
  return db.reachActor.update({
    where: { id: actorId },
    data: { isActive: false },
  });
}

// ---------------------------------------------------------------------------
// Policies
// ---------------------------------------------------------------------------

export async function createPolicy(actorId: string, input: ReachPolicyCreate) {
  const data = ReachPolicyCreateSchema.parse(input);

  // Verify actor exists.
  const actor = await db.reachActor.findUnique({ where: { id: actorId } });
  if (!actor) {
    throw new ReachError('Actor not found', 'ACTOR_NOT_FOUND', 404);
  }

  return db.reachPolicy.create({
    data: {
      actorId,
      name: data.name,
      contractTypes: data.contractTypes,
      action: data.action,
      maxWeeklyInbound: data.maxWeeklyInbound ?? null,
      requireVerifiedSender: data.requireVerifiedSender,
      autoAcceptMatching: data.autoAcceptMatching,
      escalateToHuman: data.escalateToHuman,
      filters: (data.filters ?? undefined) as Parameters<typeof db.reachPolicy.create>[0]['data']['filters'],
      priority: data.priority,
    },
  });
}

export async function listPolicies(actorId: string) {
  return db.reachPolicy.findMany({
    where: { actorId },
    orderBy: { priority: 'desc' },
  });
}

export async function updatePolicy(
  policyId: string,
  updates: Partial<Omit<ReachPolicyCreate, 'name'>>,
) {
  const { filters, ...rest } = updates;
  return db.reachPolicy.update({
    where: { id: policyId },
    data: {
      ...rest,
      ...(filters !== undefined
        ? { filters: filters as Parameters<typeof db.reachPolicy.update>[0]['data']['filters'] }
        : {}),
    },
  });
}

export async function deactivatePolicy(policyId: string) {
  return db.reachPolicy.update({
    where: { id: policyId },
    data: { isActive: false },
  });
}

// ---------------------------------------------------------------------------
// Contracts
// ---------------------------------------------------------------------------

/**
 * Propose a new contract.
 *
 * 1. Validates the input and actor types.
 * 2. Evaluates the target's policies.
 * 3. Creates the contract + CREATED event.
 * 4. If policy says auto-accept, transitions to ACTIVE immediately.
 */
export async function proposeContract(
  initiatorId: string,
  input: ReachContractCreate,
) {
  const data = ReachContractCreateSchema.parse(input);

  // Resolve actors.
  const [initiator, target] = await Promise.all([
    db.reachActor.findUnique({ where: { id: initiatorId } }),
    db.reachActor.findUnique({ where: { handle: data.targetHandle } }),
  ]);

  if (!initiator) throw new ReachError('Initiator not found', 'INITIATOR_NOT_FOUND', 404);
  if (!target) throw new ReachError('Target not found', 'TARGET_NOT_FOUND', 404);
  if (!target.isActive) throw new ReachError('Target is not active', 'TARGET_INACTIVE', 403);
  if (initiator.id === target.id) throw new ReachError('Cannot reach yourself', 'SELF_REACH', 400);

  // Validate actor types match contract type.
  if (!validateActorTypes(data.type, initiator.type as ReachActorType, target.type as ReachActorType)) {
    throw new ReachError(
      `Actor types (${initiator.type}→${target.type}) incompatible with contract type ${data.type}`,
      'ACTOR_TYPE_MISMATCH',
      400,
    );
  }

  // Evaluate target's policies.
  const policies = await db.reachPolicy.findMany({
    where: { actorId: target.id, isActive: true },
    orderBy: { priority: 'desc' },
  });

  // Count contracts received by target this week.
  const weekStart = getWeekStart();
  const weeklyCount = await db.reachContract.count({
    where: {
      targetId: target.id,
      createdAt: { gte: weekStart },
    },
  });

  const policyRecords: PolicyRecord[] = policies.map((p) => ({
    id: p.id,
    isActive: p.isActive,
    contractTypes: p.contractTypes,
    action: p.action,
    maxWeeklyInbound: p.maxWeeklyInbound,
    requireVerifiedSender: p.requireVerifiedSender,
    autoAcceptMatching: p.autoAcceptMatching,
    escalateToHuman: p.escalateToHuman,
    filters: p.filters as Record<string, unknown> | null,
    priority: p.priority,
  }));

  const evaluation = evaluatePolicies(
    policyRecords,
    {
      type: data.type,
      initiatorType: initiator.type as ReachActorType,
      initiatorVerified: !!initiator.userId, // linked users count as verified
      purpose: data.purpose,
    },
    weeklyCount,
  );

  // If no policies match or cap exceeded, reject at the gate.
  if (evaluation.matched === false) {
    const { reason } = evaluation;
    throw new ReachError(
      `Contract not accepted: ${reason}`,
      reason.toUpperCase(),
      reason === 'weekly_cap_exceeded' ? 429 : 403,
    );
  }

  // Compute expiry.
  const expiresAt = data.expiresInHours
    ? new Date(Date.now() + data.expiresInHours * 60 * 60 * 1000)
    : null;

  // Create contract + initial event in a transaction.
  const result = await db.$transaction(async (tx) => {
    const c = await tx.reachContract.create({
      data: {
        type: data.type,
        status: 'PROPOSED',
        initiatorId: initiator.id,
        targetId: target.id,
        policyId: evaluation.policyId,
        purpose: data.purpose,
        message: data.message ?? null,
        structuredData: (data.structuredData ?? undefined) as Parameters<typeof db.reachContract.create>[0]['data']['structuredData'],
        expiresAt,
      },
    });

    await tx.reachContractEvent.create({
      data: {
        contractId: c.id,
        type: 'CREATED',
        actor: 'SYSTEM',
        metadata: {
          policyId: evaluation.policyId,
          policyAction: evaluation.action,
          autoAccept: evaluation.autoAccept,
        } as Parameters<typeof db.reachContractEvent.create>[0]['data']['metadata'],
      },
    });

    // Auto-accept: transition to ACTIVE immediately.
    if (evaluation.autoAccept && evaluation.action === 'ACCEPT') {
      const updated = await tx.reachContract.update({
        where: { id: c.id },
        data: { status: 'ACTIVE', routedAt: new Date() },
      });
      await tx.reachContractEvent.create({
        data: {
          contractId: c.id,
          type: 'ACCEPTED',
          actor: 'SYSTEM',
          note: 'Auto-accepted by policy',
        },
      });
      return { contract: updated, shouldDispatch: true };
    }

    // ROUTE action → mark as routed but keep PROPOSED.
    if (evaluation.action === 'ROUTE') {
      const updated = await tx.reachContract.update({
        where: { id: c.id },
        data: { routedAt: new Date() },
      });
      await tx.reachContractEvent.create({
        data: {
          contractId: c.id,
          type: 'ROUTED',
          actor: 'SYSTEM',
          note: 'Routed by policy',
        },
      });
      return { contract: updated, shouldDispatch: true };
    }

    // ESCALATE → mark as routed with escalation event.
    if (evaluation.action === 'ESCALATE') {
      const updated = await tx.reachContract.update({
        where: { id: c.id },
        data: { routedAt: new Date() },
      });
      await tx.reachContractEvent.create({
        data: {
          contractId: c.id,
          type: 'ESCALATED',
          actor: 'SYSTEM',
          note: 'Escalated to human review',
        },
      });
      return { contract: updated, shouldDispatch: true };
    }

    // REJECT action from policy.
    if (evaluation.action === 'REJECT') {
      const updated = await tx.reachContract.update({
        where: { id: c.id },
        data: { status: 'REJECTED', resolvedAt: new Date() },
      });
      await tx.reachContractEvent.create({
        data: {
          contractId: c.id,
          type: 'REJECTED',
          actor: 'SYSTEM',
          note: 'Rejected by policy',
        },
      });
      return { contract: updated, shouldDispatch: false };
    }

    return { contract: c, shouldDispatch: false };
  });

  // Dispatch delivery outside the transaction (fire-and-forget).
  if (result.shouldDispatch) {
    dispatchContract(result.contract.id, evaluation.action).catch((err) => {
      console.error('[reach:proposeContract:dispatch]', err);
    });
  }

  return result.contract;
}

/**
 * Transition a contract to a new status with an audit event.
 */
export async function transitionContract(
  contractId: string,
  newStatus: ReachContractStatus,
  eventActor: ReachContractEventActor = 'SYSTEM',
  note?: string,
) {
  const contract = await db.reachContract.findUnique({ where: { id: contractId } });
  if (!contract) throw new ReachError('Contract not found', 'CONTRACT_NOT_FOUND', 404);

  if (!canTransition(contract.status as ReachContractStatus, newStatus)) {
    throw new ReachError(
      `Cannot transition from ${contract.status} to ${newStatus}`,
      'INVALID_TRANSITION',
      400,
    );
  }

  const eventType = statusToEventType(newStatus);
  const isResolved = ['FULFILLED', 'REJECTED', 'CANCELLED', 'EXPIRED'].includes(newStatus);

  return db.$transaction(async (tx) => {
    const updated = await tx.reachContract.update({
      where: { id: contractId },
      data: {
        status: newStatus,
        ...(newStatus === 'ACTIVE' ? { routedAt: new Date() } : {}),
        ...(isResolved ? { resolvedAt: new Date() } : {}),
      },
    });

    await tx.reachContractEvent.create({
      data: {
        contractId,
        type: eventType,
        actor: eventActor,
        note: note ?? null,
      },
    });

    return updated;
  });
}

/**
 * Get contract with events for display.
 */
export async function getContract(contractId: string) {
  return db.reachContract.findUnique({
    where: { id: contractId },
    include: {
      events: { orderBy: { createdAt: 'asc' } },
      initiator: { select: { id: true, handle: true, displayName: true, type: true } },
      target: { select: { id: true, handle: true, displayName: true, type: true } },
    },
  });
}

/**
 * List contracts for an actor (as initiator or target).
 */
export async function listContracts(
  actorId: string,
  role: 'initiator' | 'target' | 'both' = 'both',
  status?: ReachContractStatus,
  limit = 50,
  offset = 0,
) {
  const where: Record<string, unknown> = {};
  if (role === 'initiator') where.initiatorId = actorId;
  else if (role === 'target') where.targetId = actorId;
  else where.OR = [{ initiatorId: actorId }, { targetId: actorId }];

  if (status) where.status = status;

  return db.reachContract.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    take: limit,
    skip: offset,
    include: {
      initiator: { select: { id: true, handle: true, displayName: true, type: true } },
      target: { select: { id: true, handle: true, displayName: true, type: true } },
    },
  });
}

/**
 * Expire contracts that have passed their expiresAt and are still PROPOSED or ACTIVE.
 * Returns the count of expired contracts.
 */
export async function expireStaleContracts(): Promise<number> {
  const now = new Date();
  const stale = await db.reachContract.findMany({
    where: {
      expiresAt: { lte: now },
      status: { in: ['PROPOSED', 'ACTIVE'] },
    },
    select: { id: true, status: true },
  });

  let count = 0;
  for (const contract of stale) {
    try {
      await transitionContract(contract.id, 'EXPIRED', 'SYSTEM', 'Auto-expired');
      count++;
    } catch {
      // Already transitioned or invalid — skip.
    }
  }
  return count;
}

// ---------------------------------------------------------------------------
// Escalation & Human Override
// ---------------------------------------------------------------------------

/**
 * List contracts that have been escalated to human review.
 * Returns contracts in PROPOSED status that have an ESCALATED event.
 *
 * @param actorId  – the target actor to query escalations for
 * @param limit    – max results (default 50)
 * @param offset   – pagination offset (default 0)
 */
export async function listEscalatedContracts(
  actorId: string,
  limit = 50,
  offset = 0,
) {
  return db.reachContract.findMany({
    where: {
      targetId: actorId,
      status: 'PROPOSED',
      events: {
        some: { type: 'ESCALATED' },
      },
    },
    orderBy: { createdAt: 'desc' },
    take: limit,
    skip: offset,
    include: {
      initiator: { select: { id: true, handle: true, displayName: true, type: true } },
      target: { select: { id: true, handle: true, displayName: true, type: true } },
      events: { orderBy: { createdAt: 'asc' } },
    },
  });
}

/**
 * Override a policy decision on a rejected contract.
 *
 * Only TARGET or ADMIN actors may override. Transitions REJECTED → PROPOSED
 * (or optionally straight to ACTIVE) and records an OVERRIDDEN audit event.
 *
 * @param contractId  – contract to override
 * @param actorId     – the actor performing the override (must be target)
 * @param action      – 'REOPEN' puts it back to PROPOSED; 'ACCEPT' moves to ACTIVE
 * @param note        – optional reason for the override
 */
export async function overrideContractDecision(
  contractId: string,
  actorId: string,
  action: 'REOPEN' | 'ACCEPT',
  note?: string,
) {
  const contract = await db.reachContract.findUnique({
    where: { id: contractId },
    include: {
      events: { where: { type: 'REJECTED' }, take: 1, orderBy: { createdAt: 'desc' } },
    },
  });
  if (!contract) throw new ReachError('Contract not found', 'CONTRACT_NOT_FOUND', 404);

  // Only the target (or admin) may override.
  if (contract.targetId !== actorId) {
    throw new ReachError('Only the target actor can override a policy decision', 'FORBIDDEN', 403);
  }

  if (contract.status !== 'REJECTED') {
    throw new ReachError(
      `Cannot override a contract in ${contract.status} status (must be REJECTED)`,
      'INVALID_OVERRIDE',
      400,
    );
  }

  return db.$transaction(async (tx) => {
    // Step 1: Reopen — transition REJECTED → PROPOSED with override audit.
    const reopened = await tx.reachContract.update({
      where: { id: contractId },
      data: {
        status: 'PROPOSED',
        resolvedAt: null, // clear resolution
      },
    });

    await tx.reachContractEvent.create({
      data: {
        contractId,
        type: 'OVERRIDDEN',
        actor: 'TARGET',
        note: note ?? 'Human override of policy decision',
        metadata: {
          previousStatus: 'REJECTED',
          overrideAction: action,
        } as Parameters<typeof tx.reachContractEvent.create>[0]['data']['metadata'],
      },
    });

    // Step 2: If action is ACCEPT, immediately transition to ACTIVE.
    if (action === 'ACCEPT') {
      const accepted = await tx.reachContract.update({
        where: { id: contractId },
        data: {
          status: 'ACTIVE',
          routedAt: new Date(),
        },
      });

      await tx.reachContractEvent.create({
        data: {
          contractId,
          type: 'ACCEPTED',
          actor: 'TARGET',
          note: 'Accepted via human override',
        },
      });

      return accepted;
    }

    return reopened;
  });
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getWeekStart(): Date {
  const now = new Date();
  const day = now.getUTCDay(); // 0=Sun
  const diff = now.getUTCDate() - day + (day === 0 ? -6 : 1); // Monday
  const monday = new Date(now);
  monday.setUTCDate(diff);
  monday.setUTCHours(0, 0, 0, 0);
  return monday;
}

function statusToEventType(status: ReachContractStatus): ReachContractEventType {
  const map: Record<ReachContractStatus, ReachContractEventType> = {
    PROPOSED: 'CREATED',
    ACTIVE: 'ACCEPTED',
    FULFILLED: 'FULFILLED',
    REJECTED: 'REJECTED',
    CANCELLED: 'CANCELLED',
    EXPIRED: 'EXPIRED',
  };
  return map[status];
}
