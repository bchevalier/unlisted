import { NextResponse } from 'next/server';
import { getAdminSessionFromRequest } from '../../../../../lib/admin-auth';
import { suspendDoor, unsuspendDoor } from '../../../../../features/direct/server/admin';
import { logAdminAction, isValidEntityId } from '../../../../../lib/admin-audit';
import { getClientIp } from '../../../../../lib/admin-rate-limit';
import { captureException } from '../../../../../lib/error-tracking';
import { logger } from '../../../../../lib/logger';

const log = logger('admin:door-detail');

type RouteContext = { params: Promise<{ doorId: string }> };

export async function PATCH(request: Request, context: RouteContext) {
  const session = getAdminSessionFromRequest(request);
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { doorId } = await context.params;

  if (!isValidEntityId(doorId)) {
    return NextResponse.json({ error: 'Invalid door ID format' }, { status: 400 });
  }

  const body = await request.json();
  const { action } = body;
  const ip = getClientIp(request);

  try {
    if (action === 'suspend') {
      const result = await suspendDoor(doorId);
      logAdminAction({
        adminEmail: session.email,
        action: 'door_suspend',
        targetType: 'door',
        targetId: doorId,
        ip,
      });
      return NextResponse.json({ ok: true, door: result });
    }

    if (action === 'unsuspend') {
      const result = await unsuspendDoor(doorId);
      logAdminAction({
        adminEmail: session.email,
        action: 'door_unsuspend',
        targetType: 'door',
        targetId: doorId,
        ip,
      });
      return NextResponse.json({ ok: true, door: result });
    }

    return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
  } catch (error) {
    log.error('Admin door action failed', { error, doorId, action });
    await captureException(error, { component: 'admin:door-detail', doorId });
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
