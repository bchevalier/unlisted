import { NextResponse } from 'next/server';
import { getAdminSessionFromRequest } from '../../../../lib/admin-auth';
import { listAbuseReports } from '../../../../features/direct/server/admin';
import { captureException } from '../../../../lib/error-tracking';
import { logger } from '../../../../lib/logger';

const log = logger('admin:abuse-reports');

export async function GET(request: Request) {
  const session = getAdminSessionFromRequest(request);
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const url = new URL(request.url);
    const page = Number(url.searchParams.get('page')) || 1;
    const status = url.searchParams.get('status') ?? undefined;

    const result = await listAbuseReports({ page, status });
    return NextResponse.json(result);
  } catch (error) {
    log.error('Failed to list abuse reports', { error });
    await captureException(error, { component: 'admin:abuse-reports' });
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
