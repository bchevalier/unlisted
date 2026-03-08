/**
 * Reach pilot metrics — computation engine.
 *
 * Core metrics for evaluating Reach pilot effectiveness:
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
 *   4. **Conversion funnel** — lifecycle progression rates: PROPOSED → ACTIVE → FULFILLED.
 *      Shows where contracts drop off.
 *
 *   5. **Per-type breakdowns** — all core metrics segmented by contract type.
 *      Reveals which interaction shapes perform best.
 *
 *   6. **Trend comparison** — current vs previous period delta for key metrics.
 *
 *   7. **SLA tracking** — percentage of contracts meeting time-to-counterparty thresholds.
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

/** Conversion funnel stage counts and rates. */
export interface ConversionFunnel {
  /** Total contracts entering the funnel. */
  proposed: number;
  /** Contracts that reached ACTIVE (accepted). */
  active: number;
  /** Contracts that reached FULFILLED. */
  fulfilled: number;
  /** PROPOSED → ACTIVE conversion rate (0–1, null if no proposals). */
  proposedToActiveRate: number | null;
  /** ACTIVE → FULFILLED conversion rate (0–1, null if no active). */
  activeToFulfilledRate: number | null;
  /** End-to-end: PROPOSED → FULFILLED (0–1, null if no proposals). */
  overallRate: number | null;
}

/** SLA threshold tracking for time-to-counterparty. */
export interface SlaMetrics {
  /** Threshold in seconds. */
  thresholdSeconds: number;
  /** Contracts that met the SLA. */
  withinSla: number;
  /** Total contracts measured. */
  total: number;
  /** Compliance rate (0–1, null if no data). */
  rate: number | null;
}

/** Core metrics for a single contract type segment. */
export interface TypeSegmentMetrics {
  type: string;
  total: number;
  resolved: number;
  inFlight: number;
  pathLength: DistributionStats | null;
  timeToCounterparty: DistributionStats | null;
  oneHopRate: number | null;
  funnel: ConversionFunnel;
}

/** Delta between two metric values for trend comparison. */
export interface TrendDelta {
  current: number | null;
  previous: number | null;
  /** Absolute change. */
  delta: number | null;
  /** Relative change as fraction (null if previous is 0 or null). */
  changeRate: number | null;
  /** 'up' | 'down' | 'flat' | 'no_data' */
  direction: 'up' | 'down' | 'flat' | 'no_data';
}

/** Summary trend comparison across key metrics. */
export interface TrendComparison {
  totalContracts: TrendDelta;
  resolvedContracts: TrendDelta;
  oneHopSuccessRate: TrendDelta;
  medianTimeToCounterparty: TrendDelta;
  medianPathLength: TrendDelta;
  overallConversionRate: TrendDelta;
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

  /** Lifecycle conversion funnel. */
  funnel: ConversionFunnel;

  /** SLA compliance for time-to-counterparty. */
  sla: SlaMetrics;

  /** Core metrics broken down by contract type. */
  byType: TypeSegmentMetrics[];

  /** Time range of the evaluated data. */
  window: {
    from: Date | null;
    to: Date | null;
  };
}

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

/** Default SLA threshold: 5 minutes (300 seconds) for time-to-counterparty. */
export const DEFAULT_SLA_THRESHOLD_SECONDS = 300;

// ---------------------------------------------------------------------------
// Pure computation (no DB)
// ---------------------------------------------------------------------------

const TERMINAL_STATUSES = new Set(['FULFILLED', 'REJECTED', 'CANCELLED', 'EXPIRED']);
const ESCALATION_EVENTS = new Set(['ESCALATED', 'OVERRIDDEN']);

/**
 * Compute pilot metrics from raw contract rows.
 * This is a pure function — no side effects, fully testable.
 */
export function computeMetrics(
  rows: ContractMetricRow[],
  opts: { slaThresholdSeconds?: number } = {},
): ReachPilotMetrics {
  if (rows.length === 0) {
    return emptyMetrics();
  }

  const slaThreshold = opts.slaThresholdSeconds ?? DEFAULT_SLA_THRESHOLD_SECONDS;

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
  const ttcValues = computeTtcValues(accepted);
  const timeToCounterparty = ttcValues.length > 0 ? computeDistribution(ttcValues) : null;

  // 3. One-hop success — resolved contracts without escalation/override events.
  const oneHopCount = countOneHopSuccess(resolved);

  // 4. Conversion funnel.
  const funnel = computeFunnel(rows);

  // 5. SLA tracking.
  const sla = computeSla(ttcValues, slaThreshold);

  // 6. Per-type breakdowns.
  const byType = computeByType(rows);

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
    funnel,
    sla,
    byType,
    window: { from, to },
  };
}

// ---------------------------------------------------------------------------
// Conversion funnel
// ---------------------------------------------------------------------------

