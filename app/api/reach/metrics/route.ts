import { logger } from '../../../../lib/logger';
import { captureException } from '../../../../lib/error-tracking';

const log = logger('reach:metrics GET');

/**
 * GET /api/reach/metrics — Retrieve Reach pilot metrics.
 *
 * Auth required. Returns metrics scoped to the authenticated actor.
 * Supports:
 *   ?from= and ?to= — ISO date filters for time-window queries
 *   ?trend=true     — include trend comparison against previous period (requires from+to)
 *
 * If ?actorId= is provided and the caller has org-level CONTRACT_READ,
 * metrics are scoped to that actor instead.
 */

import {
  getReachPilotMetrics,
  getReachPilotMetricsWithTrend,
} from '../../../../lib/reach/metrics';
import {
  authenticateReachRequest,
  reachDisabledResponse,
  unauthorizedResponse,
} from '../../../../lib/reach/auth';
import { resolveAuthz, requirePermission } from '../../../../lib/reach/permissions';

export async function GET(request: Request) {
  const blocked = reachDisabledResponse();
  if (blocked) return blocked;

  const auth = await authenticateReachRequest(request);
  if (!auth) return unauthorizedResponse();

  try {
    const url = new URL(request.url);

    // Optional time-window filters.
    const fromParam = url.searchParams.get('from');
    const toParam = url.searchParams.get('to');
    const from = fromParam ? new Date(fromParam) : undefined;
    const to = toParam ? new Date(toParam) : undefined;
    const includeTrend = url.searchParams.get('trend') === 'true';

    // Validate date params.
    if (from && isNaN(from.getTime())) {
      return Response.json(
        { ok: false, error: 'Invalid "from" date parameter' },
        { status: 400 },
      );
    }
    if (to && isNaN(to.getTime())) {
      return Response.json(
        { ok: false, error: 'Invalid "to" date parameter' },
        { status: 400 },
      );
    }

    // Actor scoping: default to caller, allow org delegation.
    let actorId = auth.actorId;
    const requestedActorId = url.searchParams.get('actorId');

    if (requestedActorId && requestedActorId !== auth.actorId) {
      const authz = await resolveAuthz(auth, requestedActorId);
      const denied = requirePermission(authz, 'CONTRACT_READ');
      if (denied) return denied;
      actorId = requestedActorId;
    }

    // Trend comparison requires both from and to.
    if (includeTrend && from && to) {
      const result = await getReachPilotMetricsWithTrend({ actorId, from, to });
      return Response.json({ ok: true, metrics: result.metrics, trend: result.trend });
    }

    const metrics = await getReachPilotMetrics({ actorId, from, to });
    return Response.json({ ok: true, metrics });
  } catch (error) {
    log.error('Request failed', { error });
    void captureException(error, { component: 'reach:metrics GET' });
    return Response.json({ ok: false, error: 'Internal server error' }, { status: 500 });
  }
}
