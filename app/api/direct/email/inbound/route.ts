import { ZodError } from 'zod';
import { createEmailRequest, DirectValidationError } from '../../../../../features/direct/server/requests';

function isAuthorized(request: Request): boolean {
  const expectedSecret = process.env.INBOUND_EMAIL_WEBHOOK_SECRET;
  if (!expectedSecret) {
    return true;
  }

  const receivedSecret = request.headers.get('x-knokio-inbound-secret');
  return receivedSecret === expectedSecret;
}

export async function POST(request: Request) {
  if (!isAuthorized(request)) {
    return Response.json({ ok: false, error: 'Unauthorized inbound webhook' }, { status: 401 });
  }

  try {
    const payload = await request.json();
    const created = await createEmailRequest(payload);

    return Response.json({ ok: true, request: created }, { status: 201 });
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