/**
 * Compute lifecycle conversion funnel from contract rows.
 * Counts contracts that progressed through each major stage.
 */
export function computeFunnel(rows: ContractMetricRow[]): ConversionFunnel {
  const proposed = rows.length; // all contracts start as PROPOSED
  let active = 0;
  let fulfilled = 0;

  for (const row of rows) {
    // A contract "reached active" if it has an ACCEPTED event or is currently ACTIVE.
    const reachedActive =
      row.status === 'ACTIVE' ||
      row.status === 'FULFILLED' ||
      row.events.some((e) => e.type === 'ACCEPTED');
    if (reachedActive) active++;

    if (row.status === 'FULFILLED') fulfilled++;
  }

  return {
    proposed,
    active,
    fulfilled,
    proposedToActiveRate: proposed > 0 ? active / proposed : null,
    activeToFulfilledRate: active > 0 ? fulfilled / active : null,
    overallRate: proposed > 0 ? fulfilled / proposed : null,
  };
}

// ---------------------------------------------------------------------------
// SLA tracking
// ---------------------------------------------------------------------------

/**
 * Compute SLA compliance for time-to-counterparty values.
 */
export function computeSla(ttcValues: number[], thresholdSeconds: number): SlaMetrics {
  if (ttcValues.length === 0) {
    return { thresholdSeconds, withinSla: 0, total: 0, rate: null };
  }
  const withinSla = ttcValues.filter((v) => v <= thresholdSeconds).length;
  return {
    thresholdSeconds,
    withinSla,
    total: ttcValues.length,
    rate: withinSla / ttcValues.length,
  };
}

// ---------------------------------------------------------------------------
// Per-type breakdowns
// ---------------------------------------------------------------------------

/**
 * Compute core metrics segmented by contract type.
 */
export function computeByType(rows: ContractMetricRow[]): TypeSegmentMetrics[] {
  // Group by type.
  const groups = new Map<string, ContractMetricRow[]>();
  for (const row of rows) {
    const group = groups.get(row.type) ?? [];
    group.push(row);
    groups.set(row.type, group);
  }

  const segments: TypeSegmentMetrics[] = [];

  for (const [type, typeRows] of groups) {
    const resolved = typeRows.filter((r) => TERMINAL_STATUSES.has(r.status));
    const inFlight = typeRows.length - resolved.length;
    const accepted = typeRows.filter((r) => r.events.some((e) => e.type === 'ACCEPTED'));

    const pathLengths = resolved.map((r) => r.events.length);
    const ttcValues = computeTtcValues(accepted);
    const oneHopCount = countOneHopSuccess(resolved);

    segments.push({
      type,
      total: typeRows.length,
      resolved: resolved.length,
      inFlight,
      pathLength: pathLengths.length > 0 ? computeDistribution(pathLengths) : null,
      timeToCounterparty: ttcValues.length > 0 ? computeDistribution(ttcValues) : null,
      oneHopRate: resolved.length > 0 ? oneHopCount / resolved.length : null,
      funnel: computeFunnel(typeRows),
    });
  }

  // Sort by total contracts descending.
  segments.sort((a, b) => b.total - a.total);
  return segments;
}

// ---------------------------------------------------------------------------
// Trend comparison
// ---------------------------------------------------------------------------

/**
 * Compare two metric snapshots to produce trend deltas.
 * Typically: current period vs previous period of equal length.
 */
export function computeTrend(
  current: ReachPilotMetrics,
  previous: ReachPilotMetrics,
): TrendComparison {
  return {
    totalContracts: makeDelta(current.totalContracts, previous.totalContracts),
    resolvedContracts: makeDelta(current.resolvedContracts, previous.resolvedContracts),
    oneHopSuccessRate: makeDelta(current.oneHopSuccess.rate, previous.oneHopSuccess.rate),
    medianTimeToCounterparty: makeDelta(
      current.timeToCounterparty?.median ?? null,
      previous.timeToCounterparty?.median ?? null,
    ),
    medianPathLength: makeDelta(
      current.pathLength?.median ?? null,
      previous.pathLength?.median ?? null,
    ),
    overallConversionRate: makeDelta(current.funnel.overallRate, previous.funnel.overallRate),
  };
}

/**
 * Compute a trend delta between two numeric values.
 */
export function makeDelta(current: number | null, previous: number | null): TrendDelta {
  if (current === null && previous === null) {
    return { current: null, previous: null, delta: null, changeRate: null, direction: 'no_data' };
  }
  if (current === null || previous === null) {
    return {
      current,
      previous,
      delta: current !== null && previous !== null ? current - previous : null,
      changeRate: null,
      direction: 'no_data',
    };
  }

  const delta = Math.round((current - previous) * 10000) / 10000;
  const changeRate = previous !== 0 ? Math.round((delta / Math.abs(previous)) * 10000) / 10000 : null;
  const direction: TrendDelta['direction'] =
    Math.abs(delta) < 0.0001 ? 'flat' : delta > 0 ? 'up' : 'down';

  return { current, previous, delta, changeRate, direction };
}

