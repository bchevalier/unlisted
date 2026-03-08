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
  AgentMetaSchema,
} from './contracts';
import type {
  ReachActorCreate,
  ReachPolicyCreate,
  ReachContractCreate,
  ReachContractStatus,
  ReachContractEventType,
  ReachContractEventActor,
  ReachActorType,
  AgentMeta,
} from './contracts';
import { evaluatePolicies } from './policy-engine';
import type { PolicyRecord } from './policy-engine';
import { dispatchContract } from './router';
import { dispatchWebhookEvent } from './webhooks';
import { isBlocked, enforceActorRateLimit, enforcePairCooldown, ReachSafetyError } from './safety';
import * as crypto from 'crypto';
import { z } from 'zod';

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

  // AI_AGENT actors must provide agentMeta for identity/trust.
  if (data.type === 'AI_AGENT') {
    if (!data.agentMeta) {
      throw new ReachError(
        'AI_AGENT actors must provide agentMeta (operatorName required)',
        'AGENT_META_REQUIRED',
        400,
      );
    }
    AgentMetaSchema.parse(data.agentMeta);
  }

  // Non-AI_AGENT actors should not provide agentMeta.
  if (data.type !== 'AI_AGENT' && data.agentMeta) {
    throw new ReachError(
      'agentMeta is only valid for AI_AGENT actors',
      'AGENT_META_NOT_ALLOWED',
      400,
    );
  }

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

  // Validate apiKeyScopes contain only known permission names.
  const scopes = data.apiKeyScopes ?? [];
  if (scopes.length > 0) {
    const { REACH_PERMISSIONS } = await import('./permissions');
    const validScopes = new Set<string>(REACH_PERMISSIONS);
    const invalid = scopes.filter((s) => !validScopes.has(s));
    if (invalid.length > 0) {
      throw new ReachError(
        `Invalid API key scopes: ${invalid.join(', ')}`,
        'INVALID_KEY_SCOPES',
        400,
      );
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
      apiKeyScopes: scopes,
      agentMeta: data.type === 'AI_AGENT' && data.agentMeta
        ? (data.agentMeta as Parameters<typeof db.reachActor.create>[0]['data']['agentMeta'])
        : undefined,
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
// Actor update
// ---------------------------------------------------------------------------

export const ReachActorUpdateSchema = z.object({
  displayName: z.string().min(1).max(200).optional(),
  capabilities: z.record(z.unknown()).optional(),
  endpoint: z.string().url().optional().nullable(),
  agentMeta: AgentMetaSchema.partial().optional(),
});

export type ReachActorUpdate = z.infer<typeof ReachActorUpdateSchema>;

export async function updateActor(actorId: string, input: ReachActorUpdate) {
  const data = ReachActorUpdateSchema.parse(input);

  const actor = await db.reachActor.findUnique({ where: { id: actorId } });
  if (!actor) throw new ReachError('Actor not found', 'ACTOR_NOT_FOUND', 404);

  // agentMeta updates are only valid for AI_AGENT actors.
  if (data.agentMeta !== undefined && actor.type !== 'AI_AGENT') {
    throw new ReachError('agentMeta can only be updated on AI_AGENT actors', 'AGENT_META_NOT_ALLOWED', 400);
  }

  const updateData: Record<string, unknown> = {};
  if (data.displayName !== undefined) updateData.displayName = data.displayName;
  if (data.capabilities !== undefined) {
    updateData.capabilities = data.capabilities as Parameters<typeof db.reachActor.update>[0]['data']['capabilities'];
  }
  if (data.endpoint !== undefined) updateData.endpoint = data.endpoint;
  if (data.agentMeta !== undefined) {
    // Merge with existing agentMeta to allow partial updates.
    const existingMeta = (actor.agentMeta as Record<string, unknown>) ?? {};
    updateData.agentMeta = { ...existingMeta, ...data.agentMeta } as Parameters<typeof db.reachActor.update>[0]['data']['agentMeta'];
  }

  if (Object.keys(updateData).length === 0) {
    return actor; // nothing to update
  }

  return db.reachActor.update({
    where: { id: actorId },
    data: updateData,
  });
}

// ---------------------------------------------------------------------------
// API key rotation (headless actors only)
// ---------------------------------------------------------------------------

export async function rotateApiKey(actorId: string) {
  const actor = await db.reachActor.findUnique({
    where: { id: actorId },
    select: { id: true, type: true, userId: true, apiKeyHash: true },
  });

  if (!actor) throw new ReachError('Actor not found', 'ACTOR_NOT_FOUND', 404);

  // Only headless actors (AI_AGENT, ORGANIZATION without userId) use API keys.
  if (actor.type === 'HUMAN') {
    throw new ReachError('Human actors use session auth, not API keys', 'NOT_HEADLESS', 400);
  }

  const newKey = `knk_${crypto.randomBytes(32).toString('hex')}`;
  const newHash = crypto.createHash('sha256').update(newKey).digest('hex');

  await db.reachActor.update({
    where: { id: actorId },
    data: { apiKeyHash: newHash },
  });

  // Return plaintext key — caller must surface to the user.
  return { apiKey: newKey };
}

// ---------------------------------------------------------------------------
// Org membership
// ---------------------------------------------------------------------------

export async function addOrgMember(
  orgId: string,
  memberId: string,
  role: 'OWNER' | 'ADMIN' | 'MEMBER' = 'MEMBER',
) {
  // Validate org is an ORGANIZATION.
  const org = await db.reachActor.findUnique({
    where: { id: orgId },
    select: { id: true, type: true, isActive: true },
  });
  if (!org) throw new ReachError('Organization not found', 'ORG_NOT_FOUND', 404);
  if (org.type !== 'ORGANIZATION') {
    throw new ReachError('Actor is not an organization', 'NOT_ORG', 400);
  }
  if (!org.isActive) throw new ReachError('Organization is inactive', 'ORG_INACTIVE', 403);

  // Validate member exists and is not itself an org.
  const member = await db.reachActor.findUnique({
    where: { id: memberId },
    select: { id: true, type: true, isActive: true },
  });
  if (!member) throw new ReachError('Member actor not found', 'MEMBER_NOT_FOUND', 404);
  if (member.type === 'ORGANIZATION') {
    throw new ReachError('Cannot add an organization as a member', 'ORG_AS_MEMBER', 400);
  }
  if (!member.isActive) throw new ReachError('Member actor is inactive', 'MEMBER_INACTIVE', 403);

  // Check for existing membership.
  const existing = await db.reachOrgMember.findUnique({
    where: { orgId_memberId: { orgId, memberId } },
  });

  if (existing) {
    if (existing.isActive) {
      throw new ReachError('Already a member', 'ALREADY_MEMBER', 409);
    }
    // Reactivate.
    return db.reachOrgMember.update({
      where: { id: existing.id },
      data: { isActive: true, role },
    });
  }

  return db.reachOrgMember.create({
    data: { orgId, memberId, role },
  });
}

export async function removeOrgMember(orgId: string, memberId: string) {
  const membership = await db.reachOrgMember.findUnique({
    where: { orgId_memberId: { orgId, memberId } },
  });
  if (!membership || !membership.isActive) {
    throw new ReachError('Membership not found', 'MEMBERSHIP_NOT_FOUND', 404);
  }

  // Prevent removing the last OWNER.
  if (membership.role === 'OWNER') {
    const ownerCount = await db.reachOrgMember.count({
      where: { orgId, role: 'OWNER', isActive: true },
    });
    if (ownerCount <= 1) {
      throw new ReachError(
        'Cannot remove the last owner. Transfer ownership first.',
        'LAST_OWNER',
        400,
      );
    }
  }

  return db.reachOrgMember.update({
    where: { id: membership.id },
    data: { isActive: false },
  });
}

export async function updateOrgMemberRole(
  orgId: string,
  memberId: string,
  newRole: 'OWNER' | 'ADMIN' | 'MEMBER',
) {
  const membership = await db.reachOrgMember.findUnique({
    where: { orgId_memberId: { orgId, memberId } },
  });
  if (!membership || !membership.isActive) {
    throw new ReachError('Membership not found', 'MEMBERSHIP_NOT_FOUND', 404);
  }

  // If demoting from OWNER, ensure they're not the last one.
  if (membership.role === 'OWNER' && newRole !== 'OWNER') {
    const ownerCount = await db.reachOrgMember.count({
      where: { orgId, role: 'OWNER', isActive: true },
    });
    if (ownerCount <= 1) {
      throw new ReachError(
        'Cannot demote the last owner. Assign another owner first.',
        'LAST_OWNER',
        400,
      );
    }
  }

  return db.reachOrgMember.update({
    where: { id: membership.id },
    data: { role: newRole },
  });
}

export async function listOrgMembers(orgId: string, includeInactive = false) {
  return db.reachOrgMember.findMany({
    where: {
      orgId,
      ...(includeInactive ? {} : { isActive: true }),
    },
    include: {
      member: {
        select: { id: true, handle: true, displayName: true, type: true, isActive: true },
      },
    },
    orderBy: [{ role: 'asc' }, { createdAt: 'asc' }],
  });
}

export async function getOrgMembership(orgId: string, memberId: string) {
  return db.reachOrgMember.findUnique({
    where: { orgId_memberId: { orgId, memberId } },
    include: {
      member: {
        select: { id: true, handle: true, displayName: true, type: true },
      },
    },
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
  if (!initiator.isActive) throw new ReachError('Initiator is not active', 'INITIATOR_INACTIVE', 403);
  if (!target) throw new ReachError('Target not found', 'TARGET_NOT_FOUND', 404);
  if (!target.isActive) throw new ReachError('Target is not active', 'TARGET_INACTIVE', 403);
  if (initiator.id === target.id) throw new ReachError('Cannot reach yourself', 'SELF_REACH', 400);

  // Safety checks: blocklist, rate limit, cooldown.
  // These throw ReachSafetyError (extends Error) with appropriate status codes.
  try {
    if (await isBlocked(target.id, initiator.id)) {
      throw new ReachError('This actor has blocked you', 'BLOCKED', 403);
    }
    await enforceActorRateLimit(initiator.id);
    await enforcePairCooldown(initiator.id, target.id);
  } catch (err) {
    if (err instanceof ReachSafetyError) {
      throw new ReachError(err.message, err.code, err.statusCode);
    }
    throw err;
  }

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

  // Fire webhook lifecycle events for the target actor.
  const webhookEvent = evaluation.action === 'ACCEPT' && evaluation.autoAccept
    ? 'ACCEPTED' as const
    : evaluation.action === 'ESCALATE'
      ? 'ESCALATED' as const
      : evaluation.action === 'REJECT'
        ? 'REJECTED' as const
        : 'CREATED' as const;

  dispatchWebhookEvent(result.contract.id, webhookEvent, target.id).catch((err) => {
    console.error('[reach:proposeContract:webhook]', err);
  });

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
  const contract = await db.reachContract.findUnique({
    where: { id: contractId },
    select: { id: true, status: true, targetId: true },
  });
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

  const updated = await db.$transaction(async (tx) => {
    const u = await tx.reachContract.update({
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

    return u;
  });

  // Fire webhook lifecycle event for the target actor (fire-and-forget).
  dispatchWebhookEvent(contractId, eventType, contract.targetId).catch((err) => {
    console.error('[reach:transitionContract:webhook]', err);
  });

  return updated;
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
 * Returns contracts + totalCount for proper client-side pagination.
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

  const [contracts, totalCount] = await Promise.all([
    db.reachContract.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: limit,
      skip: offset,
      include: {
        initiator: { select: { id: true, handle: true, displayName: true, type: true } },
        target: { select: { id: true, handle: true, displayName: true, type: true } },
      },
    }),
    db.reachContract.count({ where }),
  ]);

  return { contracts, totalCount };
}

/**
 * Expire contracts that have passed their expiresAt and are still PROPOSED or ACTIVE.
 *
 * Uses a batched approach: bulk-updates status + resolvedAt in one query,
 * then inserts audit events in a single batch. This avoids the N+1 pattern
 * of transitioning contracts individually.
 *
 * Returns the count of expired contracts.
 */
export async function expireStaleContracts(): Promise<number> {
  const now = new Date();

  // Find stale contracts.
  const stale = await db.reachContract.findMany({
    where: {
      expiresAt: { lte: now },
      status: { in: ['PROPOSED', 'ACTIVE'] },
    },
    select: { id: true, targetId: true },
  });

  if (stale.length === 0) return 0;

  const staleIds = stale.map((c) => c.id);

  // Batch update + batch event insert in a single transaction.
  const result = await db.$transaction(async (tx) => {
    const updateResult = await tx.reachContract.updateMany({
      where: { id: { in: staleIds } },
      data: { status: 'EXPIRED', resolvedAt: now },
    });

    // Insert audit events in bulk.
    await tx.reachContractEvent.createMany({
      data: staleIds.map((id) => ({
        contractId: id,
        type: 'EXPIRED' as const,
        actor: 'SYSTEM' as const,
        note: 'Auto-expired',
      })),
    });

    return updateResult.count;
  });

  // Fire webhook events outside the transaction (non-blocking).
  for (const contract of stale) {
    dispatchWebhookEvent(contract.id, 'EXPIRED', contract.targetId).catch((err) => {
      console.error('[reach:expireStaleContracts:webhook]', err);
    });
  }

  return result;
}

// ---------------------------------------------------------------------------
// Fulfillment
// ---------------------------------------------------------------------------

/**
 * Fulfill a contract, optionally attaching a response payload.
 *
 * Only the target (or an org member with CONTRACT_ACT on the target) should
 * call this. The contract must be in ACTIVE status.
 *
 * @param contractId    – the contract to fulfill
 * @param actorId       – the actor performing the fulfillment (must be target)
 * @param responseData  – optional structured response payload
 * @param note          – optional note for the audit event
 */
export async function fulfillContract(
  contractId: string,
  actorId: string,
  responseData?: Record<string, unknown>,
  note?: string,
) {
  const contract = await db.reachContract.findUnique({
    where: { id: contractId },
    select: { id: true, status: true, targetId: true },
  });

  if (!contract) throw new ReachError('Contract not found', 'CONTRACT_NOT_FOUND', 404);
  if (contract.targetId !== actorId) {
    throw new ReachError('Only the target actor can fulfill a contract', 'FORBIDDEN', 403);
  }
  if (contract.status !== 'ACTIVE') {
    throw new ReachError(
      `Cannot fulfill a contract in ${contract.status} status (must be ACTIVE)`,
      'INVALID_FULFILLMENT',
      400,
    );
  }

  const now = new Date();

  const updated = await db.$transaction(async (tx) => {
    const u = await tx.reachContract.update({
      where: { id: contractId },
      data: {
        status: 'FULFILLED',
        resolvedAt: now,
        ...(responseData
          ? { responseData: responseData as Parameters<typeof tx.reachContract.update>[0]['data']['responseData'] }
          : {}),
      },
    });

    await tx.reachContractEvent.create({
      data: {
        contractId,
        type: 'FULFILLED',
        actor: 'TARGET',
        note: note ?? null,
        ...(responseData
          ? { metadata: { hasResponseData: true } as Parameters<typeof tx.reachContractEvent.create>[0]['data']['metadata'] }
          : {}),
      },
    });

    return u;
  });

  // Fire webhook event (fire-and-forget).
  dispatchWebhookEvent(contractId, 'FULFILLED', contract.targetId).catch((err) => {
    console.error('[reach:fulfillContract:webhook]', err);
  });

  return updated;
}

// ---------------------------------------------------------------------------
// Actor deactivation with cascade
// ---------------------------------------------------------------------------

/**
 * Deactivate an actor and cancel all their in-flight contracts.
 *
 * Cancels contracts where the actor is either initiator or target,
 * in PROPOSED or ACTIVE status. Uses batch operations for performance.
 *
 * @param actorId – the actor to deactivate
 * @returns the deactivated actor + count of cancelled contracts
 */
export async function deactivateActorWithCascade(actorId: string) {
  const actor = await db.reachActor.findUnique({ where: { id: actorId } });
  if (!actor) throw new ReachError('Actor not found', 'ACTOR_NOT_FOUND', 404);
  if (!actor.isActive) throw new ReachError('Actor already inactive', 'ALREADY_INACTIVE', 400);

  const now = new Date();

  // Find all in-flight contracts involving this actor.
  const inFlightContracts = await db.reachContract.findMany({
    where: {
      OR: [{ initiatorId: actorId }, { targetId: actorId }],
      status: { in: ['PROPOSED', 'ACTIVE'] },
    },
    select: { id: true, targetId: true },
  });

  const contractIds = inFlightContracts.map((c) => c.id);

  const result = await db.$transaction(async (tx) => {
    // Deactivate the actor.
    const updatedActor = await tx.reachActor.update({
      where: { id: actorId },
      data: { isActive: false },
    });

    // Batch cancel in-flight contracts.
    let cancelledCount = 0;
    if (contractIds.length > 0) {
      const updateResult = await tx.reachContract.updateMany({
        where: { id: { in: contractIds } },
        data: { status: 'CANCELLED', resolvedAt: now },
      });
      cancelledCount = updateResult.count;

      // Batch insert cancellation events.
      await tx.reachContractEvent.createMany({
        data: contractIds.map((id) => ({
          contractId: id,
          type: 'CANCELLED' as const,
          actor: 'SYSTEM' as const,
          note: `Actor @${actor.handle} deactivated`,
        })),
      });
    }

    return { actor: updatedActor, cancelledContracts: cancelledCount };
  });

  // Fire webhook events for cancelled contracts (non-blocking).
  for (const contract of inFlightContracts) {
    dispatchWebhookEvent(contract.id, 'CANCELLED', contract.targetId).catch((err) => {
      console.error('[reach:deactivateActor:webhook]', err);
    });
  }

  return result;
}

// ---------------------------------------------------------------------------
// Escalation & Human Override
// ---------------------------------------------------------------------------

/**
 * List contracts that have been escalated to human review.
 * Returns contracts in PROPOSED status that have an ESCALATED event,
 * plus totalCount for pagination.
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
  const where = {
    targetId: actorId,
    status: 'PROPOSED' as const,
    events: {
      some: { type: 'ESCALATED' as const },
    },
  };

  const [contracts, totalCount] = await Promise.all([
    db.reachContract.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: limit,
      skip: offset,
      include: {
        initiator: { select: { id: true, handle: true, displayName: true, type: true } },
        target: { select: { id: true, handle: true, displayName: true, type: true } },
        events: { orderBy: { createdAt: 'asc' } },
      },
    }),
    db.reachContract.count({ where }),
  ]);

  return { contracts, totalCount };
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

  const result = await db.$transaction(async (tx) => {
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

      return { contract: accepted, event: 'ACCEPTED' as const };
    }

    return { contract: reopened, event: 'OVERRIDDEN' as const };
  });

  // Fire webhook lifecycle event for the override.
  dispatchWebhookEvent(contractId, result.event, contract.targetId).catch((err) => {
    console.error('[reach:overrideContract:webhook]', err);
  });

  return result.contract;
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
