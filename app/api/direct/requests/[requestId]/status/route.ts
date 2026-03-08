import { ZodError } from 'zod';
import {
  DirectValidationError,
  updateRequestStatusForKeeper
} from '../../../../../../features/direct/server/requests';
import { getKeeperSessionFromRequest } from '../../../../../../lib/keeper-auth';

function extractRequestId(request: Request): string | null {
  const { pathname } = new URL(request.url);
  const segments = pathname.split('/').filter(Boolean);
  const requestIdIndex = segments.findIndex((segment) => segment === 'requests') + 1;
  const requestId = segments[requestIdIndex];
  return requestId ?? null;
}

export async function POST(request: Request) {
  const session = getKeeperSessionFromRequest(request);
  if (!session) {
    return Response.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
  }

  const requestId = extractRequestId(request);
  if (!requestId) {
    return Response.json({ ok: false, error: 'Missing request id' }, { status: 400 });
  }

  try {
    const payload = await request.json();
    const updated = await updateRequestStatusForKeeper(session.userId, requestId, payload);
    return Response.json({ ok: true, request: updated });
  } catch (error) {
    if (error instanceof ZodError) {
      return Response.json({ ok: false, error: 'Invalid payload', issues: error.issues }, { status: 400 });
    }

    if (error instanceof DirectValidationError) {
      return Response.json({ ok: false, error: error.message }, { status: 400 });
    }

    console.error(error);
    return Response.json({ ok: false, error: 'Internal server error' }, { status: 500 });
  }
}
