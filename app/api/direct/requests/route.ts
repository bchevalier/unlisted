import { ZodError } from 'zod';
import { createFormRequest, DirectValidationError } from '../../../../features/direct/server/requests';

export async function POST(request: Request) {
  try {
    const payload = await request.json();
    const created = await createFormRequest(payload);

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
