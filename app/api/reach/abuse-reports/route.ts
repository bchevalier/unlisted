/**
 * POST /api/reach/abuse-reports — Submit an abuse report for a Reach contract.
 * GET  /api/reach/abuse-reports — List abuse reports (admin/future use).
 *
 * Auth required. Reporter must be a participant (initiator or target) of the contract.
 */

import { ZodError } from 'zod';
import {
  createReachAbuseReport,
  listReachAbuseReports,
  ReachSafetyError,
} from '../../../../lib/reach';
import {
  authenticateReachRequest,
  reachDisabledResponse,
  unauthorizedResponse,
} from '../../../../lib/reach/auth';

export async function POST(request: Request) {
  const blocked = reachDisabledResponse();
  if (blocked) return blocked;

  const auth = await authenticateReachRequest(request);
  if (!auth) return unauthorizedResponse();

  try {
    const body = await request.json();
    const report = await createReachAbuseReport(auth.actorId, body);
    return Response.json({ ok: true, report }, { status: 201 });
  } catch (error) {
    if (error instanceof ZodError) {
      return Response.json(
        { ok: false, error: 'Invalid payload', issues: error.issues },
        { status: 400 },
      );
    }
    if (error instanceof ReachSafetyError) {
      return Response.json(
        { ok: false, error: error.message, code: error.code },
        { status: error.statusCode },
      );
    }
    console.error('[reach/abuse-reports POST]', error);
    return Response.json({ ok: false, error: 'Internal server error' }, { status: 500 });
  }
}

export async function GET(request: Request) {
  const blocked = reachDisabledResponse();
  if (blocked) return blocked;

  const auth = await authenticateReachRequest(request);
  if (!auth) return unauthorizedResponse();

  try {
    const url = new URL(request.url);
    const status = url.searchParams.get('status') as 'OPEN' | 'REVIEWED' | 'DISMISSED' | null;
    const page = Math.max(1, parseInt(url.searchParams.get('page') || '1', 10));

    const result = await listReachAbuseReports({
      status: status || undefined,
      page,
    });

    return Response.json({ ok: true, ...result });
  } catch (error) {
    console.error('[reach/abuse-reports GET]', error);
    return Response.json({ ok: false, error: 'Internal server error' }, { status: 500 });
  }
}
