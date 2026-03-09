import { NextResponse } from 'next/server';
import { getAdminSessionFromRequest } from '../../../../lib/admin-auth';
import { getDashboardStats } from '../../../../features/direct/server/admin';

export async function GET(request: Request) {
  const session = getAdminSessionFromRequest(request);
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const stats = await getDashboardStats();
  return NextResponse.json(stats);
}
