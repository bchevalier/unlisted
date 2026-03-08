/**
 * Reach contract data-fetching helpers for server components.
 *
 * Wraps the service layer with pagination and summary types
 * suitable for rendering in the Reach inbox UI.
 */

import { db } from '../../../lib/db';
import type { ReachContractStatus } from '../../../lib/reach/contracts';
import { REACH_CONTRACT_STATUSES } from '../../../lib/reach/contracts';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ContractListItem {
  id: string;
  type: string;
  status: string;
  purpose: string;
  message: string | null;
  createdAt: Date;
  expiresAt: Date | null;
  routedAt: Date | null;
  resolvedAt: Date | null;
  initiator: { id: string; handle: string; displayName: string; type: string };
  target: { id: string; handle: string; displayName: string; type: string };
}

export interface ContractDetail {
  id: string;
  type: string;
  status: string;
  purpose: string;
  message: string | null;
  structuredData: unknown;
  createdAt: Date;
  expiresAt: Date | null;
  routedAt: Date | null;
  resolvedAt: Date | null;
  policyId: string | null;
  initiator: { id: string; handle: string; displayName: string; type: string };
  target: { id: string; handle: string; displayName: string; type: string };
  events: ContractEvent[];
}

export interface ContractEvent {
  id: string;
  type: string;
  actor: string;
  note: string | null;
  createdAt: Date;
}

export interface ContractSummary {
  total: number;
  statusCounts: Record<string, number>;
  escalatedCount: number;
}

export interface PaginatedContracts {
  contracts: ContractListItem[];
  pagination: {
    page: number;
    pageSize: number;
    totalCount: number;
    totalPages: number;
  };
  statusCounts: Record<string, number>;
}

const PAGE_SIZE = 20;

// ---------------------------------------------------------------------------
// Queries
// ---------------------------------------------------------------------------

/**
 * List contracts for an actor with pagination and filtering.
 */
export async function listContractsForActor(
  actorId: string,
  opts: {
    role?: 'initiator' | 'target' | 'both';
    status?: ReachContractStatus;
    page?: number;
  } = {},
): Promise<PaginatedContracts> {
  const { role = 'both', status, page = 1 } = opts;
  const offset = (page - 1) * PAGE_SIZE;

  // Build role filter.
  const roleFilter =
    role === 'initiator'
      ? { initiatorId: actorId }
      : role === 'target'
        ? { targetId: actorId }
        : { OR: [{ initiatorId: actorId }, { targetId: actorId }] };

  // Get counts per status for tabs.
  const countsRaw = await db.reachContract.groupBy({
    by: ['status'],
    where: roleFilter,
    _count: { status: true },
  });

  const statusCounts: Record<string, number> = {};
  for (const row of countsRaw) {
    statusCounts[row.status] = row._count.status;
  }

  // Get paginated list.
  const where = {
    ...roleFilter,
    ...(status ? { status } : {}),
  };

  const [contracts, totalCount] = await Promise.all([
    db.reachContract.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: PAGE_SIZE,
      skip: offset,
      include: {
        initiator: { select: { id: true, handle: true, displayName: true, type: true } },
        target: { select: { id: true, handle: true, displayName: true, type: true } },
      },
    }),
    db.reachContract.count({ where }),
  ]);

  return {
    contracts,
    pagination: {
      page,
      pageSize: PAGE_SIZE,
      totalCount,
      totalPages: Math.max(1, Math.ceil(totalCount / PAGE_SIZE)),
    },
    statusCounts,
  };
}

/**
 * Get a single contract with full details and events.
 * Only returns the contract if the actor is initiator or target.
 */
export async function getContractForActor(
  actorId: string,
  contractId: string,
): Promise<ContractDetail | null> {
  const contract = await db.reachContract.findUnique({
    where: { id: contractId },
    include: {
      initiator: { select: { id: true, handle: true, displayName: true, type: true } },
      target: { select: { id: true, handle: true, displayName: true, type: true } },
      events: { orderBy: { createdAt: 'asc' } },
    },
  });

  if (!contract) return null;

  // Authorization: only initiator or target can view.
  if (contract.initiatorId !== actorId && contract.targetId !== actorId) {
    return null;
  }

  return contract;
}

/**
 * Get a summary of contracts for the dashboard.
 */
export async function getContractSummary(actorId: string): Promise<ContractSummary> {
  const roleFilter = { OR: [{ initiatorId: actorId }, { targetId: actorId }] };

  const [countsRaw, escalatedCount] = await Promise.all([
    db.reachContract.groupBy({
      by: ['status'],
      where: roleFilter,
      _count: { status: true },
    }),
    db.reachContract.count({
      where: {
        targetId: actorId,
        status: 'PROPOSED',
        events: { some: { type: 'ESCALATED' } },
      },
    }),
  ]);

  const statusCounts: Record<string, number> = {};
  let total = 0;
  for (const row of countsRaw) {
    statusCounts[row.status] = row._count.status;
    total += row._count.status;
  }

  return { total, statusCounts, escalatedCount };
}

/**
 * List escalated contracts pending human review.
 */
export async function listEscalatedContractsForActor(
  actorId: string,
  page = 1,
): Promise<PaginatedContracts> {
  const offset = (page - 1) * PAGE_SIZE;

  const where = {
    targetId: actorId,
    status: 'PROPOSED' as const,
    events: { some: { type: 'ESCALATED' as const } },
  };

  const [contracts, totalCount] = await Promise.all([
    db.reachContract.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: PAGE_SIZE,
      skip: offset,
      include: {
        initiator: { select: { id: true, handle: true, displayName: true, type: true } },
        target: { select: { id: true, handle: true, displayName: true, type: true } },
      },
    }),
    db.reachContract.count({ where }),
  ]);

  return {
    contracts,
    pagination: {
      page,
      pageSize: PAGE_SIZE,
      totalCount,
      totalPages: Math.max(1, Math.ceil(totalCount / PAGE_SIZE)),
    },
    statusCounts: { PROPOSED: totalCount },
  };
}

/**
 * Check if a status string is a valid ReachContractStatus.
 */
export function isValidContractStatus(value: string): value is ReachContractStatus {
  return (REACH_CONTRACT_STATUSES as readonly string[]).includes(value);
}
