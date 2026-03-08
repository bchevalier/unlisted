/**
 * Reach pilot metrics — computation engine.
 *
 * Three core metrics for evaluating Reach pilot effectiveness:
 *
 *   1. **Path length** — number of lifecycle events per contract before terminal status.
 *      Lower = more efficient routing.
 *
 *   2. **Time-to-qualified-counterparty** — duration from contract creation to
 *      acceptance (ACTIVE status). Measures how fast the system connects parties.
 *
 *   3. **One-hop success rate** — percentage of resolved contracts that reached
 *      ACTIVE/FULFILLED without escalation or human override. Higher = better
 *      policy quality.
 *
 * Pure computation functions are separated from DB queries for testability.
 */

import { db } from '../db';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Raw contract data needed for metrics computation. */
export interface ContractMetricRow {
  id: string;
  type: string;
  status: string;
  createdAt: Date;
  routedAt: Date | null;
  resolvedAt: Date | null;
  events: { type: string; createdAt: Date }[];
}

/** Distribution stats for a numeric metric. */
export interface DistributionStats {
  count: number;
  min: number;
  max: number;
  mean: number;
  median: number;
  p90: number;
}

/** Computed pilot metrics for a set of contracts. */
export interface ReachPilotMetrics {
  /** Total contracts evaluated. */
  totalContracts: number;

  /** Contracts that reached a terminal status (FULFILLED, REJECTED, CANCELLED, EXPIRED). */
  resolvedContracts: number;

  /** Contracts currently in-flight (PROPOSED, ACTIVE). */
  inFlightContracts: number;

  /** Status distribution counts. */
  statusBreakdown: Record<string, number>;

  /** Contract type distribution counts. */
  typeBreakdown: Record<string, number>;

  /**
   * Path length: event count per resolved contract.
   * null when no resolved contracts exist.
   */
  pathLength: DistributionStats | null;

  /**
   * Time-to-qualified-counterparty in seconds (creation → ACTIVE).
   * null when no contracts have been accepted.
   */
  timeToCounterparty: DistributionStats | null;

  /**
   * One-hop success rate: fraction of resolved contracts that reached
   * ACTIVE or FULFILLED without ESCALATED or OVERRIDDEN events.
   */
  oneHopSuccess: {
    /** Contracts that succeeded in one hop. */
    oneHopCount: number;
    /** All resolved contracts (denominator). */
    resolvedCount: number;
    /** Rate as 0–1 (null if no resolved contracts). */
    rate: number | null;
  };

  /** Time range of the evaluated data. */
  window: {
    from: Date | null;
    to: Date | null;
  };
}

// ---------------------------------------------------------------------------
// Pure computation (no DB)
// ---------------------------------------------------------------------------

const TERMINAL_STATUSES = new Set(['FULFILLED', 'REJECTED', 'CANCELLED', 'EXPIRED']);
const ESCALATION_EVENTS = new Set(['ESCALATED', 'OVERRIDDEN']);

/**
 * Compute pilot metrics from raw contract rows.
 * This is a pure function — no side effects, fully testable.
 */
