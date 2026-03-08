import { describe, it, expect } from 'vitest';
import { evaluatePolicies } from './policy-engine';
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
// Tag-based filters
// ---------------------------------------------------------------------------

describe('evaluatePolicies — tag filters', () => {
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
