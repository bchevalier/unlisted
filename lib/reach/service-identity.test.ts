/**
 * Service-layer tests for actor CRUD, org membership, and API key rotation.
 *
 * Covers the identity + permissions surface of the Reach service:
 *   - createActor (HUMAN, AI_AGENT, ORGANIZATION)
 *   - updateActor (display name, capabilities, agentMeta partial merge)
 *   - rotateApiKey (headless only)
 *   - addOrgMember / removeOrgMember / updateOrgMemberRole / listOrgMembers
 *   - ORGANIZATION auto-OWNER on creation
 *   - Last-owner protection on removal and demotion
 *   - listActors with filtering
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// ---------------------------------------------------------------------------
// Mock DB
// ---------------------------------------------------------------------------

const mockFns = vi.hoisted(() => ({
  reachActor: {
    findUnique: vi.fn(),
    findFirst: vi.fn(),
    findMany: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    count: vi.fn(),
  },
  reachOrgMember: {
    findUnique: vi.fn(),
    findMany: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    count: vi.fn(),
  },
  $transaction: vi.fn(),
}));

vi.mock('../db', () => ({
  db: {
    ...mockFns,
    $transaction: mockFns.$transaction,
  },
}));

// Mock permissions import used by createActor for scope validation
vi.mock('./permissions', async () => {
  const actual = await vi.importActual('./permissions');
  return actual;
});

import {
  createActor,
  updateActor,
  rotateApiKey,
  addOrgMember,
  removeOrgMember,
  updateOrgMemberRole,
  listOrgMembers,
  listActors,
} from './service';

// ---------------------------------------------------------------------------
// createActor
// ---------------------------------------------------------------------------

describe('createActor', () => {
  beforeEach(() => vi.clearAllMocks());

  it('creates a HUMAN actor linked to a userId', async () => {
    mockFns.reachActor.findUnique
      .mockResolvedValueOnce(null)  // handle check
      .mockResolvedValueOnce(null); // userId check

    const created = {
      id: 'actor-1',
      type: 'HUMAN',
      handle: 'alice',
      displayName: 'Alice',
      isActive: true,
      apiKeyHash: null,
      apiKeyScopes: [],
      agentMeta: null,
      createdAt: new Date(),
    };
    mockFns.reachActor.create.mockResolvedValue(created);

    const result = await createActor(
      { type: 'HUMAN', handle: 'alice', displayName: 'Alice' },
      'user-1',
    );

    expect(result.actor.id).toBe('actor-1');
    expect(result.apiKey).toBeUndefined(); // HUMAN uses session auth
    expect(mockFns.reachActor.create).toHaveBeenCalledOnce();
    const createData = mockFns.reachActor.create.mock.calls[0][0].data;
    expect(createData.userId).toBe('user-1');
    expect(createData.apiKeyHash).toBeNull();
  });

  it('creates an AI_AGENT actor with API key and agentMeta', async () => {
    mockFns.reachActor.findUnique.mockResolvedValueOnce(null); // handle

    const created = {
      id: 'actor-agent',
      type: 'AI_AGENT',
      handle: 'bot-1',
      displayName: 'Bot One',
      isActive: true,
      apiKeyHash: 'hash',
      apiKeyScopes: [],
      agentMeta: { operatorName: 'Acme' },
      createdAt: new Date(),
    };
    mockFns.reachActor.create.mockResolvedValue(created);

    const result = await createActor({
      type: 'AI_AGENT',
      handle: 'bot-1',
      displayName: 'Bot One',
      agentMeta: { operatorName: 'Acme' },
    });

    expect(result.actor.type).toBe('AI_AGENT');
    expect(result.apiKey).toBeDefined();
    expect(result.apiKey).toMatch(/^knk_/);
    const createData = mockFns.reachActor.create.mock.calls[0][0].data;
    expect(createData.apiKeyHash).toBeTruthy();
    expect(createData.agentMeta).toEqual({ operatorName: 'Acme' });
  });

  it('rejects AI_AGENT without agentMeta', async () => {
    await expect(
      createActor({ type: 'AI_AGENT', handle: 'bot-2', displayName: 'Bot' }),
    ).rejects.toThrow('agentMeta');
  });

  it('rejects agentMeta on HUMAN actors', async () => {
    await expect(
      createActor(
        { type: 'HUMAN', handle: 'alice', displayName: 'Alice', agentMeta: { operatorName: 'X' } },
        'user-1',
      ),
    ).rejects.toThrow('only valid for AI_AGENT');
  });

  it('rejects duplicate handle', async () => {
    mockFns.reachActor.findUnique.mockResolvedValueOnce({ id: 'existing' }); // handle taken

    await expect(
      createActor({ type: 'HUMAN', handle: 'taken', displayName: 'Test' }, 'user-1'),
    ).rejects.toThrow('Handle already taken');
  });

  it('rejects duplicate userId link', async () => {
    mockFns.reachActor.findUnique
      .mockResolvedValueOnce(null)  // handle ok
      .mockResolvedValueOnce({ id: 'existing-actor' }); // userId taken

    await expect(
      createActor({ type: 'HUMAN', handle: 'new', displayName: 'Test' }, 'user-1'),
    ).rejects.toThrow('already has an actor');
  });

  it('creates ORGANIZATION with API key and auto-OWNER membership', async () => {
    mockFns.reachActor.findUnique.mockResolvedValueOnce(null); // handle

    const created = {
      id: 'org-1',
      type: 'ORGANIZATION',
      handle: 'acme-org',
      displayName: 'Acme Org',
      isActive: true,
      apiKeyHash: 'hash',
      apiKeyScopes: [],
      agentMeta: null,
      createdAt: new Date(),
    };

    // Transaction mock for ORGANIZATION path
    mockFns.$transaction.mockImplementation(async (cb: (tx: unknown) => unknown) => {
      const tx = {
        reachActor: {
          create: vi.fn().mockResolvedValue(created),
        },
        reachOrgMember: {
          create: vi.fn().mockResolvedValue({
            id: 'mem-1',
            orgId: 'org-1',
            memberId: 'creator-actor',
            role: 'OWNER',
          }),
        },
      };
      return cb(tx);
    });

    const result = await createActor({
      type: 'ORGANIZATION',
      handle: 'acme-org',
      displayName: 'Acme Org',
      _creatorActorId: 'creator-actor',
    });

    expect(result.actor.type).toBe('ORGANIZATION');
    expect(result.apiKey).toBeDefined();
    expect(result.apiKey).toMatch(/^knk_/);
    expect(mockFns.$transaction).toHaveBeenCalledOnce();
  });

  it('creates ORGANIZATION without auto-OWNER when no creator', async () => {
    mockFns.reachActor.findUnique.mockResolvedValueOnce(null); // handle

    const created = {
      id: 'org-2',
      type: 'ORGANIZATION',
      handle: 'solo-org',
      displayName: 'Solo Org',
      isActive: true,
      apiKeyHash: 'hash',
      apiKeyScopes: [],
      agentMeta: null,
      createdAt: new Date(),
    };

    let orgMemberCreated = false;
    mockFns.$transaction.mockImplementation(async (cb: (tx: unknown) => unknown) => {
      const tx = {
        reachActor: {
          create: vi.fn().mockResolvedValue(created),
        },
        reachOrgMember: {
          create: vi.fn().mockImplementation(async () => {
            orgMemberCreated = true;
            return {};
          }),
        },
      };
      return cb(tx);
    });

    await createActor({
      type: 'ORGANIZATION',
      handle: 'solo-org',
      displayName: 'Solo Org',
      // no _creatorActorId
    });

    expect(orgMemberCreated).toBe(false);
  });

  it('validates apiKeyScopes against known permissions', async () => {
    mockFns.reachActor.findUnique.mockResolvedValueOnce(null); // handle

    await expect(
      createActor({
        type: 'AI_AGENT',
        handle: 'bot-scoped',
        displayName: 'Bot',
        agentMeta: { operatorName: 'Test' },
        apiKeyScopes: ['CONTRACT_PROPOSE', 'FAKE_SCOPE'],
      }),
    ).rejects.toThrow('Invalid API key scopes');
  });

  it('accepts valid apiKeyScopes', async () => {
    mockFns.reachActor.findUnique.mockResolvedValueOnce(null);

    const created = {
      id: 'actor-scoped',
      type: 'AI_AGENT',
      handle: 'bot-scoped',
      displayName: 'Bot',
      isActive: true,
      apiKeyHash: 'hash',
      apiKeyScopes: ['CONTRACT_PROPOSE', 'CONTRACT_READ'],
      agentMeta: { operatorName: 'Test' },
      createdAt: new Date(),
    };
    mockFns.reachActor.create.mockResolvedValue(created);

    const result = await createActor({
      type: 'AI_AGENT',
      handle: 'bot-scoped',
      displayName: 'Bot',
      agentMeta: { operatorName: 'Test' },
      apiKeyScopes: ['CONTRACT_PROPOSE', 'CONTRACT_READ'],
    });

    expect(result.actor.apiKeyScopes).toEqual(['CONTRACT_PROPOSE', 'CONTRACT_READ']);
  });
});

// ---------------------------------------------------------------------------
// updateActor
// ---------------------------------------------------------------------------

describe('updateActor', () => {
  beforeEach(() => vi.clearAllMocks());

  it('updates displayName', async () => {
    mockFns.reachActor.findUnique.mockResolvedValue({
      id: 'actor-1',
      type: 'HUMAN',
      displayName: 'Old Name',
    });
    mockFns.reachActor.update.mockResolvedValue({
      id: 'actor-1',
      type: 'HUMAN',
      displayName: 'New Name',
      updatedAt: new Date(),
    });

    const result = await updateActor('actor-1', { displayName: 'New Name' });
    expect(result.displayName).toBe('New Name');
  });

  it('partially merges agentMeta on AI_AGENT actors', async () => {
    mockFns.reachActor.findUnique.mockResolvedValue({
      id: 'agent-1',
      type: 'AI_AGENT',
      agentMeta: { operatorName: 'Acme', modelId: 'gpt-4o' },
    });
    mockFns.reachActor.update.mockResolvedValue({
      id: 'agent-1',
      type: 'AI_AGENT',
      agentMeta: { operatorName: 'Acme', modelId: 'gpt-4o-mini', version: '2.0' },
      updatedAt: new Date(),
    });

    const result = await updateActor('agent-1', {
      agentMeta: { modelId: 'gpt-4o-mini', version: '2.0' },
    });

    // Verify the update call merges existing + new
    const updateData = mockFns.reachActor.update.mock.calls[0][0].data;
    expect(updateData.agentMeta).toEqual({
      operatorName: 'Acme',
      modelId: 'gpt-4o-mini',
      version: '2.0',
    });
    expect(result.agentMeta).toBeTruthy();
  });

  it('rejects agentMeta update on non-AI_AGENT actors', async () => {
    mockFns.reachActor.findUnique.mockResolvedValue({
      id: 'human-1',
      type: 'HUMAN',
    });

    await expect(
      updateActor('human-1', { agentMeta: { modelId: 'gpt-4o' } }),
    ).rejects.toThrow('only be updated on AI_AGENT');
  });

  it('returns actor unchanged when no update fields provided', async () => {
    const existing = { id: 'actor-1', type: 'HUMAN', displayName: 'Alice' };
    mockFns.reachActor.findUnique.mockResolvedValue(existing);

    const result = await updateActor('actor-1', {});
    expect(result).toBe(existing);
    expect(mockFns.reachActor.update).not.toHaveBeenCalled();
  });

  it('throws when actor not found', async () => {
    mockFns.reachActor.findUnique.mockResolvedValue(null);

    await expect(updateActor('missing', { displayName: 'X' }))
      .rejects.toThrow('Actor not found');
  });
});

// ---------------------------------------------------------------------------
// rotateApiKey
// ---------------------------------------------------------------------------

describe('rotateApiKey', () => {
  beforeEach(() => vi.clearAllMocks());

  it('rotates API key for AI_AGENT actor', async () => {
    mockFns.reachActor.findUnique.mockResolvedValue({
      id: 'agent-1',
      type: 'AI_AGENT',
      userId: null,
      apiKeyHash: 'old-hash',
    });
    mockFns.reachActor.update.mockResolvedValue({});

    const result = await rotateApiKey('agent-1');
    expect(result.apiKey).toMatch(/^knk_/);
    expect(result.apiKey.length).toBeGreaterThan(40);

    // Verify the hash was updated
    const updateData = mockFns.reachActor.update.mock.calls[0][0].data;
    expect(updateData.apiKeyHash).toBeTruthy();
    expect(updateData.apiKeyHash).not.toBe('old-hash');
  });

  it('rotates API key for ORGANIZATION actor', async () => {
    mockFns.reachActor.findUnique.mockResolvedValue({
      id: 'org-1',
      type: 'ORGANIZATION',
      userId: null,
      apiKeyHash: 'old-hash',
    });
    mockFns.reachActor.update.mockResolvedValue({});

    const result = await rotateApiKey('org-1');
    expect(result.apiKey).toMatch(/^knk_/);
  });

  it('rejects key rotation for HUMAN actors', async () => {
    mockFns.reachActor.findUnique.mockResolvedValue({
      id: 'human-1',
      type: 'HUMAN',
      userId: 'user-1',
    });

    await expect(rotateApiKey('human-1')).rejects.toThrow('session auth');
  });

  it('throws when actor not found', async () => {
    mockFns.reachActor.findUnique.mockResolvedValue(null);

    await expect(rotateApiKey('missing')).rejects.toThrow('Actor not found');
  });
});

// ---------------------------------------------------------------------------
// addOrgMember
// ---------------------------------------------------------------------------

describe('addOrgMember', () => {
  beforeEach(() => vi.clearAllMocks());

  it('adds a member to an organization', async () => {
    // Org lookup
    mockFns.reachActor.findUnique.mockResolvedValueOnce({
      id: 'org-1',
      type: 'ORGANIZATION',
      isActive: true,
    });
    // Member lookup
    mockFns.reachActor.findUnique.mockResolvedValueOnce({
      id: 'member-1',
      type: 'HUMAN',
      isActive: true,
    });
    // Existing membership check
    mockFns.reachOrgMember.findUnique.mockResolvedValue(null);
    // Create
    mockFns.reachOrgMember.create.mockResolvedValue({
      id: 'mem-1',
      orgId: 'org-1',
      memberId: 'member-1',
      role: 'MEMBER',
      isActive: true,
    });

    const result = await addOrgMember('org-1', 'member-1');
    expect(result.role).toBe('MEMBER');
    expect(result.isActive).toBe(true);
  });

  it('adds a member with ADMIN role', async () => {
    mockFns.reachActor.findUnique
      .mockResolvedValueOnce({ id: 'org-1', type: 'ORGANIZATION', isActive: true })
      .mockResolvedValueOnce({ id: 'member-1', type: 'AI_AGENT', isActive: true });
    mockFns.reachOrgMember.findUnique.mockResolvedValue(null);
    mockFns.reachOrgMember.create.mockResolvedValue({
      id: 'mem-2',
      orgId: 'org-1',
      memberId: 'member-1',
      role: 'ADMIN',
      isActive: true,
    });

    const result = await addOrgMember('org-1', 'member-1', 'ADMIN');
    expect(result.role).toBe('ADMIN');
  });

  it('reactivates an inactive membership', async () => {
    mockFns.reachActor.findUnique
      .mockResolvedValueOnce({ id: 'org-1', type: 'ORGANIZATION', isActive: true })
      .mockResolvedValueOnce({ id: 'member-1', type: 'HUMAN', isActive: true });
    mockFns.reachOrgMember.findUnique.mockResolvedValue({
      id: 'mem-old',
      isActive: false,
      role: 'MEMBER',
    });
    mockFns.reachOrgMember.update.mockResolvedValue({
      id: 'mem-old',
      isActive: true,
      role: 'ADMIN',
    });

    const result = await addOrgMember('org-1', 'member-1', 'ADMIN');
    expect(result.isActive).toBe(true);
    expect(result.role).toBe('ADMIN');
  });

  it('rejects adding to a non-organization', async () => {
    mockFns.reachActor.findUnique.mockResolvedValueOnce({
      id: 'human-1',
      type: 'HUMAN',
      isActive: true,
    });

    await expect(addOrgMember('human-1', 'member-1'))
      .rejects.toThrow('not an organization');
  });

  it('rejects adding an organization as a member', async () => {
    mockFns.reachActor.findUnique
      .mockResolvedValueOnce({ id: 'org-1', type: 'ORGANIZATION', isActive: true })
      .mockResolvedValueOnce({ id: 'org-2', type: 'ORGANIZATION', isActive: true });

    await expect(addOrgMember('org-1', 'org-2'))
      .rejects.toThrow('Cannot add an organization as a member');
  });

  it('rejects duplicate active membership', async () => {
    mockFns.reachActor.findUnique
      .mockResolvedValueOnce({ id: 'org-1', type: 'ORGANIZATION', isActive: true })
      .mockResolvedValueOnce({ id: 'member-1', type: 'HUMAN', isActive: true });
    mockFns.reachOrgMember.findUnique.mockResolvedValue({
      id: 'mem-1',
      isActive: true,
    });

    await expect(addOrgMember('org-1', 'member-1'))
      .rejects.toThrow('Already a member');
  });

  it('rejects when org is inactive', async () => {
    mockFns.reachActor.findUnique.mockResolvedValueOnce({
      id: 'org-1',
      type: 'ORGANIZATION',
      isActive: false,
    });

    await expect(addOrgMember('org-1', 'member-1'))
      .rejects.toThrow('inactive');
  });

  it('rejects when member actor is inactive', async () => {
    mockFns.reachActor.findUnique
      .mockResolvedValueOnce({ id: 'org-1', type: 'ORGANIZATION', isActive: true })
      .mockResolvedValueOnce({ id: 'member-1', type: 'HUMAN', isActive: false });

    await expect(addOrgMember('org-1', 'member-1'))
      .rejects.toThrow('inactive');
  });
});

// ---------------------------------------------------------------------------
// removeOrgMember
// ---------------------------------------------------------------------------

describe('removeOrgMember', () => {
  beforeEach(() => vi.clearAllMocks());

  it('deactivates a membership', async () => {
    mockFns.reachOrgMember.findUnique.mockResolvedValue({
      id: 'mem-1',
      role: 'MEMBER',
      isActive: true,
    });
    mockFns.reachOrgMember.update.mockResolvedValue({
      id: 'mem-1',
      isActive: false,
    });

    const result = await removeOrgMember('org-1', 'member-1');
    expect(result.isActive).toBe(false);
  });

  it('allows removing an OWNER when there are other owners', async () => {
    mockFns.reachOrgMember.findUnique.mockResolvedValue({
      id: 'mem-owner',
      role: 'OWNER',
      isActive: true,
    });
    mockFns.reachOrgMember.count.mockResolvedValue(2); // 2 owners exist
    mockFns.reachOrgMember.update.mockResolvedValue({
      id: 'mem-owner',
      isActive: false,
    });

    const result = await removeOrgMember('org-1', 'owner-2');
    expect(result.isActive).toBe(false);
  });

  it('rejects removing the last OWNER', async () => {
    mockFns.reachOrgMember.findUnique.mockResolvedValue({
      id: 'mem-owner',
      role: 'OWNER',
      isActive: true,
    });
    mockFns.reachOrgMember.count.mockResolvedValue(1); // only 1 owner

    await expect(removeOrgMember('org-1', 'last-owner'))
      .rejects.toThrow('last owner');
  });

  it('rejects when membership not found', async () => {
    mockFns.reachOrgMember.findUnique.mockResolvedValue(null);

    await expect(removeOrgMember('org-1', 'stranger'))
      .rejects.toThrow('not found');
  });
});

// ---------------------------------------------------------------------------
// updateOrgMemberRole
// ---------------------------------------------------------------------------

describe('updateOrgMemberRole', () => {
  beforeEach(() => vi.clearAllMocks());

  it('promotes MEMBER to ADMIN', async () => {
    mockFns.reachOrgMember.findUnique.mockResolvedValue({
      id: 'mem-1',
      role: 'MEMBER',
      isActive: true,
    });
    mockFns.reachOrgMember.update.mockResolvedValue({
      id: 'mem-1',
      role: 'ADMIN',
    });

    const result = await updateOrgMemberRole('org-1', 'member-1', 'ADMIN');
    expect(result.role).toBe('ADMIN');
  });

  it('promotes ADMIN to OWNER', async () => {
    mockFns.reachOrgMember.findUnique.mockResolvedValue({
      id: 'mem-1',
      role: 'ADMIN',
      isActive: true,
    });
    mockFns.reachOrgMember.update.mockResolvedValue({
      id: 'mem-1',
      role: 'OWNER',
    });

    const result = await updateOrgMemberRole('org-1', 'member-1', 'OWNER');
    expect(result.role).toBe('OWNER');
  });

  it('allows demoting OWNER when there are other owners', async () => {
    mockFns.reachOrgMember.findUnique.mockResolvedValue({
      id: 'mem-owner',
      role: 'OWNER',
      isActive: true,
    });
    mockFns.reachOrgMember.count.mockResolvedValue(2);
    mockFns.reachOrgMember.update.mockResolvedValue({
      id: 'mem-owner',
      role: 'ADMIN',
    });

    const result = await updateOrgMemberRole('org-1', 'owner-1', 'ADMIN');
    expect(result.role).toBe('ADMIN');
  });

  it('rejects demoting the last OWNER', async () => {
    mockFns.reachOrgMember.findUnique.mockResolvedValue({
      id: 'mem-owner',
      role: 'OWNER',
      isActive: true,
    });
    mockFns.reachOrgMember.count.mockResolvedValue(1);

    await expect(updateOrgMemberRole('org-1', 'last-owner', 'MEMBER'))
      .rejects.toThrow('last owner');
  });

  it('rejects when membership not found', async () => {
    mockFns.reachOrgMember.findUnique.mockResolvedValue(null);

    await expect(updateOrgMemberRole('org-1', 'stranger', 'ADMIN'))
      .rejects.toThrow('not found');
  });
});

// ---------------------------------------------------------------------------
// listOrgMembers
// ---------------------------------------------------------------------------

describe('listOrgMembers', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns active members by default', async () => {
    const members = [
      {
        id: 'mem-1',
        role: 'OWNER',
        isActive: true,
        member: { id: 'a-1', handle: 'alice', displayName: 'Alice', type: 'HUMAN', isActive: true },
        createdAt: new Date(),
      },
      {
        id: 'mem-2',
        role: 'MEMBER',
        isActive: true,
        member: { id: 'a-2', handle: 'bot-1', displayName: 'Bot', type: 'AI_AGENT', isActive: true },
        createdAt: new Date(),
      },
    ];
    mockFns.reachOrgMember.findMany.mockResolvedValue(members);

    const result = await listOrgMembers('org-1');
    expect(result).toHaveLength(2);
    expect(result[0].role).toBe('OWNER');

    // Verify the query filters by isActive
    const where = mockFns.reachOrgMember.findMany.mock.calls[0][0].where;
    expect(where.orgId).toBe('org-1');
    expect(where.isActive).toBe(true);
  });

  it('includes inactive members when requested', async () => {
    mockFns.reachOrgMember.findMany.mockResolvedValue([]);

    await listOrgMembers('org-1', true);

    const where = mockFns.reachOrgMember.findMany.mock.calls[0][0].where;
    expect(where.isActive).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// listActors
// ---------------------------------------------------------------------------

describe('listActors', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns actors with pagination', async () => {
    const actors = [
      { id: 'a-1', type: 'HUMAN', handle: 'alice', displayName: 'Alice', isActive: true },
    ];
    mockFns.reachActor.findMany.mockResolvedValue(actors);
    mockFns.reachActor.count.mockResolvedValue(1);

    const result = await listActors({ limit: 10, offset: 0 });
    expect(result.actors).toHaveLength(1);
    expect(result.totalCount).toBe(1);
  });

  it('filters by type', async () => {
    mockFns.reachActor.findMany.mockResolvedValue([]);
    mockFns.reachActor.count.mockResolvedValue(0);

    await listActors({ type: 'AI_AGENT' });

    const where = mockFns.reachActor.findMany.mock.calls[0][0].where;
    expect(where.type).toBe('AI_AGENT');
  });

  it('filters by search keyword', async () => {
    mockFns.reachActor.findMany.mockResolvedValue([]);
    mockFns.reachActor.count.mockResolvedValue(0);

    await listActors({ search: 'bot' });

    const where = mockFns.reachActor.findMany.mock.calls[0][0].where;
    expect(where.OR).toBeDefined();
    expect(where.OR).toHaveLength(2);
  });

  it('excludes inactive by default', async () => {
    mockFns.reachActor.findMany.mockResolvedValue([]);
    mockFns.reachActor.count.mockResolvedValue(0);

    await listActors({});

    const where = mockFns.reachActor.findMany.mock.calls[0][0].where;
    expect(where.isActive).toBe(true);
  });

  it('includes inactive when requested', async () => {
    mockFns.reachActor.findMany.mockResolvedValue([]);
    mockFns.reachActor.count.mockResolvedValue(0);

    await listActors({ includeInactive: true });

    const where = mockFns.reachActor.findMany.mock.calls[0][0].where;
    expect(where.isActive).toBeUndefined();
  });

  it('clamps limit to [1, 100]', async () => {
    mockFns.reachActor.findMany.mockResolvedValue([]);
    mockFns.reachActor.count.mockResolvedValue(0);

    await listActors({ limit: 200 });
    expect(mockFns.reachActor.findMany.mock.calls[0][0].take).toBe(100);

    await listActors({ limit: 0 });
    expect(mockFns.reachActor.findMany.mock.calls[1][0].take).toBe(1);
  });
});
