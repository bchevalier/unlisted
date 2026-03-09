import { NextResponse } from 'next/server';
import { getAdminSessionFromRequest } from '../../../../lib/admin-auth';
import { getDashboardStats } from '../../../../features/direct/server/admin';
import { captureException } from '../../../../lib/error-tracking';
import { logger } from '../../../../lib/logger';

const log = logger('admin:stats');

export async function GET(request: Request) {
  const session = getAdminSessionFromRequest(request);
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const stats = await getDashboardStats();
    return NextResponse.json(stats);
  } catch (error) {
    log.error('Failed to fetch dashboard stats', { error });
    await captureException(error, { component: 'admin:stats' });
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
