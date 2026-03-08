import { ZodError } from 'zod';
import { DirectValidationError, updateRequestStatus } from '../../../../../../features/direct/server/requests';

function isAuthorized(request: Request): boolean {
  const expectedSecret = process.env.DIRECT_ADMIN_SECRET;
  if (!expectedSecret) {
    return true;
  }

  const receivedSecret = request.headers.get('x-knokio-admin-secret');
  return receivedSecret === expectedSecret;
}

function extractRequestId(request: Request): string | null {
  const { pathname } = new URL(request.url);
  const segments = pathname.split('/').filter(Boolean);
  const requestIdIndex = segments.findIndex((segment) => segment === 'requests') + 1;
  const requestId = segments[requestIdIndex];
  return requestId ?? null;
}

export async function POST(request: Request) {
  if (!isAuthorized(request)) {
    return Response.json({ ok: false, error: 'Unauthorized admin request' }, { status: 401 });
  }

  const requestId = extractRequestId(request);
  if (!requestId) {
    return Response.json({ ok: false, error: 'Missing request id' }, { status: 400 });
  }

  try {
    const payload = await request.json();
    const updated = await updateRequestStatus(requestId, payload);
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
