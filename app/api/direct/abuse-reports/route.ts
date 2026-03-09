import { ZodError } from 'zod';
import { AbuseReportError, createAbuseReport } from '../../../../features/direct/server/abuse-reports';
import { logger } from '../../../../lib/logger';
import { captureException } from '../../../../lib/error-tracking';

const log = logger('abuse-reports');

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

    log.info('Abuse report created', { reportId: report.id });
    return Response.json({ ok: true, report }, { status: 201 });
  } catch (error) {
    if (error instanceof ZodError) {
      return Response.json({ ok: false, error: 'Invalid payload', issues: error.issues }, { status: 400 });
    }

    if (error instanceof AbuseReportError) {
      return Response.json({ ok: false, error: error.message }, { status: error.statusCode });
    }

    log.error('Abuse report creation failed', { error });
    await captureException(error, { component: 'abuse-reports' });
    return Response.json({ ok: false, error: 'Internal server error' }, { status: 500 });
  }
}