// ---------------------------------------------------------------------------
// Shared helpers
// ---------------------------------------------------------------------------

/**
 * Extract time-to-counterparty values (in seconds) from accepted contracts.
 */
function computeTtcValues(accepted: ContractMetricRow[]): number[] {
  const values: number[] = [];
  for (const row of accepted) {
    const acceptedEvent = row.events.find((e) => e.type === 'ACCEPTED');
    if (acceptedEvent) {
      const seconds = (acceptedEvent.createdAt.getTime() - row.createdAt.getTime()) / 1000;
      if (seconds >= 0) values.push(seconds);
    }
  }
  return values;
}

/**
 * Count one-hop successes among resolved contracts.
 */
function countOneHopSuccess(resolved: ContractMetricRow[]): number {
  return resolved.filter(
    (r) =>
      (r.status === 'FULFILLED' || r.events.some((e) => e.type === 'ACCEPTED')) &&
      !r.events.some((e) => ESCALATION_EVENTS.has(e.type)),
  ).length;
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
    funnel: { proposed: 0, active: 0, fulfilled: 0, proposedToActiveRate: null, activeToFulfilledRate: null, overallRate: null },
    sla: { thresholdSeconds: DEFAULT_SLA_THRESHOLD_SECONDS, withinSla: 0, total: 0, rate: null },
    byType: [],
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
  /** SLA threshold in seconds (default 300). */
  slaThresholdSeconds?: number;
}

export interface MetricsWithTrend {
  metrics: ReachPilotMetrics;
  trend: TrendComparison | null;
}

/**
 * Build a Prisma where clause for contract queries.
 */
function buildWhere(opts: {
  actorId?: string;
  from?: Date;
  to?: Date;
}): Record<string, unknown> {
  const where: Record<string, unknown> = {};

  if (opts.actorId) {
    where.OR = [{ initiatorId: opts.actorId }, { targetId: opts.actorId }];
  }

  if (opts.from || opts.to) {
    const createdAt: Record<string, Date> = {};
    if (opts.from) createdAt.gte = opts.from;
    if (opts.to) createdAt.lte = opts.to;
    where.createdAt = createdAt;
  }

  return where;
}

const CONTRACT_SELECT = {
  id: true,
  type: true,
  status: true,
  createdAt: true,
  routedAt: true,
  resolvedAt: true,
  events: {
    select: { type: true, createdAt: true },
    orderBy: { createdAt: 'asc' as const },
  },
} as const;

/**
 * Fetch contract rows from the database.
 */
async function fetchContractRows(
  where: Record<string, unknown>,
  limit: number,
): Promise<ContractMetricRow[]> {
  return db.reachContract.findMany({
    where,
    take: limit,
    orderBy: { createdAt: 'desc' },
    select: CONTRACT_SELECT,
  });
}

/**
 * Fetch contract data from the database and compute pilot metrics.
 */
export async function getReachPilotMetrics(
  opts: MetricsQueryOptions = {},
): Promise<ReachPilotMetrics> {
  const { actorId, from, to, limit = 10_000, slaThresholdSeconds } = opts;
  const where = buildWhere({ actorId, from, to });
  const contracts = await fetchContractRows(where, limit);
  return computeMetrics(contracts, { slaThresholdSeconds });
}

/**
 * Fetch metrics with trend comparison against the previous period.
 *
 * If `from` and `to` are provided, automatically computes the previous
 * period of equal duration and returns trend deltas.
 */
export async function getReachPilotMetricsWithTrend(
  opts: MetricsQueryOptions = {},
): Promise<MetricsWithTrend> {
  const { actorId, from, to, limit = 10_000, slaThresholdSeconds } = opts;
  const compOpts = { slaThresholdSeconds };

  // Current period.
  const currentWhere = buildWhere({ actorId, from, to });
  const currentRows = await fetchContractRows(currentWhere, limit);
  const metrics = computeMetrics(currentRows, compOpts);

  // Trend comparison: only when both from and to are specified.
  let trend: TrendComparison | null = null;

  if (from && to) {
    const durationMs = to.getTime() - from.getTime();
    const prevFrom = new Date(from.getTime() - durationMs);
    const prevTo = new Date(from.getTime() - 1); // 1ms before current period start

    const prevWhere = buildWhere({ actorId, from: prevFrom, to: prevTo });
    const prevRows = await fetchContractRows(prevWhere, limit);
    const prevMetrics = computeMetrics(prevRows, compOpts);

    trend = computeTrend(metrics, prevMetrics);
  }

  return { metrics, trend };
}
