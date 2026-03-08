/**
 * GET /api/reach/health — Reach subsystem health check.
 *
 * Returns system readiness for the Reach pilot:
 *   - Feature flag status
 *   - Database connectivity (Reach tables accessible)
 *   - Actor/contract/policy counts
 *
 * No auth required — intended for monitoring and pilot readiness verification.
 */

import { db } from '../../../../lib/db';
import { isReachEnabled } from '../../../../lib/flags';

export async function GET() {
  const enabled = isReachEnabled();

  if (!enabled) {
    return Response.json({
      ok: true,
      status: 'disabled',
      reach: { enabled: false },
    });
  }

  try {
    const [actorCount, contractCount, policyCount, webhookCount] = await Promise.all([
      db.reachActor.count({ where: { isActive: true } }),
      db.reachContract.count(),
      db.reachPolicy.count({ where: { isActive: true } }),
      db.reachWebhook.count({ where: { isActive: true } }),
    ]);

    const actorsByType = await db.reachActor.groupBy({
      by: ['type'],
      where: { isActive: true },
      _count: true,
    });

    const contractsByStatus = await db.reachContract.groupBy({
      by: ['status'],
      _count: true,
    });

    return Response.json({
      ok: true,
      status: 'ready',
      reach: {
        enabled: true,
        actors: {
          total: actorCount,
          byType: Object.fromEntries(
            actorsByType.map((g) => [g.type, g._count]),
          ),
        },
        contracts: {
          total: contractCount,
          byStatus: Object.fromEntries(
            contractsByStatus.map((g) => [g.status, g._count]),
          ),
        },
        policies: policyCount,
        webhooks: webhookCount,
      },
    });
  } catch (error) {
    console.error('[reach/health]', error);
    return Response.json(
      {
        ok: false,
        status: 'error',
        reach: { enabled: true },
        error: 'Database connectivity check failed',
      },
      { status: 503 },
    );
  }
}
