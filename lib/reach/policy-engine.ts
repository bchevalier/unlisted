/**
 * Reach policy matching engine.
 *
 * Given a proposed contract, evaluates the target actor's policies in priority
 * order and returns the first matching policy + action (ACCEPT/REJECT/ROUTE/ESCALATE).
 *
 * This module is pure logic — no DB calls — so it can be unit-tested without
 * infrastructure and stays fast on the hot path.
 *
 * ## Filter semantics (V1)
 *
 * Filters use **AND** logic: every specified filter criterion must pass for the
 * filter to match. Individual criteria:
 *
 *   - `requiredTags`   (string[]) — proposal must have at least one matching tag
 *   - `excludeTags`    (string[]) — proposal must NOT have any of these tags
 *   - `purposeKeywords`(string[]) — purpose must contain at least one keyword (case-insensitive)
 *   - `initiatorTypes` (string[]) — initiator actor type must be one of these
 *
 * Empty or missing criteria are skipped (treated as "no constraint").
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
// Trace types (for debugging / UI explanation)
// ---------------------------------------------------------------------------

export type PolicySkipReason =
  | 'inactive'
  | 'contract_type_mismatch'
  | 'unverified_sender'
  | 'filter_mismatch'
  | 'weekly_cap_exceeded';

export interface PolicyTraceEntry {
  policyId: string;
  priority: number;
  outcome: 'matched' | 'skipped' | 'cap_exceeded';
  skipReason?: PolicySkipReason;
  /** Which filter criteria failed (only set when skipReason is 'filter_mismatch'). */
  failedFilters?: string[];
}

export interface PolicyEvaluationTrace {
  result: PolicyEvaluation;
  /** One entry per policy examined, in evaluation order (priority desc). */
  trace: PolicyTraceEntry[];
  /** Total active policies considered. */
  activePoliciesCount: number;
  /** Wall-clock microseconds spent in evaluation (approximate). */
  evaluationTimeUs: number;
}

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

    // 3. Filter matching (AND logic across all criteria).
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

/**
 * Evaluate policies with a full trace of why each policy matched or was skipped.
 *
 * Same logic as `evaluatePolicies` but collects diagnostic info for every policy.
 * Use this for debugging, admin UIs, or dry-run previews — not on the hot path
 * for every contract proposal.
 */
export function evaluatePoliciesWithTrace(
  policies: PolicyRecord[],
  proposal: ContractProposal,
  weeklyCount: number,
): PolicyEvaluationTrace {
  const startTime = performance.now();
  const trace: PolicyTraceEntry[] = [];

  const active = policies.filter((p) => p.isActive);
  const inactiveIds = policies.filter((p) => !p.isActive);

  // Record inactive policies.
  for (const p of inactiveIds) {
    trace.push({ policyId: p.id, priority: p.priority, outcome: 'skipped', skipReason: 'inactive' });
  }

  if (active.length === 0) {
    return {
      result: { matched: false, reason: 'no_active_policies' },
      trace,
      activePoliciesCount: 0,
      evaluationTimeUs: elapsedUs(startTime),
    };
  }

  const sorted = [...active].sort((a, b) => b.priority - a.priority);

  for (const policy of sorted) {
    // 1. Contract type.
    if (!policy.contractTypes.includes(proposal.type)) {
      trace.push({
        policyId: policy.id,
        priority: policy.priority,
        outcome: 'skipped',
        skipReason: 'contract_type_mismatch',
      });
      continue;
    }

    // 2. Verified sender.
    if (policy.requireVerifiedSender && !proposal.initiatorVerified) {
      trace.push({
        policyId: policy.id,
        priority: policy.priority,
        outcome: 'skipped',
        skipReason: 'unverified_sender',
      });
      continue;
    }

    // 3. Filters.
    if (policy.filters) {
      const filterResult = matchFiltersDetailed(policy.filters, proposal);
      if (!filterResult.pass) {
        trace.push({
          policyId: policy.id,
          priority: policy.priority,
          outcome: 'skipped',
          skipReason: 'filter_mismatch',
          failedFilters: filterResult.failedCriteria,
        });
        continue;
      }
    }

    // 4. Weekly cap.
    if (policy.maxWeeklyInbound !== null && weeklyCount >= policy.maxWeeklyInbound) {
      trace.push({
        policyId: policy.id,
        priority: policy.priority,
        outcome: 'cap_exceeded',
        skipReason: 'weekly_cap_exceeded',
      });
      return {
        result: { matched: false, reason: 'weekly_cap_exceeded' },
        trace,
        activePoliciesCount: active.length,
        evaluationTimeUs: elapsedUs(startTime),
      };
    }

    // Matched.
    const action: ReachPolicyAction = policy.escalateToHuman ? 'ESCALATE' : policy.action;
    trace.push({ policyId: policy.id, priority: policy.priority, outcome: 'matched' });

    return {
      result: {
        matched: true,
        policyId: policy.id,
        action,
        autoAccept: policy.autoAcceptMatching,
      },
      trace,
      activePoliciesCount: active.length,
      evaluationTimeUs: elapsedUs(startTime),
    };
  }

  return {
    result: { matched: false, reason: 'no_matching_policy' },
    trace,
    activePoliciesCount: active.length,
    evaluationTimeUs: elapsedUs(startTime),
  };
}

