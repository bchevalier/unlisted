import { NextResponse } from 'next/server';
import { getAdminSessionFromRequest } from '../../../../lib/admin-auth';
import { listUsers } from '../../../../features/direct/server/admin';
import { captureException } from '../../../../lib/error-tracking';
import { logger } from '../../../../lib/logger';

const log = logger('admin:users');

export async function GET(request: Request) {
  const session = getAdminSessionFromRequest(request);
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const url = new URL(request.url);
    const page = Number(url.searchParams.get('page')) || 1;
    const search = url.searchParams.get('search') ?? undefined;

    const result = await listUsers({ page, search });
    return NextResponse.json(result);
  } catch (error) {
    log.error('Failed to list users', { error });
    await captureException(error, { component: 'admin:users' });
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