export function computeMetrics(rows: ContractMetricRow[]): ReachPilotMetrics {
  if (rows.length === 0) {
    return emptyMetrics();
  }

  // Status & type breakdowns.
  const statusBreakdown: Record<string, number> = {};
  const typeBreakdown: Record<string, number> = {};

  const resolved: ContractMetricRow[] = [];
  const accepted: ContractMetricRow[] = [];
  let inFlight = 0;

  for (const row of rows) {
    statusBreakdown[row.status] = (statusBreakdown[row.status] ?? 0) + 1;
    typeBreakdown[row.type] = (typeBreakdown[row.type] ?? 0) + 1;

    if (TERMINAL_STATUSES.has(row.status)) {
      resolved.push(row);
    } else {
      inFlight++;
    }

    // Accepted = has an ACCEPTED event (went through ACTIVE at some point).
    if (row.events.some((e) => e.type === 'ACCEPTED')) {
      accepted.push(row);
    }
  }

  // 1. Path length — event count per resolved contract.
  const pathLengths = resolved.map((r) => r.events.length);
  const pathLength = pathLengths.length > 0 ? computeDistribution(pathLengths) : null;

  // 2. Time-to-counterparty — seconds from creation to first ACCEPTED event.
  const ttcValues: number[] = [];
  for (const row of accepted) {
    const acceptedEvent = row.events.find((e) => e.type === 'ACCEPTED');
    if (acceptedEvent) {
      const seconds = (acceptedEvent.createdAt.getTime() - row.createdAt.getTime()) / 1000;
      if (seconds >= 0) ttcValues.push(seconds);
    }
  }
  const timeToCounterparty = ttcValues.length > 0 ? computeDistribution(ttcValues) : null;

  // 3. One-hop success — resolved contracts without escalation/override events.
  const oneHopCount = resolved.filter(
    (r) =>
      (r.status === 'FULFILLED' || r.events.some((e) => e.type === 'ACCEPTED')) &&
      !r.events.some((e) => ESCALATION_EVENTS.has(e.type)),
  ).length;

  // Window.
  const dates = rows.map((r) => r.createdAt.getTime());
  const from = new Date(Math.min(...dates));
  const to = new Date(Math.max(...dates));

  return {
    totalContracts: rows.length,
    resolvedContracts: resolved.length,
    inFlightContracts: inFlight,
    statusBreakdown,
    typeBreakdown,
    pathLength,
    timeToCounterparty,
    oneHopSuccess: {
      oneHopCount,
      resolvedCount: resolved.length,
      rate: resolved.length > 0 ? oneHopCount / resolved.length : null,
    },
    window: { from, to },
  };
}

/**
 * Compute distribution stats for a list of numeric values.
 */
export function computeDistribution(values: number[]): DistributionStats {
  if (values.length === 0) {
    return { count: 0, min: 0, max: 0, mean: 0, median: 0, p90: 0 };
  }

  const sorted = [...values].sort((a, b) => a - b);
  const sum = sorted.reduce((s, v) => s + v, 0);

  return {
    count: sorted.length,
    min: sorted[0],
    max: sorted[sorted.length - 1],
    mean: Math.round((sum / sorted.length) * 100) / 100,
    median: percentile(sorted, 50),
    p90: percentile(sorted, 90),
  };
}

function percentile(sorted: number[], p: number): number {
  if (sorted.length === 0) return 0;
  if (sorted.length === 1) return sorted[0];
  const idx = (p / 100) * (sorted.length - 1);
  const lo = Math.floor(idx);
  const hi = Math.ceil(idx);
  if (lo === hi) return sorted[lo];
  return Math.round((sorted[lo] + (sorted[hi] - sorted[lo]) * (idx - lo)) * 100) / 100;
}

function emptyMetrics(): ReachPilotMetrics {
  return {
    totalContracts: 0,
    resolvedContracts: 0,
    inFlightContracts: 0,
    statusBreakdown: {},
    typeBreakdown: {},
    pathLength: null,
    timeToCounterparty: null,
    oneHopSuccess: { oneHopCount: 0, resolvedCount: 0, rate: null },
    window: { from: null, to: null },
  };
}

// ---------------------------------------------------------------------------
// DB queries — fetch rows for metrics computation
// ---------------------------------------------------------------------------

export interface MetricsQueryOptions {
  /** Filter to a specific actor (as target). */
  actorId?: string;
  /** Start of time window (inclusive). */
  from?: Date;
  /** End of time window (inclusive). */
  to?: Date;
  /** Limit rows fetched (default 10000). */
  limit?: number;
}

/**
 * Fetch contract data from the database and compute pilot metrics.
 */
export async function getReachPilotMetrics(
  opts: MetricsQueryOptions = {},
): Promise<ReachPilotMetrics> {
  const { actorId, from, to, limit = 10_000 } = opts;

  const where: Record<string, unknown> = {};

  if (actorId) {
    where.OR = [{ initiatorId: actorId }, { targetId: actorId }];
  }

  if (from || to) {
    const createdAt: Record<string, Date> = {};
    if (from) createdAt.gte = from;
    if (to) createdAt.lte = to;
    where.createdAt = createdAt;
  }

  const contracts = await db.reachContract.findMany({
    where,
    take: limit,
    orderBy: { createdAt: 'desc' },
    select: {
      id: true,
      type: true,
      status: true,
      createdAt: true,
      routedAt: true,
      resolvedAt: true,
      events: {
        select: { type: true, createdAt: true },
        orderBy: { createdAt: 'asc' },
      },
    },
  });

  return computeMetrics(contracts);
}
