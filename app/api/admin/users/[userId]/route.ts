import { NextResponse } from 'next/server';
import { getAdminSessionFromRequest } from '../../../../../lib/admin-auth';
import { getUserDetail, disableUser, enableUser } from '../../../../../features/direct/server/admin';

type RouteContext = { params: Promise<{ userId: string }> };

export async function GET(request: Request, context: RouteContext) {
  const session = getAdminSessionFromRequest(request);
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { userId } = await context.params;
  const user = await getUserDetail(userId);

  if (!user) {
    return NextResponse.json({ error: 'User not found' }, { status: 404 });
  }

  return NextResponse.json(user);
}

export async function PATCH(request: Request, context: RouteContext) {
  const session = getAdminSessionFromRequest(request);
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { userId } = await context.params;
  const body = await request.json();
  const { action } = body;

  if (action === 'disable') {
    const result = await disableUser(userId);
    return NextResponse.json({ ok: true, user: result });
  }

  if (action === 'enable') {
    const result = await enableUser(userId);
    return NextResponse.json({ ok: true, user: result });
  }

  return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
}
