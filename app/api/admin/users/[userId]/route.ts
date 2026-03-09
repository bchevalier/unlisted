import { NextResponse } from 'next/server';
import { getAdminSessionFromRequest } from '../../../../../lib/admin-auth';
import { getUserDetail, disableUser, enableUser } from '../../../../../features/direct/server/admin';
import { logAdminAction, isValidEntityId } from '../../../../../lib/admin-audit';
import { getClientIp } from '../../../../../lib/admin-rate-limit';

type RouteContext = { params: Promise<{ userId: string }> };

export async function GET(request: Request, context: RouteContext) {
  const session = getAdminSessionFromRequest(request);
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { userId } = await context.params;

  if (!isValidEntityId(userId)) {
    return NextResponse.json({ error: 'Invalid user ID format' }, { status: 400 });
  }

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

  if (!isValidEntityId(userId)) {
    return NextResponse.json({ error: 'Invalid user ID format' }, { status: 400 });
  }

  const body = await request.json();
  const { action } = body;
  const ip = getClientIp(request);

  if (action === 'disable') {
    const result = await disableUser(userId);
    logAdminAction({
      adminEmail: session.email,
      action: 'user_disable',
      targetType: 'user',
      targetId: userId,
      ip,
    });
    return NextResponse.json({ ok: true, user: result });
  }

  if (action === 'enable') {
    const result = await enableUser(userId);
    logAdminAction({
      adminEmail: session.email,
      action: 'user_enable',
      targetType: 'user',
      targetId: userId,
      ip,
    });
    return NextResponse.json({ ok: true, user: result });
  }

  return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
}
