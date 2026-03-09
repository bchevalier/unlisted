import { NextResponse } from 'next/server';
import { RequestStatus } from '@prisma/client';
import { getAdminSessionFromRequest } from '../../../../lib/admin-auth';
import { listRequests, deleteRequests } from '../../../../features/direct/server/admin';

const VALID_STATUSES = ['PENDING', 'ACCEPTED', 'DECLINED', 'EXPIRED', 'AWAITING_COMPLETION'];

export async function GET(request: Request) {
  const session = getAdminSessionFromRequest(request);
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const url = new URL(request.url);
  const page = Number(url.searchParams.get('page')) || 1;
  const search = url.searchParams.get('search') ?? undefined;
  const statusParam = url.searchParams.get('status');
  const doorId = url.searchParams.get('doorId') ?? undefined;
  const status = statusParam && VALID_STATUSES.includes(statusParam)
    ? (statusParam as RequestStatus)
    : undefined;

  const result = await listRequests({ page, search, status, doorId });
  return NextResponse.json(result);
}

export async function DELETE(request: Request) {
  const session = getAdminSessionFromRequest(request);
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await request.json();
  const { requestIds } = body;

  if (!Array.isArray(requestIds) || requestIds.length === 0) {
    return NextResponse.json({ error: 'requestIds array required' }, { status: 400 });
  }

  if (requestIds.length > 100) {
    return NextResponse.json({ error: 'Max 100 requests per batch delete' }, { status: 400 });
  }

  const result = await deleteRequests(requestIds);
  return NextResponse.json({ ok: true, deleted: result.count });
}
