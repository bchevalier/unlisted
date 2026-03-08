import { describe, it, expect, vi, beforeEach } from 'vitest';
import { reachDisabledResponse, unauthorizedResponse } from './auth';
import type { ReachAuthResult } from './auth';

// ---------------------------------------------------------------------------
// reachDisabledResponse
// ---------------------------------------------------------------------------

describe('reachDisabledResponse', () => {
  beforeEach(() => {
    vi.unstubAllEnvs();
  });

  it('returns null when Reach is enabled (default)', () => {
    vi.stubEnv('ENABLE_REACH', 'true');
    const result = reachDisabledResponse();
    expect(result).toBeNull();
  });

  it('returns 403 response when Reach is disabled', () => {
    vi.stubEnv('ENABLE_REACH', 'false');
    const result = reachDisabledResponse();
    expect(result).not.toBeNull();
    expect(result!.status).toBe(403);
  });
});

// ---------------------------------------------------------------------------
// unauthorizedResponse
// ---------------------------------------------------------------------------

describe('unauthorizedResponse', () => {
  it('returns a 401 JSON response', async () => {
    const response = unauthorizedResponse();
    expect(response.status).toBe(401);
    const body = await response.json();
    expect(body.ok).toBe(false);
    expect(body.error).toBe('Authentication required');
  });
});

// ---------------------------------------------------------------------------
// ReachAuthResult shape
// ---------------------------------------------------------------------------

describe('ReachAuthResult interface', () => {
  it('supports delegation fields', () => {
    const auth: ReachAuthResult = {
      actorId: 'org-1',
      actorType: 'ORGANIZATION',
      userId: null,
      delegatorActorId: 'agent-1',
      delegatorActorType: 'AI_AGENT',
      apiKeyScopes: ['CONTRACT_PROPOSE', 'CONTRACT_READ'],
    };

    expect(auth.delegatorActorId).toBe('agent-1');
    expect(auth.delegatorActorType).toBe('AI_AGENT');
    expect(auth.apiKeyScopes).toHaveLength(2);
  });

  it('supports basic auth without delegation', () => {
    const auth: ReachAuthResult = {
      actorId: 'actor-1',
      actorType: 'HUMAN',
      userId: 'user-1',
    };

    expect(auth.delegatorActorId).toBeUndefined();
    expect(auth.apiKeyScopes).toBeUndefined();
  });
});
