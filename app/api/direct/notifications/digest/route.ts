import { NextRequest, NextResponse } from 'next/server';
import { sendDigestNotifications } from '../../../../../features/direct/server/digest';

/**
 * POST /api/direct/notifications/digest
 *
 * Sends digest email summaries to keepers who have opted in.
 * Protected by CRON_SECRET — designed to be called by an external scheduler
 * (e.g. daily or every few hours).
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
    const result = await sendDigestNotifications();
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    console.error('Digest notification failed:', error);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
