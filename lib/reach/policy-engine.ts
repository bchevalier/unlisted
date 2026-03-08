/**
 * Reach policy matching engine.
 *
 * Given a proposed contract, evaluates the target actor's policies in priority
 * order and returns the first matching policy + action (ACCEPT/REJECT/ROUTE/ESCALATE).
 *
 * This module is pure logic — no DB calls — so it can be unit-tested without
 * infrastructure and stays fast on the hot path.
 */

import type {
  ReachContractType,
  ReachPolicyAction,
  ReachActorType,
} from './contracts';

// ---------------------------------------------------------------------------
// Types used by the engine (DB-agnostic shapes)
// ---------------------------------------------------------------------------

export interface PolicyRecord {
  id: string;
  isActive: boolean;
  contractTypes: ReachContractType[];
  action: ReachPolicyAction;
  maxWeeklyInbound: number | null;
  requireVerifiedSender: boolean;
  autoAcceptMatching: boolean;
  escalateToHuman: boolean;
  filters: Record<string, unknown> | null;
  priority: number;
}

export interface ContractProposal {
  type: ReachContractType;
  initiatorType: ReachActorType;
  initiatorVerified: boolean;
  purpose: string;
  tags?: string[];
}

export interface PolicyMatchResult {
  matched: true;
  policyId: string;
  action: ReachPolicyAction;
  autoAccept: boolean;
}

export interface PolicyNoMatch {
  matched: false;
  reason: 'no_active_policies' | 'no_matching_policy' | 'weekly_cap_exceeded';
}

export type PolicyEvaluation = PolicyMatchResult | PolicyNoMatch;

// ---------------------------------------------------------------------------
// Engine
// ---------------------------------------------------------------------------

/**
 * Evaluate policies for a proposed contract.
 *
 * @param policies      – target actor's policies, pre-sorted by priority desc
 * @param proposal      – the incoming contract proposal
 * @param weeklyCount   – how many contracts the target has received this week
 */
export function evaluatePolicies(
  policies: PolicyRecord[],
  proposal: ContractProposal,
  weeklyCount: number,
): PolicyEvaluation {
  const active = policies.filter((p) => p.isActive);
  if (active.length === 0) {
    return { matched: false, reason: 'no_active_policies' };
  }

  // Policies are expected pre-sorted by priority desc; sort defensively.
  const sorted = [...active].sort((a, b) => b.priority - a.priority);

  for (const policy of sorted) {
    // 1. Contract type must be covered by the policy.
    if (!policy.contractTypes.includes(proposal.type)) continue;

    // 2. Verified-sender check.
    if (policy.requireVerifiedSender && !proposal.initiatorVerified) continue;

    // 3. Filter matching (tag-based for now; extensible).
    if (policy.filters && !matchFilters(policy.filters, proposal)) continue;

    // 4. Weekly cap check.
    if (policy.maxWeeklyInbound !== null && weeklyCount >= policy.maxWeeklyInbound) {
      return { matched: false, reason: 'weekly_cap_exceeded' };
    }

    // Policy matched.
    const action: ReachPolicyAction = policy.escalateToHuman ? 'ESCALATE' : policy.action;

    return {
      matched: true,
      policyId: policy.id,
      action,
      autoAccept: policy.autoAcceptMatching,
    };
  }

  return { matched: false, reason: 'no_matching_policy' };
}

// ---------------------------------------------------------------------------
// Filter matching (simple tag intersection for V1)
// ---------------------------------------------------------------------------

function matchFilters(
  filters: Record<string, unknown>,
  proposal: ContractProposal,
): boolean {
  // V1: only supports `requiredTags` — proposal must include at least one.
  const requiredTags = filters['requiredTags'];
  if (Array.isArray(requiredTags) && requiredTags.length > 0) {
    if (!proposal.tags || proposal.tags.length === 0) return false;
    const tagSet = new Set(proposal.tags);
    return requiredTags.some((t) => typeof t === 'string' && tagSet.has(t));
  }

  // No filter criteria → matches.
  return true;
}
