import { NextResponse } from 'next/server';
import { getAdminSessionFromRequest } from '../../../../lib/admin-auth';
import { listAbuseReports } from '../../../../features/direct/server/admin';

export async function GET(request: Request) {
  const session = getAdminSessionFromRequest(request);
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const url = new URL(request.url);
  const page = Number(url.searchParams.get('page')) || 1;
  const status = url.searchParams.get('status') ?? undefined;

  const result = await listAbuseReports({ page, status });
  return NextResponse.json(result);
}
