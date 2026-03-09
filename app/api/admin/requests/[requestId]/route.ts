import { NextResponse } from 'next/server';
import { getAdminSessionFromRequest } from '../../../../../lib/admin-auth';
import { getRequestDetail, deleteRequest } from '../../../../../features/direct/server/admin';
import { logAdminAction, isValidEntityId } from '../../../../../lib/admin-audit';
import { getClientIp } from '../../../../../lib/admin-rate-limit';

type RouteContext = { params: Promise<{ requestId: string }> };

export async function GET(request: Request, context: RouteContext) {
  const session = getAdminSessionFromRequest(request);
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { requestId } = await context.params;

  if (!isValidEntityId(requestId)) {
    return NextResponse.json({ error: 'Invalid request ID format' }, { status: 400 });
  }

  const detail = await getRequestDetail(requestId);

  if (!detail) {
    return NextResponse.json({ error: 'Request not found' }, { status: 404 });
  }

  return NextResponse.json(detail);
}

export async function DELETE(request: Request, context: RouteContext) {
  const session = getAdminSessionFromRequest(request);
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { requestId } = await context.params;

  if (!isValidEntityId(requestId)) {
    return NextResponse.json({ error: 'Invalid request ID format' }, { status: 400 });
  }

  const ip = getClientIp(request);

  try {
    const result = await deleteRequest(requestId);
    logAdminAction({
      adminEmail: session.email,
      action: 'request_delete',
      targetType: 'request',
      targetId: requestId,
      ip,
    });
    return NextResponse.json({ ok: true, deleted: result.id });
  } catch {
    return NextResponse.json({ error: 'Request not found' }, { status: 404 });
  }
}
