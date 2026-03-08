import { ZodError } from 'zod';
import { AbuseReportError, createAbuseReport } from '../../../../features/direct/server/abuse-reports';

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

    const report = await createAbuseReport(payload, { ipAddress });

    return Response.json({ ok: true, report }, { status: 201 });
  } catch (error) {
    if (error instanceof ZodError) {
      return Response.json({ ok: false, error: 'Invalid payload', issues: error.issues }, { status: 400 });
    }

    if (error instanceof AbuseReportError) {
      return Response.json({ ok: false, error: error.message }, { status: error.statusCode });
    }

    console.error(error);
    return Response.json({ ok: false, error: 'Internal server error' }, { status: 500 });
  }
}
