/**
 * POST /api/reach/contracts/expire — Expire stale contracts.
 *
 * Designed for cron/background job invocation.
 * Protected by a shared secret (same pattern as Direct expiry).
 */

import { expireStaleContracts } from '../../../../../lib/reach';
import { reachDisabledResponse } from '../../../../../lib/reach/auth';

export async function POST(request: Request) {
  const blocked = reachDisabledResponse();
  if (blocked) return blocked;

  // Simple shared-secret protection for cron endpoints.
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret) {
    const authHeader = request.headers.get('authorization');
    if (authHeader !== `Bearer ${cronSecret}`) {
      return Response.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
    }
  }

  try {
    const count = await expireStaleContracts();
    return Response.json({ ok: true, expired: count });
  } catch (error) {
    console.error('[reach/contracts/expire POST]', error);
    return Response.json({ ok: false, error: 'Internal server error' }, { status: 500 });
  }
}
