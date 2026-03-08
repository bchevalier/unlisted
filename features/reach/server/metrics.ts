/**
 * Reach metrics data-fetching for server components.
 *
 * Wraps the metrics computation module with session-scoped queries
 * suitable for the Reach metrics dashboard page.
 */

import {
  getReachPilotMetrics,
  getReachPilotMetricsWithTrend,
} from '../../../lib/reach/metrics';
import type {
  ReachPilotMetrics,
  MetricsWithTrend,
  TrendComparison,
} from '../../../lib/reach/metrics';

export type { ReachPilotMetrics, MetricsWithTrend, TrendComparison };

/**
 * Fetch metrics for the current actor (or system-wide if no actorId).
 */
export async function getMetricsForActor(
  actorId: string,
  opts?: { from?: Date; to?: Date },
): Promise<ReachPilotMetrics> {
  return getReachPilotMetrics({
    actorId,
    from: opts?.from,
    to: opts?.to,
  });
}

/**
 * Fetch metrics with trend comparison for the current actor.
 * When from/to are provided, automatically compares to the previous period.
 */
export async function getMetricsWithTrendForActor(
  actorId: string,
  opts?: { from?: Date; to?: Date },
): Promise<MetricsWithTrend> {
  return getReachPilotMetricsWithTrend({
    actorId,
    from: opts?.from,
    to: opts?.to,
  });
}

/**
 * Fetch system-wide metrics (admin use).
 */
export async function getSystemMetrics(
  opts?: { from?: Date; to?: Date },
): Promise<ReachPilotMetrics> {
  return getReachPilotMetrics({
    from: opts?.from,
    to: opts?.to,
  });
}

/**
 * Fetch system-wide metrics with trend comparison (admin use).
 */
export async function getSystemMetricsWithTrend(
  opts?: { from?: Date; to?: Date },
): Promise<MetricsWithTrend> {
  return getReachPilotMetricsWithTrend({
    from: opts?.from,
    to: opts?.to,
  });
}
