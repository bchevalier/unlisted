/**
 * Reach metrics data-fetching for server components.
 *
 * Wraps the metrics computation module with session-scoped queries
 * suitable for the Reach metrics dashboard page.
 */

import { getReachPilotMetrics } from '../../../lib/reach/metrics';
import type { ReachPilotMetrics, MetricsQueryOptions } from '../../../lib/reach/metrics';

export type { ReachPilotMetrics };

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
