import { describe, it, expect } from 'vitest';
import {
  canTransition,
  validateActorTypes,
  ReachActorCreateSchema,
  ReachPolicyCreateSchema,
  ReachContractCreateSchema,
  PolicyFiltersSchema,
  CONTRACT_TRANSITIONS,
  REACH_CONTRACT_STATUSES,
} from './contracts';

// ---------------------------------------------------------------------------
// canTransition
// ---------------------------------------------------------------------------

describe('canTransition', () => {
  it('allows PROPOSED → ACTIVE', () => {
    expect(canTransition('PROPOSED', 'ACTIVE')).toBe(true);
  });

  it('allows PROPOSED → REJECTED', () => {
    expect(canTransition('PROPOSED', 'REJECTED')).toBe(true);
  });

  it('allows PROPOSED → CANCELLED', () => {
    expect(canTransition('PROPOSED', 'CANCELLED')).toBe(true);
  });

  it('allows PROPOSED → EXPIRED', () => {
    expect(canTransition('PROPOSED', 'EXPIRED')).toBe(true);
  });

  it('allows ACTIVE → FULFILLED', () => {
    expect(canTransition('ACTIVE', 'FULFILLED')).toBe(true);
  });

  it('allows ACTIVE → CANCELLED', () => {
    expect(canTransition('ACTIVE', 'CANCELLED')).toBe(true);
  });

  it('allows ACTIVE → EXPIRED', () => {
    expect(canTransition('ACTIVE', 'EXPIRED')).toBe(true);
  });

  it('rejects PROPOSED → FULFILLED (must go through ACTIVE)', () => {
    expect(canTransition('PROPOSED', 'FULFILLED')).toBe(false);
  });

  it('rejects ACTIVE → PROPOSED (no backward)', () => {
    expect(canTransition('ACTIVE', 'PROPOSED')).toBe(false);
  });

  it('allows REJECTED → PROPOSED (human override)', () => {
    expect(canTransition('REJECTED', 'PROPOSED')).toBe(true);
  });

  it('rejects REJECTED → any non-PROPOSED status', () => {
    for (const status of REACH_CONTRACT_STATUSES) {
      if (status === 'PROPOSED') continue;
      expect(canTransition('REJECTED', status)).toBe(false);
    }
  });

  it('rejects transitions from other terminal states', () => {
    const terminals: Array<'FULFILLED' | 'CANCELLED' | 'EXPIRED'> = [
      'FULFILLED',
      'CANCELLED',
      'EXPIRED',
    ];
    for (const terminal of terminals) {
      for (const status of REACH_CONTRACT_STATUSES) {
        expect(canTransition(terminal, status)).toBe(false);
      }
    }
  });

  it('covers every status as a key in CONTRACT_TRANSITIONS', () => {
    for (const status of REACH_CONTRACT_STATUSES) {
      expect(CONTRACT_TRANSITIONS).toHaveProperty(status);
    }
  });
});

// ---------------------------------------------------------------------------
// validateActorTypes
// ---------------------------------------------------------------------------

