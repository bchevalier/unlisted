import { NextResponse } from 'next/server';
import { getAdminSessionFromRequest } from '../../../../lib/admin-auth';
import { listDoors } from '../../../../features/direct/server/admin';

export async function GET(request: Request) {
  const session = getAdminSessionFromRequest(request);
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const url = new URL(request.url);
  const page = Number(url.searchParams.get('page')) || 1;
  const search = url.searchParams.get('search') ?? undefined;

  const result = await listDoors({ page, search });
  return NextResponse.json(result);
}
