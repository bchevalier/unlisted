import { NextRequest, NextResponse } from 'next/server';
import { expireStaleRequests } from '../../../../../features/direct/server/requests';
import { logger } from '../../../../../lib/logger';
import { captureException } from '../../../../../lib/error-tracking';
import { increment, METRIC } from '../../../../../lib/metrics';

const log = logger('requests:expire');

/**
 * POST /api/direct/requests/expire
 *
 * Triggers auto-expiration of stale pending requests.
 * Protected by a shared secret (CRON_SECRET) to prevent unauthorized access.
 * Designed to be called by a cron job or external scheduler.
 */
export async function POST(request: NextRequest) {
  const cronSecret = process.env.CRON_SECRET;

  if (!cronSecret || cronSecret.length < 16) {
    return NextResponse.json({ error: 'Cron endpoint not configured' }, { status: 503 });
  }

  const authorization = request.headers.get('authorization');
  if (authorization !== `Bearer ${cronSecret}`) {
    log.warn('Unauthorized expire cron request');
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const expiryDays = Number(process.env.REQUEST_EXPIRY_DAYS ?? 30);
    const result = await expireStaleRequests({
      expiryDays: Number.isNaN(expiryDays) || expiryDays <= 0 ? 30 : expiryDays
    });

    log.info('Auto-expire completed', result);
    if (typeof result.expired === 'number') {
      increment(METRIC.REQUEST_EXPIRED, result.expired);
    }
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    log.error('Auto-expire failed', { error });
    await captureException(error, { component: 'requests:expire' });
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
