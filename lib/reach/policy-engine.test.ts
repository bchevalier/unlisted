import { describe, it, expect } from 'vitest';
import { evaluatePolicies, evaluatePoliciesWithTrace } from './policy-engine';
import type { PolicyRecord, ContractProposal } from './policy-engine';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makePolicy(overrides: Partial<PolicyRecord> = {}): PolicyRecord {
  return {
    id: 'pol_default',
    isActive: true,
    contractTypes: ['HUMAN_HUMAN'],
    action: 'ACCEPT',
    maxWeeklyInbound: null,
    requireVerifiedSender: false,
    autoAcceptMatching: false,
    escalateToHuman: false,
    filters: null,
    priority: 0,
    ...overrides,
  };
}

function makeProposal(overrides: Partial<ContractProposal> = {}): ContractProposal {
  return {
    type: 'HUMAN_HUMAN',
    initiatorType: 'HUMAN',
    initiatorVerified: false,
    purpose: 'Test proposal',
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Basic matching
// ---------------------------------------------------------------------------

describe('evaluatePolicies — basic matching', () => {
  it('returns matched policy when contract type matches', () => {
    const result = evaluatePolicies([makePolicy()], makeProposal(), 0);
    expect(result).toEqual({
      matched: true,
      policyId: 'pol_default',
      action: 'ACCEPT',
      autoAccept: false,
    });
  });

  it('returns no_active_policies when all policies are inactive', () => {
    const result = evaluatePolicies(
      [makePolicy({ isActive: false })],
      makeProposal(),
      0,
    );
    expect(result).toEqual({ matched: false, reason: 'no_active_policies' });
  });

  it('returns no_active_policies when policies array is empty', () => {
    const result = evaluatePolicies([], makeProposal(), 0);
    expect(result).toEqual({ matched: false, reason: 'no_active_policies' });
  });

  it('returns no_matching_policy when contract type does not match', () => {
    const result = evaluatePolicies(
      [makePolicy({ contractTypes: ['AI_AI'] })],
      makeProposal({ type: 'HUMAN_HUMAN' }),
      0,
    );
    expect(result).toEqual({ matched: false, reason: 'no_matching_policy' });
  });
});

// ---------------------------------------------------------------------------
// Priority ordering
// ---------------------------------------------------------------------------

describe('evaluatePolicies — priority', () => {
  it('selects highest-priority matching policy', () => {
    const policies = [
      makePolicy({ id: 'low', priority: 1, action: 'REJECT' }),
      makePolicy({ id: 'high', priority: 10, action: 'ACCEPT' }),
      makePolicy({ id: 'mid', priority: 5, action: 'ROUTE' }),
    ];
    const result = evaluatePolicies(policies, makeProposal(), 0);
    expect(result).toMatchObject({ matched: true, policyId: 'high', action: 'ACCEPT' });
  });

  it('falls through to lower-priority policy when higher one does not match type', () => {
    const policies = [
      makePolicy({ id: 'high', priority: 10, contractTypes: ['AI_AI'] }),
      makePolicy({ id: 'low', priority: 1, contractTypes: ['HUMAN_HUMAN'], action: 'ROUTE' }),
    ];
    const result = evaluatePolicies(policies, makeProposal(), 0);
    expect(result).toMatchObject({ matched: true, policyId: 'low', action: 'ROUTE' });
  });
});

// ---------------------------------------------------------------------------
// Verified sender
// ---------------------------------------------------------------------------

describe('evaluatePolicies — verified sender', () => {
  it('skips policy requiring verification when sender is unverified', () => {
    const result = evaluatePolicies(
      [makePolicy({ requireVerifiedSender: true })],
      makeProposal({ initiatorVerified: false }),
      0,
    );
    expect(result).toEqual({ matched: false, reason: 'no_matching_policy' });
  });

  it('matches policy requiring verification when sender is verified', () => {
    const result = evaluatePolicies(
      [makePolicy({ requireVerifiedSender: true })],
      makeProposal({ initiatorVerified: true }),
      0,
    );
    expect(result).toMatchObject({ matched: true, policyId: 'pol_default' });
  });

  it('falls through to non-verified policy when sender is unverified', () => {
    const policies = [
      makePolicy({ id: 'strict', priority: 10, requireVerifiedSender: true }),
      makePolicy({ id: 'fallback', priority: 1, requireVerifiedSender: false }),
    ];
    const result = evaluatePolicies(policies, makeProposal({ initiatorVerified: false }), 0);
    expect(result).toMatchObject({ matched: true, policyId: 'fallback' });
  });
});

// ---------------------------------------------------------------------------
// Weekly cap
// ---------------------------------------------------------------------------

describe('evaluatePolicies — weekly cap', () => {
  it('returns weekly_cap_exceeded when count meets maxWeeklyInbound', () => {
    const result = evaluatePolicies(
      [makePolicy({ maxWeeklyInbound: 5 })],
      makeProposal(),
      5,
    );
    expect(result).toEqual({ matched: false, reason: 'weekly_cap_exceeded' });
  });

  it('returns weekly_cap_exceeded when count exceeds maxWeeklyInbound', () => {
    const result = evaluatePolicies(
      [makePolicy({ maxWeeklyInbound: 5 })],
      makeProposal(),
      100,
    );
    expect(result).toEqual({ matched: false, reason: 'weekly_cap_exceeded' });
  });

  it('matches when count is under maxWeeklyInbound', () => {
    const result = evaluatePolicies(
      [makePolicy({ maxWeeklyInbound: 5 })],
      makeProposal(),
      4,
    );
    expect(result).toMatchObject({ matched: true });
  });

  it('ignores cap when maxWeeklyInbound is null', () => {
    const result = evaluatePolicies(
      [makePolicy({ maxWeeklyInbound: null })],
      makeProposal(),
      99999,
    );
    expect(result).toMatchObject({ matched: true });
  });
});

// ---------------------------------------------------------------------------
// Escalation
// ---------------------------------------------------------------------------

describe('evaluatePolicies — escalation', () => {
  it('overrides action to ESCALATE when escalateToHuman is true', () => {
    const result = evaluatePolicies(
      [makePolicy({ action: 'ACCEPT', escalateToHuman: true })],
      makeProposal(),
      0,
    );
    expect(result).toMatchObject({ matched: true, action: 'ESCALATE' });
  });

  it('does not override when escalateToHuman is false', () => {
    const result = evaluatePolicies(
      [makePolicy({ action: 'ROUTE', escalateToHuman: false })],
      makeProposal(),
      0,
    );
    expect(result).toMatchObject({ matched: true, action: 'ROUTE' });
  });
});

// ---------------------------------------------------------------------------
// Auto-accept
// ---------------------------------------------------------------------------

describe('evaluatePolicies — autoAccept', () => {
  it('returns autoAccept true when policy has autoAcceptMatching', () => {
    const result = evaluatePolicies(
      [makePolicy({ autoAcceptMatching: true })],
      makeProposal(),
      0,
    );
    expect(result).toMatchObject({ matched: true, autoAccept: true });
  });

  it('returns autoAccept false when policy does not have autoAcceptMatching', () => {
    const result = evaluatePolicies(
      [makePolicy({ autoAcceptMatching: false })],
      makeProposal(),
      0,
    );
    expect(result).toMatchObject({ matched: true, autoAccept: false });
  });
});

// ---------------------------------------------------------------------------
// Tag-based filters (requiredTags)
// ---------------------------------------------------------------------------

describe('evaluatePolicies — requiredTags filter', () => {
  it('matches when proposal has at least one required tag', () => {
    const result = evaluatePolicies(
      [makePolicy({ filters: { requiredTags: ['urgent', 'partnership'] } })],
      makeProposal({ tags: ['partnership', 'other'] }),
      0,
    );
    expect(result).toMatchObject({ matched: true });
  });

  it('skips policy when proposal has no matching tags', () => {
    const result = evaluatePolicies(
      [makePolicy({ filters: { requiredTags: ['urgent'] } })],
      makeProposal({ tags: ['casual'] }),
      0,
    );
    expect(result).toEqual({ matched: false, reason: 'no_matching_policy' });
  });

  it('skips policy when proposal has no tags at all', () => {
    const result = evaluatePolicies(
      [makePolicy({ filters: { requiredTags: ['urgent'] } })],
      makeProposal({ tags: undefined }),
      0,
    );
    expect(result).toEqual({ matched: false, reason: 'no_matching_policy' });
  });

  it('skips policy when proposal has empty tags array', () => {
    const result = evaluatePolicies(
      [makePolicy({ filters: { requiredTags: ['urgent'] } })],
      makeProposal({ tags: [] }),
      0,
    );
    expect(result).toEqual({ matched: false, reason: 'no_matching_policy' });
  });

  it('matches when filters exist but requiredTags is empty', () => {
    const result = evaluatePolicies(
      [makePolicy({ filters: { requiredTags: [] } })],
      makeProposal(),
      0,
    );
    expect(result).toMatchObject({ matched: true });
  });

  it('matches when filters exist but have no requiredTags key', () => {
    const result = evaluatePolicies(
      [makePolicy({ filters: { someOtherFilter: true } })],
      makeProposal(),
      0,
    );
    expect(result).toMatchObject({ matched: true });
  });
});

// ---------------------------------------------------------------------------
// excludeTags filter
// ---------------------------------------------------------------------------

describe('evaluatePolicies — excludeTags filter', () => {
  it('rejects when proposal has an excluded tag', () => {
    const result = evaluatePolicies(
      [makePolicy({ filters: { excludeTags: ['spam', 'test'] } })],
      makeProposal({ tags: ['partnership', 'spam'] }),
      0,
    );
    expect(result).toEqual({ matched: false, reason: 'no_matching_policy' });
  });

  it('matches when proposal has no excluded tags', () => {
    const result = evaluatePolicies(
      [makePolicy({ filters: { excludeTags: ['spam', 'test'] } })],
      makeProposal({ tags: ['partnership', 'urgent'] }),
      0,
    );
    expect(result).toMatchObject({ matched: true });
  });

  it('matches when proposal has no tags (excludeTags has no effect)', () => {
    const result = evaluatePolicies(
      [makePolicy({ filters: { excludeTags: ['spam'] } })],
      makeProposal({ tags: undefined }),
      0,
    );
    expect(result).toMatchObject({ matched: true });
  });

  it('matches when proposal has empty tags array', () => {
    const result = evaluatePolicies(
      [makePolicy({ filters: { excludeTags: ['spam'] } })],
      makeProposal({ tags: [] }),
      0,
    );
    expect(result).toMatchObject({ matched: true });
  });

  it('matches when excludeTags is empty', () => {
    const result = evaluatePolicies(
      [makePolicy({ filters: { excludeTags: [] } })],
      makeProposal({ tags: ['anything'] }),
      0,
    );
    expect(result).toMatchObject({ matched: true });
  });
});

// ---------------------------------------------------------------------------
// purposeKeywords filter
// ---------------------------------------------------------------------------

describe('evaluatePolicies — purposeKeywords filter', () => {
  it('matches when purpose contains a keyword (case-insensitive)', () => {
    const result = evaluatePolicies(
      [makePolicy({ filters: { purposeKeywords: ['investment', 'funding'] } })],
      makeProposal({ purpose: 'Looking for Series A Funding' }),
      0,
    );
    expect(result).toMatchObject({ matched: true });
  });

  it('rejects when purpose contains no matching keywords', () => {
    const result = evaluatePolicies(
      [makePolicy({ filters: { purposeKeywords: ['investment', 'funding'] } })],
      makeProposal({ purpose: 'Just saying hello' }),
      0,
    );
    expect(result).toEqual({ matched: false, reason: 'no_matching_policy' });
  });

  it('matches substring keywords', () => {
    const result = evaluatePolicies(
      [makePolicy({ filters: { purposeKeywords: ['consult'] } })],
      makeProposal({ purpose: 'Need a consulting session' }),
      0,
    );
    expect(result).toMatchObject({ matched: true });
  });

  it('matches when purposeKeywords is empty', () => {
    const result = evaluatePolicies(
      [makePolicy({ filters: { purposeKeywords: [] } })],
      makeProposal({ purpose: 'Anything' }),
      0,
    );
    expect(result).toMatchObject({ matched: true });
  });

  it('ignores empty string keywords (treated as no valid keywords → filter fails)', () => {
    const result = evaluatePolicies(
      [makePolicy({ filters: { purposeKeywords: [''] } })],
      makeProposal({ purpose: 'Anything' }),
      0,
    );
    // Array has entries but all are empty → none match → filter fails
    expect(result).toEqual({ matched: false, reason: 'no_matching_policy' });
  });

  it('matches when at least one keyword is non-empty and present', () => {
    const result = evaluatePolicies(
      [makePolicy({ filters: { purposeKeywords: ['', 'anything'] } })],
      makeProposal({ purpose: 'Anything goes' }),
      0,
    );
    expect(result).toMatchObject({ matched: true });
  });
});

// ---------------------------------------------------------------------------
// initiatorTypes filter
// ---------------------------------------------------------------------------

describe('evaluatePolicies — initiatorTypes filter', () => {
  it('matches when initiator type is in the allowed list', () => {
    const result = evaluatePolicies(
      [makePolicy({ filters: { initiatorTypes: ['HUMAN', 'ORGANIZATION'] } })],
      makeProposal({ initiatorType: 'HUMAN' }),
      0,
    );
    expect(result).toMatchObject({ matched: true });
  });

  it('rejects when initiator type is not in the allowed list', () => {
    const result = evaluatePolicies(
      [makePolicy({ filters: { initiatorTypes: ['AI_AGENT'] } })],
      makeProposal({ initiatorType: 'HUMAN' }),
      0,
    );
    expect(result).toEqual({ matched: false, reason: 'no_matching_policy' });
  });

  it('matches when initiatorTypes is empty (no constraint)', () => {
    const result = evaluatePolicies(
      [makePolicy({ filters: { initiatorTypes: [] } })],
      makeProposal({ initiatorType: 'HUMAN' }),
      0,
    );
    expect(result).toMatchObject({ matched: true });
  });
});

// ---------------------------------------------------------------------------
// Compound filters (AND logic)
// ---------------------------------------------------------------------------

describe('evaluatePolicies — compound filters (AND logic)', () => {
  it('requires ALL filter criteria to pass', () => {
    const filters = {
      requiredTags: ['urgent'],
      purposeKeywords: ['funding'],
      initiatorTypes: ['HUMAN'],
    };

    // All match
    const r1 = evaluatePolicies(
      [makePolicy({ filters })],
      makeProposal({ tags: ['urgent'], purpose: 'Need funding', initiatorType: 'HUMAN' }),
      0,
    );
    expect(r1).toMatchObject({ matched: true });

    // Missing tag
    const r2 = evaluatePolicies(
      [makePolicy({ filters })],
      makeProposal({ tags: ['casual'], purpose: 'Need funding', initiatorType: 'HUMAN' }),
      0,
    );
    expect(r2).toEqual({ matched: false, reason: 'no_matching_policy' });

    // Wrong keyword
    const r3 = evaluatePolicies(
      [makePolicy({ filters })],
      makeProposal({ tags: ['urgent'], purpose: 'Just chatting', initiatorType: 'HUMAN' }),
      0,
    );
    expect(r3).toEqual({ matched: false, reason: 'no_matching_policy' });

    // Wrong initiator type
    const r4 = evaluatePolicies(
      [makePolicy({ filters })],
      makeProposal({ tags: ['urgent'], purpose: 'Need funding', initiatorType: 'AI_AGENT' }),
      0,
    );
    expect(r4).toEqual({ matched: false, reason: 'no_matching_policy' });
  });

  it('combines requiredTags + excludeTags correctly', () => {
    const filters = { requiredTags: ['partnership'], excludeTags: ['spam'] };

    // Has required, no excluded
    const r1 = evaluatePolicies(
      [makePolicy({ filters })],
      makeProposal({ tags: ['partnership', 'urgent'] }),
      0,
    );
    expect(r1).toMatchObject({ matched: true });

    // Has required but also excluded
    const r2 = evaluatePolicies(
      [makePolicy({ filters })],
      makeProposal({ tags: ['partnership', 'spam'] }),
      0,
    );
    expect(r2).toEqual({ matched: false, reason: 'no_matching_policy' });

    // Has excluded, no required
    const r3 = evaluatePolicies(
      [makePolicy({ filters })],
      makeProposal({ tags: ['spam'] }),
      0,
    );
    expect(r3).toEqual({ matched: false, reason: 'no_matching_policy' });
  });
});

// ---------------------------------------------------------------------------
// Multi-contract-type policies
// ---------------------------------------------------------------------------

describe('evaluatePolicies — multi-type policies', () => {
  it('matches when policy covers multiple types including the proposal type', () => {
    const policy = makePolicy({ contractTypes: ['HUMAN_HUMAN', 'AI_HUMAN', 'HUMAN_AI'] });
    expect(evaluatePolicies([policy], makeProposal({ type: 'AI_HUMAN' }), 0)).toMatchObject({
      matched: true,
    });
  });

  it('does not match when proposal type is not in the policy list', () => {
    const policy = makePolicy({ contractTypes: ['HUMAN_AI', 'AI_AI'] });
    expect(evaluatePolicies([policy], makeProposal({ type: 'HUMAN_HUMAN' }), 0)).toEqual({
      matched: false,
      reason: 'no_matching_policy',
    });
  });
});

// ---------------------------------------------------------------------------
// Complex scenarios
// ---------------------------------------------------------------------------

describe('evaluatePolicies — complex multi-policy scenarios', () => {
  it('evaluates cascading policies correctly', () => {
    const policies = [
      // High-priority: only verified AI senders with urgent tag
      makePolicy({
        id: 'strict-ai',
        priority: 100,
        contractTypes: ['AI_HUMAN'],
        requireVerifiedSender: true,
        filters: { requiredTags: ['urgent'] },
        action: 'ACCEPT',
        autoAcceptMatching: true,
      }),
      // Medium: any AI sender, capped
      makePolicy({
        id: 'ai-capped',
        priority: 50,
        contractTypes: ['AI_HUMAN'],
        maxWeeklyInbound: 10,
        action: 'ROUTE',
      }),
      // Low: catch-all for human
      makePolicy({
        id: 'human-catchall',
        priority: 1,
        contractTypes: ['HUMAN_HUMAN'],
        action: 'ACCEPT',
      }),
    ];

    // Unverified AI without tag → falls to ai-capped
    const r1 = evaluatePolicies(
      policies,
      makeProposal({ type: 'AI_HUMAN', initiatorType: 'AI_AGENT', initiatorVerified: false }),
      5,
    );
    expect(r1).toMatchObject({ matched: true, policyId: 'ai-capped', action: 'ROUTE' });

    // Unverified AI, cap exceeded → weekly_cap_exceeded
    const r2 = evaluatePolicies(
      policies,
      makeProposal({ type: 'AI_HUMAN', initiatorType: 'AI_AGENT', initiatorVerified: false }),
      10,
    );
    expect(r2).toEqual({ matched: false, reason: 'weekly_cap_exceeded' });

    // Verified AI with urgent tag → strict-ai auto-accept
    const r3 = evaluatePolicies(
      policies,
      makeProposal({
        type: 'AI_HUMAN',
        initiatorType: 'AI_AGENT',
        initiatorVerified: true,
        tags: ['urgent'],
      }),
      0,
    );
    expect(r3).toMatchObject({
      matched: true,
      policyId: 'strict-ai',
      action: 'ACCEPT',
      autoAccept: true,
    });

    // HUMAN_HUMAN → human-catchall
    const r4 = evaluatePolicies(
      policies,
      makeProposal({ type: 'HUMAN_HUMAN' }),
      0,
    );
    expect(r4).toMatchObject({ matched: true, policyId: 'human-catchall', action: 'ACCEPT' });
  });
});

// ===========================================================================
// evaluatePoliciesWithTrace
// ===========================================================================

describe('evaluatePoliciesWithTrace', () => {
  it('returns a trace entry for every policy', () => {
    const policies = [
      makePolicy({ id: 'p1', priority: 10, contractTypes: ['AI_AI'] }),
      makePolicy({ id: 'p2', priority: 5 }),
      makePolicy({ id: 'p3', priority: 1, isActive: false }),
    ];

    const result = evaluatePoliciesWithTrace(policies, makeProposal(), 0);

    expect(result.result).toMatchObject({ matched: true, policyId: 'p2' });
    expect(result.activePoliciesCount).toBe(2);
    expect(result.trace).toHaveLength(3);

    // Inactive policy
    const inactiveEntry = result.trace.find((t) => t.policyId === 'p3');
    expect(inactiveEntry).toMatchObject({ outcome: 'skipped', skipReason: 'inactive' });

    // Type mismatch
    const mismatchEntry = result.trace.find((t) => t.policyId === 'p1');
    expect(mismatchEntry).toMatchObject({ outcome: 'skipped', skipReason: 'contract_type_mismatch' });

    // Matched
    const matchedEntry = result.trace.find((t) => t.policyId === 'p2');
    expect(matchedEntry).toMatchObject({ outcome: 'matched' });
  });

  it('traces filter failures with failedFilters detail', () => {
    const policies = [
      makePolicy({
        id: 'p1',
        priority: 10,
        filters: { requiredTags: ['vip'], purposeKeywords: ['invest'] },
      }),
      makePolicy({ id: 'p2', priority: 1 }),
    ];

    const result = evaluatePoliciesWithTrace(
      policies,
      makeProposal({ tags: ['casual'], purpose: 'Just saying hello' }),
      0,
    );

    expect(result.result).toMatchObject({ matched: true, policyId: 'p2' });

    const p1Trace = result.trace.find((t) => t.policyId === 'p1');
    expect(p1Trace).toMatchObject({
      outcome: 'skipped',
      skipReason: 'filter_mismatch',
    });
    expect(p1Trace!.failedFilters).toContain('requiredTags');
    expect(p1Trace!.failedFilters).toContain('purposeKeywords');
  });

  it('traces weekly cap exceeded correctly', () => {
    const policies = [makePolicy({ id: 'p1', maxWeeklyInbound: 3 })];

    const result = evaluatePoliciesWithTrace(policies, makeProposal(), 5);

    expect(result.result).toEqual({ matched: false, reason: 'weekly_cap_exceeded' });
    expect(result.trace).toHaveLength(1);
    expect(result.trace[0]).toMatchObject({
      policyId: 'p1',
      outcome: 'cap_exceeded',
      skipReason: 'weekly_cap_exceeded',
    });
  });

  it('traces verified sender skip', () => {
    const policies = [
      makePolicy({ id: 'strict', priority: 10, requireVerifiedSender: true }),
    ];

    const result = evaluatePoliciesWithTrace(
      policies,
      makeProposal({ initiatorVerified: false }),
      0,
    );

    expect(result.result).toEqual({ matched: false, reason: 'no_matching_policy' });
    expect(result.trace[0]).toMatchObject({
      outcome: 'skipped',
      skipReason: 'unverified_sender',
    });
  });

  it('returns no_active_policies trace for all-inactive set', () => {
    const policies = [
      makePolicy({ id: 'p1', isActive: false }),
      makePolicy({ id: 'p2', isActive: false }),
    ];

    const result = evaluatePoliciesWithTrace(policies, makeProposal(), 0);

    expect(result.result).toEqual({ matched: false, reason: 'no_active_policies' });
    expect(result.activePoliciesCount).toBe(0);
    expect(result.trace).toHaveLength(2);
    expect(result.trace.every((t) => t.skipReason === 'inactive')).toBe(true);
  });

  it('includes evaluationTimeUs as a non-negative number', () => {
    const result = evaluatePoliciesWithTrace([makePolicy()], makeProposal(), 0);
    expect(result.evaluationTimeUs).toBeGreaterThanOrEqual(0);
    expect(typeof result.evaluationTimeUs).toBe('number');
  });

  it('produces same result as evaluatePolicies', () => {
    const policies = [
      makePolicy({
        id: 'strict-ai',
        priority: 100,
        contractTypes: ['AI_HUMAN'],
        requireVerifiedSender: true,
        filters: { requiredTags: ['urgent'], excludeTags: ['spam'] },
        action: 'ACCEPT',
        autoAcceptMatching: true,
      }),
      makePolicy({
        id: 'ai-capped',
        priority: 50,
        contractTypes: ['AI_HUMAN'],
        maxWeeklyInbound: 10,
        action: 'ROUTE',
      }),
      makePolicy({
        id: 'human-catchall',
        priority: 1,
        contractTypes: ['HUMAN_HUMAN'],
        action: 'ACCEPT',
      }),
    ];

    const proposal = makeProposal({
      type: 'AI_HUMAN',
      initiatorType: 'AI_AGENT',
      initiatorVerified: true,
      tags: ['urgent'],
    });

    const basic = evaluatePolicies(policies, proposal, 0);
    const traced = evaluatePoliciesWithTrace(policies, proposal, 0);

    expect(traced.result).toEqual(basic);
  });
});

// ---------------------------------------------------------------------------
// Edge: excludeTags with compound filters in trace mode
// ---------------------------------------------------------------------------

describe('evaluatePoliciesWithTrace — compound filter trace', () => {
  it('reports multiple failed filter criteria in trace', () => {
    const policies = [
      makePolicy({
        id: 'p1',
        filters: {
          requiredTags: ['vip'],
          excludeTags: ['blocked'],
          purposeKeywords: ['invest'],
          initiatorTypes: ['AI_AGENT'],
        },
      }),
    ];

    const result = evaluatePoliciesWithTrace(
      policies,
      makeProposal({
        tags: ['blocked'],
        purpose: 'General question',
        initiatorType: 'HUMAN',
      }),
      0,
    );

    expect(result.result).toEqual({ matched: false, reason: 'no_matching_policy' });
    const entry = result.trace[0];
    expect(entry.skipReason).toBe('filter_mismatch');
    // All four criteria should fail
    expect(entry.failedFilters).toContain('requiredTags');
    expect(entry.failedFilters).toContain('excludeTags');
    expect(entry.failedFilters).toContain('purposeKeywords');
    expect(entry.failedFilters).toContain('initiatorTypes');
  });
});
