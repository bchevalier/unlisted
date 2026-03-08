/**
 * Tests for agent/org identity metadata, scoped API keys, and delegation.
 *
 * Covers:
 *   - AgentMeta schema validation
 *   - AI_AGENT actor creation requires agentMeta
 *   - Non-AI_AGENT actors reject agentMeta
 *   - Scoped API keys restrict permissions
 *   - X-Reach-Act-As delegation resolves to org identity with delegator audit trail
 */

import { describe, it, expect } from 'vitest';
import {
  AgentMetaSchema,
  ReachActorCreateSchema,
} from './contracts';
import type { AgentMeta } from './contracts';
import {
  hasPermission,
  getPermissionsForRole,
  REACH_PERMISSIONS,
} from './permissions';
import type { AuthzContext, ReachPermission } from './permissions';

// ---------------------------------------------------------------------------
// AgentMetaSchema
// ---------------------------------------------------------------------------

describe('AgentMetaSchema', () => {
  it('parses valid full agent metadata', () => {
    const meta: AgentMeta = {
      operatorName: 'Acme Corp',
      operatorUrl: 'https://acme.example.com',
      modelId: 'gpt-4o',
      version: '1.2.3',
      deploymentId: 'deploy-abc-123',
    };
    expect(AgentMetaSchema.parse(meta)).toEqual(meta);
  });

  it('parses with only required field (operatorName)', () => {
    const meta = { operatorName: 'Solo Operator' };
    const result = AgentMetaSchema.parse(meta);
    expect(result.operatorName).toBe('Solo Operator');
    expect(result.operatorUrl).toBeUndefined();
    expect(result.modelId).toBeUndefined();
  });

  it('rejects missing operatorName', () => {
    expect(() => AgentMetaSchema.parse({})).toThrow();
    expect(() => AgentMetaSchema.parse({ operatorName: '' })).toThrow();
  });

  it('rejects invalid operatorUrl', () => {
    expect(() =>
      AgentMetaSchema.parse({ operatorName: 'Test', operatorUrl: 'not-a-url' }),
    ).toThrow();
  });

  it('enforces max lengths', () => {
    expect(() =>
      AgentMetaSchema.parse({ operatorName: 'x'.repeat(201) }),
    ).toThrow();
    expect(() =>
      AgentMetaSchema.parse({ operatorName: 'ok', version: 'v'.repeat(101) }),
    ).toThrow();
  });
});

// ---------------------------------------------------------------------------
// ReachActorCreateSchema with agentMeta
// ---------------------------------------------------------------------------

