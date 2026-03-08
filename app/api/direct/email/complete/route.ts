import { ZodError } from 'zod';
import { completeEmailRequest, DirectValidationError } from '../../../../../features/direct/server/requests';

export async function POST(request: Request) {
  try {
    const payload = await request.json();
    const result = await completeEmailRequest(payload);

    return Response.json({ ok: true, request: result }, { status: 200 });
  } catch (error) {
    if (error instanceof ZodError) {
      return Response.json({ ok: false, error: 'Invalid payload', issues: error.issues }, { status: 400 });
    }

    if (error instanceof DirectValidationError) {
      return Response.json({ ok: false, error: error.message }, { status: error.statusCode });
    }

    console.error(error);
    return Response.json({ ok: false, error: 'Internal server error' }, { status: 500 });
  }
}
