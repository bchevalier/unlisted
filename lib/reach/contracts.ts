/**
 * Reach contract types and validation.
 *
 * Four contract shapes define every Reach interaction:
 *   HUMAN_HUMAN  – person wants to reach another person
 *   HUMAN_AI     – person wants to reach an AI agent
 *   AI_HUMAN     – AI agent wants to reach a person
 *   AI_AI        – AI agent wants to reach another AI agent
 *
 * Each shape can carry a typed structured payload and response payload,
 * but the contract envelope is the same across all four.
 */

import { z } from 'zod';

// ---------------------------------------------------------------------------
// Enums (mirror Prisma but usable without generated client)
// ---------------------------------------------------------------------------

export const REACH_ACTOR_TYPES = ['HUMAN', 'AI_AGENT', 'ORGANIZATION'] as const;
export type ReachActorType = (typeof REACH_ACTOR_TYPES)[number];

export const REACH_CONTRACT_TYPES = ['HUMAN_HUMAN', 'HUMAN_AI', 'AI_HUMAN', 'AI_AI'] as const;
export type ReachContractType = (typeof REACH_CONTRACT_TYPES)[number];

export const REACH_CONTRACT_STATUSES = [
  'PROPOSED',
  'ACTIVE',
  'FULFILLED',
  'REJECTED',
  'CANCELLED',
  'EXPIRED',
] as const;
export type ReachContractStatus = (typeof REACH_CONTRACT_STATUSES)[number];

export const REACH_POLICY_ACTIONS = ['ACCEPT', 'REJECT', 'ROUTE', 'ESCALATE'] as const;
export type ReachPolicyAction = (typeof REACH_POLICY_ACTIONS)[number];

export const REACH_EVENT_TYPES = [
  'CREATED',
  'ROUTED',
  'ACCEPTED',
  'REJECTED',
  'FULFILLED',
  'ESCALATED',
  'EXPIRED',
  'CANCELLED',
  'OVERRIDDEN',
] as const;
export type ReachContractEventType = (typeof REACH_EVENT_TYPES)[number];

export const REACH_EVENT_ACTORS = ['SYSTEM', 'INITIATOR', 'TARGET', 'ADMIN'] as const;
export type ReachContractEventActor = (typeof REACH_EVENT_ACTORS)[number];

// ---------------------------------------------------------------------------
// Contract lifecycle helpers
// ---------------------------------------------------------------------------

/** Valid status transitions. Key = current status, value = allowed next statuses. */
export const CONTRACT_TRANSITIONS: Record<ReachContractStatus, readonly ReachContractStatus[]> = {
  PROPOSED: ['ACTIVE', 'REJECTED', 'CANCELLED', 'EXPIRED'],
  ACTIVE: ['FULFILLED', 'CANCELLED', 'EXPIRED'],
  FULFILLED: [],
  REJECTED: ['PROPOSED'], // human override can reopen a rejected contract
  CANCELLED: [],
  EXPIRED: [],
} as const;

export function canTransition(from: ReachContractStatus, to: ReachContractStatus): boolean {
  return (CONTRACT_TRANSITIONS[from] as readonly string[]).includes(to);
}

// ---------------------------------------------------------------------------
// Contract type → actor type validation
// ---------------------------------------------------------------------------

interface ActorPair {
  initiator: ReachActorType;
  target: ReachActorType;
}

const CONTRACT_ACTOR_RULES: Record<ReachContractType, ActorPair> = {
  HUMAN_HUMAN: { initiator: 'HUMAN', target: 'HUMAN' },
  HUMAN_AI: { initiator: 'HUMAN', target: 'AI_AGENT' },
  AI_HUMAN: { initiator: 'AI_AGENT', target: 'HUMAN' },
  AI_AI: { initiator: 'AI_AGENT', target: 'AI_AGENT' },
};

/**
 * Returns true when the actor types are compatible with the contract type.
 * ORGANIZATIONs are allowed in any position (they wrap either humans or AI).
 */
export function validateActorTypes(
  contractType: ReachContractType,
  initiatorType: ReachActorType,
  targetType: ReachActorType,
): boolean {
  const rule = CONTRACT_ACTOR_RULES[contractType];
  const matchesOrOrg = (actual: ReachActorType, expected: ReachActorType) =>
    actual === expected || actual === 'ORGANIZATION';
  return matchesOrOrg(initiatorType, rule.initiator) && matchesOrOrg(targetType, rule.target);
}

// ---------------------------------------------------------------------------
// Zod schemas for API validation
// ---------------------------------------------------------------------------

export const ReachActorCreateSchema = z.object({
  type: z.enum(REACH_ACTOR_TYPES),
  handle: z
    .string()
    .min(2)
    .max(64)
    .regex(/^[a-z0-9][a-z0-9._-]*$/i, 'Handle must be alphanumeric (dots/hyphens/underscores allowed)'),
  displayName: z.string().min(1).max(200),
  capabilities: z.record(z.unknown()).optional(),
  endpoint: z.string().url().optional(),
});

export const ReachPolicyCreateSchema = z.object({
  name: z.string().min(1).max(200),
  contractTypes: z.array(z.enum(REACH_CONTRACT_TYPES)).min(1),
  action: z.enum(REACH_POLICY_ACTIONS).default('ACCEPT'),
  maxWeeklyInbound: z.number().int().positive().optional(),
  requireVerifiedSender: z.boolean().default(false),
  autoAcceptMatching: z.boolean().default(false),
  escalateToHuman: z.boolean().default(false),
  filters: z.record(z.unknown()).optional(),
  priority: z.number().int().default(0),
});

export const ReachContractCreateSchema = z.object({
  type: z.enum(REACH_CONTRACT_TYPES),
  targetHandle: z.string().min(2).max(64),
  purpose: z.string().min(1).max(1000),
  message: z.string().max(5000).optional(),
  structuredData: z.record(z.unknown()).optional(),
  expiresInHours: z.number().int().positive().max(720).optional(), // max 30 days
});

// ---------------------------------------------------------------------------
// Derived types
// ---------------------------------------------------------------------------

export type ReachActorCreate = z.infer<typeof ReachActorCreateSchema>;
export type ReachPolicyCreate = z.infer<typeof ReachPolicyCreateSchema>;
export type ReachContractCreate = z.infer<typeof ReachContractCreateSchema>;
