import { NextResponse } from 'next/server';
import { getAdminSessionFromRequest } from '../../../../../lib/admin-auth';
import { getRequestDetail, deleteRequest } from '../../../../../features/direct/server/admin';

type RouteContext = { params: Promise<{ requestId: string }> };

export async function GET(request: Request, context: RouteContext) {
  const session = getAdminSessionFromRequest(request);
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { requestId } = await context.params;
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

  try {
    const result = await deleteRequest(requestId);
    return NextResponse.json({ ok: true, deleted: result.id });
  } catch {
    return NextResponse.json({ error: 'Request not found' }, { status: 404 });
  }
}