describe('validateActorTypes', () => {
  it('accepts HUMAN_HUMAN with HUMAN actors', () => {
    expect(validateActorTypes('HUMAN_HUMAN', 'HUMAN', 'HUMAN')).toBe(true);
  });

  it('accepts HUMAN_AI with HUMAN initiator and AI_AGENT target', () => {
    expect(validateActorTypes('HUMAN_AI', 'HUMAN', 'AI_AGENT')).toBe(true);
  });

  it('accepts AI_HUMAN with AI_AGENT initiator and HUMAN target', () => {
    expect(validateActorTypes('AI_HUMAN', 'AI_AGENT', 'HUMAN')).toBe(true);
  });

  it('accepts AI_AI with AI_AGENT actors', () => {
    expect(validateActorTypes('AI_AI', 'AI_AGENT', 'AI_AGENT')).toBe(true);
  });

  it('rejects HUMAN_HUMAN when initiator is AI_AGENT', () => {
    expect(validateActorTypes('HUMAN_HUMAN', 'AI_AGENT', 'HUMAN')).toBe(false);
  });

  it('rejects HUMAN_AI when target is HUMAN', () => {
    expect(validateActorTypes('HUMAN_AI', 'HUMAN', 'HUMAN')).toBe(false);
  });

  it('rejects AI_HUMAN when initiator is HUMAN', () => {
    expect(validateActorTypes('AI_HUMAN', 'HUMAN', 'HUMAN')).toBe(false);
  });

  it('allows ORGANIZATION in any position (wraps either type)', () => {
    expect(validateActorTypes('HUMAN_HUMAN', 'ORGANIZATION', 'HUMAN')).toBe(true);
    expect(validateActorTypes('HUMAN_HUMAN', 'HUMAN', 'ORGANIZATION')).toBe(true);
    expect(validateActorTypes('AI_AI', 'ORGANIZATION', 'AI_AGENT')).toBe(true);
    expect(validateActorTypes('AI_AI', 'AI_AGENT', 'ORGANIZATION')).toBe(true);
    expect(validateActorTypes('HUMAN_AI', 'ORGANIZATION', 'ORGANIZATION')).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// ReachActorCreateSchema
// ---------------------------------------------------------------------------

describe('ReachActorCreateSchema', () => {
  const validActor = {
    type: 'HUMAN' as const,
    handle: 'john-doe',
    displayName: 'John Doe',
  };

  it('accepts a valid human actor', () => {
    expect(ReachActorCreateSchema.parse(validActor)).toMatchObject(validActor);
  });

  it('accepts an AI agent with endpoint and capabilities', () => {
    const ai = {
      type: 'AI_AGENT' as const,
      handle: 'bot.alpha',
      displayName: 'Alpha Bot',
      endpoint: 'https://example.com/webhook',
      capabilities: { skills: ['search', 'summarize'] },
    };
    expect(ReachActorCreateSchema.parse(ai)).toMatchObject(ai);
  });

  it('rejects handle shorter than 2 chars', () => {
    expect(() => ReachActorCreateSchema.parse({ ...validActor, handle: 'x' })).toThrow();
  });

  it('rejects handle with leading special char', () => {
    expect(() => ReachActorCreateSchema.parse({ ...validActor, handle: '-bad' })).toThrow();
  });

  it('rejects empty displayName', () => {
    expect(() => ReachActorCreateSchema.parse({ ...validActor, displayName: '' })).toThrow();
  });

  it('rejects invalid type', () => {
    expect(() => ReachActorCreateSchema.parse({ ...validActor, type: 'ROBOT' })).toThrow();
  });

  it('rejects invalid endpoint URL', () => {
    expect(() =>
      ReachActorCreateSchema.parse({ ...validActor, endpoint: 'not-a-url' }),
    ).toThrow();
  });
});

// ---------------------------------------------------------------------------
// ReachPolicyCreateSchema
// ---------------------------------------------------------------------------

describe('ReachPolicyCreateSchema', () => {
  const validPolicy = {
    name: 'Default accept',
    contractTypes: ['HUMAN_HUMAN'] as const,
    action: 'ACCEPT' as const,
  };

  it('accepts a minimal valid policy', () => {
    const result = ReachPolicyCreateSchema.parse(validPolicy);
    expect(result.name).toBe('Default accept');
    expect(result.requireVerifiedSender).toBe(false);
    expect(result.autoAcceptMatching).toBe(false);
    expect(result.escalateToHuman).toBe(false);
    expect(result.priority).toBe(0);
  });

  it('accepts a fully-specified policy', () => {
    const full = {
      name: 'Strict AI policy',
      contractTypes: ['AI_HUMAN', 'AI_AI'] as const,
      action: 'ROUTE' as const,
      maxWeeklyInbound: 50,
      requireVerifiedSender: true,
      autoAcceptMatching: true,
      escalateToHuman: true,
      filters: { requiredTags: ['urgent'] },
      priority: 10,
    };
    expect(ReachPolicyCreateSchema.parse(full)).toMatchObject(full);
  });

  it('rejects empty contractTypes', () => {
    expect(() =>
      ReachPolicyCreateSchema.parse({ ...validPolicy, contractTypes: [] }),
    ).toThrow();
  });

  it('rejects invalid action', () => {
    expect(() =>
      ReachPolicyCreateSchema.parse({ ...validPolicy, action: 'FORWARD' }),
    ).toThrow();
  });

  it('rejects non-integer maxWeeklyInbound', () => {
    expect(() =>
      ReachPolicyCreateSchema.parse({ ...validPolicy, maxWeeklyInbound: 5.5 }),
    ).toThrow();
  });

  it('rejects negative maxWeeklyInbound', () => {
    expect(() =>
      ReachPolicyCreateSchema.parse({ ...validPolicy, maxWeeklyInbound: -1 }),
    ).toThrow();
  });
});

// ---------------------------------------------------------------------------
// ReachContractCreateSchema
// ---------------------------------------------------------------------------

describe('ReachContractCreateSchema', () => {
  const validContract = {
    type: 'HUMAN_HUMAN' as const,
    targetHandle: 'jane',
    purpose: 'Discuss partnership opportunity',
  };

  it('accepts a minimal valid contract', () => {
    expect(ReachContractCreateSchema.parse(validContract)).toMatchObject(validContract);
  });

  it('accepts a contract with all optional fields', () => {
    const full = {
      ...validContract,
      message: 'I would love to chat about synergy.',
      structuredData: { budget: 50000 },
      expiresInHours: 48,
    };
    expect(ReachContractCreateSchema.parse(full)).toMatchObject(full);
  });

  it('rejects purpose over 1000 chars', () => {
    expect(() =>
      ReachContractCreateSchema.parse({ ...validContract, purpose: 'x'.repeat(1001) }),
    ).toThrow();
  });

  it('rejects message over 5000 chars', () => {
    expect(() =>
      ReachContractCreateSchema.parse({ ...validContract, message: 'x'.repeat(5001) }),
    ).toThrow();
  });

  it('rejects expiresInHours over 720 (30 days)', () => {
    expect(() =>
      ReachContractCreateSchema.parse({ ...validContract, expiresInHours: 721 }),
    ).toThrow();
  });

  it('rejects non-positive expiresInHours', () => {
    expect(() =>
      ReachContractCreateSchema.parse({ ...validContract, expiresInHours: 0 }),
    ).toThrow();
  });

  it('rejects empty purpose', () => {
    expect(() =>
      ReachContractCreateSchema.parse({ ...validContract, purpose: '' }),
    ).toThrow();
  });

  it('accepts tags array', () => {
    const result = ReachContractCreateSchema.parse({
      ...validContract,
      tags: ['urgent', 'partnership'],
    });
    expect(result.tags).toEqual(['urgent', 'partnership']);
  });

  it('accepts contract without tags', () => {
    const result = ReachContractCreateSchema.parse(validContract);
    expect(result.tags).toBeUndefined();
  });

  it('rejects tags with empty strings', () => {
    expect(() =>
      ReachContractCreateSchema.parse({ ...validContract, tags: [''] }),
    ).toThrow();
  });

  it('rejects more than 20 tags', () => {
    const tooMany = Array.from({ length: 21 }, (_, i) => `tag-${i}`);
    expect(() =>
      ReachContractCreateSchema.parse({ ...validContract, tags: tooMany }),
    ).toThrow();
  });
});

// ---------------------------------------------------------------------------
// PolicyFiltersSchema
// ---------------------------------------------------------------------------

describe('PolicyFiltersSchema', () => {
  it('accepts valid filter with requiredTags', () => {
    const result = PolicyFiltersSchema.parse({ requiredTags: ['urgent', 'vip'] });
    expect(result.requiredTags).toEqual(['urgent', 'vip']);
  });

  it('accepts valid filter with excludeTags', () => {
    const result = PolicyFiltersSchema.parse({ excludeTags: ['spam', 'test'] });
    expect(result.excludeTags).toEqual(['spam', 'test']);
  });

  it('accepts valid filter with purposeKeywords', () => {
    const result = PolicyFiltersSchema.parse({ purposeKeywords: ['invest', 'funding'] });
    expect(result.purposeKeywords).toEqual(['invest', 'funding']);
  });

  it('accepts valid filter with initiatorTypes', () => {
    const result = PolicyFiltersSchema.parse({ initiatorTypes: ['HUMAN', 'AI_AGENT'] });
    expect(result.initiatorTypes).toEqual(['HUMAN', 'AI_AGENT']);
  });

  it('accepts compound filter with all criteria', () => {
    const filter = {
      requiredTags: ['urgent'],
      excludeTags: ['spam'],
      purposeKeywords: ['invest'],
      initiatorTypes: ['HUMAN' as const],
    };
    expect(PolicyFiltersSchema.parse(filter)).toEqual(filter);
  });

  it('accepts empty object (no constraints)', () => {
    expect(PolicyFiltersSchema.parse({})).toEqual({});
  });

  it('rejects unknown filter keys (strict mode)', () => {
    expect(() =>
      PolicyFiltersSchema.parse({ unknownKey: ['value'] }),
    ).toThrow();
  });

  it('rejects requiredTags with non-string elements', () => {
    expect(() =>
      PolicyFiltersSchema.parse({ requiredTags: [123] }),
    ).toThrow();
  });

  it('rejects requiredTags with empty strings', () => {
    expect(() =>
      PolicyFiltersSchema.parse({ requiredTags: [''] }),
    ).toThrow();
  });

  it('rejects requiredTags with more than 50 entries', () => {
    const tooMany = Array.from({ length: 51 }, (_, i) => `tag-${i}`);
    expect(() =>
      PolicyFiltersSchema.parse({ requiredTags: tooMany }),
    ).toThrow();
  });

  it('rejects invalid initiatorTypes', () => {
    expect(() =>
      PolicyFiltersSchema.parse({ initiatorTypes: ['ROBOT'] }),
    ).toThrow();
  });

  it('rejects non-array requiredTags', () => {
    expect(() =>
      PolicyFiltersSchema.parse({ requiredTags: 'not-array' }),
    ).toThrow();
  });
});

// ---------------------------------------------------------------------------
// ReachPolicyCreateSchema — filter validation integration
// ---------------------------------------------------------------------------

describe('ReachPolicyCreateSchema — filter validation', () => {
  const validPolicy = {
    name: 'Test policy',
    contractTypes: ['HUMAN_HUMAN'] as const,
    action: 'ACCEPT' as const,
  };

  it('accepts policy with valid typed filters', () => {
    const result = ReachPolicyCreateSchema.parse({
      ...validPolicy,
      filters: { requiredTags: ['vip'], purposeKeywords: ['invest'] },
    });
    expect(result.filters).toEqual({ requiredTags: ['vip'], purposeKeywords: ['invest'] });
  });

  it('rejects policy with malformed filters (unknown keys)', () => {
    expect(() =>
      ReachPolicyCreateSchema.parse({
        ...validPolicy,
        filters: { badKey: true },
      }),
    ).toThrow();
  });

  it('rejects policy with malformed filters (non-array requiredTags)', () => {
    expect(() =>
      ReachPolicyCreateSchema.parse({
        ...validPolicy,
        filters: { requiredTags: 'not-an-array' },
      }),
    ).toThrow();
  });

  it('accepts policy without filters', () => {
    const result = ReachPolicyCreateSchema.parse(validPolicy);
    expect(result.filters).toBeUndefined();
  });
});