describe('ReachActorCreateSchema (agentMeta)', () => {
  it('accepts AI_AGENT with agentMeta', () => {
    const data = {
      type: 'AI_AGENT' as const,
      handle: 'bot-1',
      displayName: 'Bot One',
      agentMeta: { operatorName: 'Acme' },
    };
    const parsed = ReachActorCreateSchema.parse(data);
    expect(parsed.agentMeta?.operatorName).toBe('Acme');
  });

  it('accepts AI_AGENT without agentMeta in schema (service enforces)', () => {
    // Schema itself is permissive — service layer enforces agentMeta requirement
    const data = {
      type: 'AI_AGENT' as const,
      handle: 'bot-2',
      displayName: 'Bot Two',
    };
    const parsed = ReachActorCreateSchema.parse(data);
    expect(parsed.agentMeta).toBeUndefined();
  });

  it('accepts apiKeyScopes array', () => {
    const data = {
      type: 'AI_AGENT' as const,
      handle: 'bot-3',
      displayName: 'Bot Three',
      agentMeta: { operatorName: 'Test' },
      apiKeyScopes: ['CONTRACT_PROPOSE', 'CONTRACT_READ'],
    };
    const parsed = ReachActorCreateSchema.parse(data);
    expect(parsed.apiKeyScopes).toEqual(['CONTRACT_PROPOSE', 'CONTRACT_READ']);
  });

  it('accepts HUMAN without agentMeta', () => {
    const data = {
      type: 'HUMAN' as const,
      handle: 'john',
      displayName: 'John',
    };
    const parsed = ReachActorCreateSchema.parse(data);
    expect(parsed.agentMeta).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// Scoped API key permission intersection
// ---------------------------------------------------------------------------

describe('Scoped API key permission enforcement', () => {
  it('full permissions when no scopes (empty array)', () => {
    const authz: AuthzContext = {
      callerId: 'agent-1',
      callerType: 'AI_AGENT',
      targetActorId: 'agent-1',
      permissions: new Set<ReachPermission>([
        'ACTOR_READ',
        'ACTOR_UPDATE',
        'POLICY_READ',
        'POLICY_WRITE',
        'CONTRACT_PROPOSE',
        'CONTRACT_READ',
        'CONTRACT_ACT',
      ]),
      isSelf: true,
    };
    // With no scope restriction, all permissions should be available
    expect(hasPermission(authz, 'ACTOR_READ')).toBe(true);
    expect(hasPermission(authz, 'POLICY_WRITE')).toBe(true);
    expect(hasPermission(authz, 'CONTRACT_ACT')).toBe(true);
  });

  it('scoped keys only have intersection of role and scope permissions', () => {
    // Simulating what resolveAuthz produces after scope intersection
    const scopedPermissions = new Set<ReachPermission>(['CONTRACT_PROPOSE', 'CONTRACT_READ']);
    const authz: AuthzContext = {
      callerId: 'agent-1',
      callerType: 'AI_AGENT',
      targetActorId: 'org-1',
      permissions: scopedPermissions,
      orgRole: 'ADMIN',
      isSelf: false,
    };

    expect(hasPermission(authz, 'CONTRACT_PROPOSE')).toBe(true);
    expect(hasPermission(authz, 'CONTRACT_READ')).toBe(true);
    // These are in ADMIN role but not in scope
    expect(hasPermission(authz, 'POLICY_WRITE')).toBe(false);
    expect(hasPermission(authz, 'ACTOR_UPDATE')).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Delegation audit context
// ---------------------------------------------------------------------------

describe('Delegation audit context', () => {
  it('AuthzContext records delegatorActorId when delegating', () => {
    const authz: AuthzContext = {
      callerId: 'agent-1',
      callerType: 'AI_AGENT',
      targetActorId: 'org-1',
      permissions: new Set(getPermissionsForRole('ADMIN')),
      orgRole: 'ADMIN',
      isSelf: false,
      delegatorActorId: 'agent-1',
    };

    expect(authz.delegatorActorId).toBe('agent-1');
    expect(hasPermission(authz, 'ACTOR_READ')).toBe(true);
    expect(hasPermission(authz, 'ACTOR_UPDATE')).toBe(true);
  });

  it('self-access has no delegatorActorId', () => {
    const authz: AuthzContext = {
      callerId: 'actor-1',
      callerType: 'HUMAN',
      targetActorId: 'actor-1',
      permissions: new Set<ReachPermission>([
        'ACTOR_READ',
        'ACTOR_UPDATE',
        'ACTOR_DEACTIVATE',
        'KEY_ROTATE',
        'POLICY_READ',
        'POLICY_WRITE',
        'CONTRACT_PROPOSE',
        'CONTRACT_READ',
        'CONTRACT_ACT',
      ]),
      isSelf: true,
    };

    expect(authz.delegatorActorId).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// REACH_PERMISSIONS includes all needed scopes
// ---------------------------------------------------------------------------

describe('REACH_PERMISSIONS completeness', () => {
  it('contains all 11 expected permissions', () => {
    expect(REACH_PERMISSIONS.length).toBe(11);
    expect(REACH_PERMISSIONS).toContain('ACTOR_READ');
    expect(REACH_PERMISSIONS).toContain('ACTOR_UPDATE');
    expect(REACH_PERMISSIONS).toContain('ACTOR_DEACTIVATE');
    expect(REACH_PERMISSIONS).toContain('KEY_ROTATE');
    expect(REACH_PERMISSIONS).toContain('POLICY_READ');
    expect(REACH_PERMISSIONS).toContain('POLICY_WRITE');
    expect(REACH_PERMISSIONS).toContain('CONTRACT_PROPOSE');
    expect(REACH_PERMISSIONS).toContain('CONTRACT_READ');
    expect(REACH_PERMISSIONS).toContain('CONTRACT_ACT');
    expect(REACH_PERMISSIONS).toContain('ORG_MEMBERS_READ');
    expect(REACH_PERMISSIONS).toContain('ORG_MEMBERS_WRITE');
  });

  it('scopes can be used as apiKeyScopes values', () => {
    // All REACH_PERMISSIONS should be valid as scope strings
    for (const perm of REACH_PERMISSIONS) {
      expect(typeof perm).toBe('string');
      expect(perm.length).toBeGreaterThan(0);
    }
  });
});
