import { NextResponse } from 'next/server';
import { getAdminSessionFromRequest } from '../../../../../lib/admin-auth';
import { suspendDoor, unsuspendDoor } from '../../../../../features/direct/server/admin';

type RouteContext = { params: Promise<{ doorId: string }> };

export async function PATCH(request: Request, context: RouteContext) {
  const session = getAdminSessionFromRequest(request);
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { doorId } = await context.params;
  const body = await request.json();
  const { action } = body;

  if (action === 'suspend') {
    const result = await suspendDoor(doorId);
    return NextResponse.json({ ok: true, door: result });
  }

  if (action === 'unsuspend') {
    const result = await unsuspendDoor(doorId);
    return NextResponse.json({ ok: true, door: result });
  }

  return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
}
