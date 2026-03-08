import { ZodError } from 'zod';
import { createFormRequest, DirectValidationError } from '../../../../features/direct/server/requests';

function extractClientIP(request: Request): string | null {
  const forwarded = request.headers.get('x-forwarded-for');
  if (forwarded) {
    return forwarded.split(',')[0]?.trim() ?? null;
  }

  return request.headers.get('x-real-ip')?.trim() || null;
}

export async function POST(request: Request) {
  try {
    const payload = await request.json();
    const ipAddress = extractClientIP(request);
    const created = await createFormRequest(payload, {
      ipAddress,
      cfTurnstileToken: typeof payload['cf-turnstile-response'] === 'string'
        ? payload['cf-turnstile-response']
        : null,
      honeypot: typeof payload._hp_website === 'string' ? payload._hp_website : null
    });

    return Response.json({ ok: true, request: created }, { status: 201 });
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