// ---------------------------------------------------------------------------
// Filter matching — AND logic across all criteria
// ---------------------------------------------------------------------------

/**
 * Check whether a proposal passes all filter criteria.
 * Criteria use AND logic: every specified criterion must pass.
 */
function matchFilters(
  filters: Record<string, unknown>,
  proposal: ContractProposal,
): boolean {
  return matchFiltersDetailed(filters, proposal).pass;
}

interface FilterResult {
  pass: boolean;
  /** Names of criteria that failed (empty when pass is true). */
  failedCriteria: string[];
}

/**
 * Detailed filter matching — returns which criteria failed.
 * Used by both `matchFilters` (hot path) and `evaluatePoliciesWithTrace` (debug).
 */
function matchFiltersDetailed(
  filters: Record<string, unknown>,
  proposal: ContractProposal,
): FilterResult {
  const failed: string[] = [];

  // --- requiredTags: proposal must include at least one ---
  const requiredTags = filters['requiredTags'];
  if (Array.isArray(requiredTags) && requiredTags.length > 0) {
    if (!proposal.tags || proposal.tags.length === 0) {
      failed.push('requiredTags');
    } else {
      const tagSet = new Set(proposal.tags);
      if (!requiredTags.some((t) => typeof t === 'string' && tagSet.has(t))) {
        failed.push('requiredTags');
      }
    }
  }

  // --- excludeTags: proposal must NOT have any of these ---
  const excludeTags = filters['excludeTags'];
  if (Array.isArray(excludeTags) && excludeTags.length > 0 && proposal.tags && proposal.tags.length > 0) {
    const tagSet = new Set(proposal.tags);
    if (excludeTags.some((t) => typeof t === 'string' && tagSet.has(t))) {
      failed.push('excludeTags');
    }
  }

  // --- purposeKeywords: purpose must contain at least one keyword (case-insensitive) ---
  const purposeKeywords = filters['purposeKeywords'];
  if (Array.isArray(purposeKeywords) && purposeKeywords.length > 0) {
    const lowerPurpose = proposal.purpose.toLowerCase();
    if (!purposeKeywords.some((kw) => typeof kw === 'string' && kw.length > 0 && lowerPurpose.includes(kw.toLowerCase()))) {
      failed.push('purposeKeywords');
    }
  }

  // --- initiatorTypes: initiator must be one of the listed types ---
  const initiatorTypes = filters['initiatorTypes'];
  if (Array.isArray(initiatorTypes) && initiatorTypes.length > 0) {
    if (!initiatorTypes.includes(proposal.initiatorType)) {
      failed.push('initiatorTypes');
    }
  }

  return { pass: failed.length === 0, failedCriteria: failed };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function elapsedUs(startMs: number): number {
  return Math.round((performance.now() - startMs) * 1000);
}
