import { NextRequest, NextResponse } from 'next/server';
import { expireStaleRequests } from '../../../../../features/direct/server/requests';

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
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const expiryDays = Number(process.env.REQUEST_EXPIRY_DAYS ?? 30);
    const result = await expireStaleRequests({
      expiryDays: Number.isNaN(expiryDays) || expiryDays <= 0 ? 30 : expiryDays
    });

    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    console.error('Auto-expire failed:', error);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
