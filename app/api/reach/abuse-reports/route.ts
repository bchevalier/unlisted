import { logger } from '../../../../lib/logger';
import { captureException } from '../../../../lib/error-tracking';

const log = logger('reach:abuse-reports POST');

/**
 * POST  /api/reach/abuse-reports — Submit an abuse report for a Reach contract.
 * GET   /api/reach/abuse-reports — List abuse reports (scoped to own contracts; admin sees all).
 * PATCH /api/reach/abuse-reports — Review/update an abuse report status (admin only).
 *
 * Auth required. Reporter must be a participant (initiator or target) of the contract.
 * Admin detection: actors with `isAdmin` flag or configurable admin handles.
 */

import { ZodError } from 'zod';
import {
  createReachAbuseReport,
  listReachAbuseReports,
  reviewAbuseReport,
  listOwnAbuseReports,
  ReachSafetyError,
} from '../../../../lib/reach';
import {
  authenticateReachRequest,
  reachDisabledResponse,
  unauthorizedResponse,
} from '../../../../lib/reach/auth';
import {
  reachWriteLimiter,
  reachReadLimiter,
  getClientIp,
  rateLimitResponse,
} from '../../../../lib/reach/rate-limit';

/** Admin handles (env-configurable, comma-separated). */
const ADMIN_HANDLES = (process.env.REACH_ADMIN_HANDLES ?? '')
  .split(',')
  .map((h) => h.trim().toLowerCase())
  .filter(Boolean);

/**
 * Check if the authenticated actor is a Reach admin.
 * Currently based on a configurable allowlist of handles.
 */
async function isReachAdmin(auth: { actorId: string }): Promise<boolean> {
  if (ADMIN_HANDLES.length === 0) return false;
  const { db } = await import('../../../../lib/db');
  const actor = await db.reachActor.findUnique({
    where: { id: auth.actorId },
    select: { handle: true },
  });
  return !!actor && ADMIN_HANDLES.includes(actor.handle.toLowerCase());
}

export async function POST(request: Request) {
  const blocked = reachDisabledResponse();
  if (blocked) return blocked;

  const clientIp = getClientIp(request);
  const ipCheck = reachWriteLimiter.check(clientIp);
  if (!ipCheck.allowed) return rateLimitResponse(ipCheck);

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
    log.error('Request failed', { error });
    void captureException(error, { component: 'reach:abuse-reports POST' });
    return Response.json({ ok: false, error: 'Internal server error' }, { status: 500 });
  }
}

export async function GET(request: Request) {
  const blocked = reachDisabledResponse();
  if (blocked) return blocked;

  const clientIp = getClientIp(request);
  const ipCheck = reachReadLimiter.check(clientIp);
  if (!ipCheck.allowed) return rateLimitResponse(ipCheck);

  const auth = await authenticateReachRequest(request);
  if (!auth) return unauthorizedResponse();

  try {
    const url = new URL(request.url);
    const status = url.searchParams.get('status') as 'OPEN' | 'REVIEWED' | 'DISMISSED' | null;
    const page = Math.max(1, parseInt(url.searchParams.get('page') || '1', 10));

    const admin = await isReachAdmin(auth);

    // Admins see all reports; regular actors only see reports on their own contracts.
    const result = admin
      ? await listReachAbuseReports({ status: status || undefined, page })
      : await listOwnAbuseReports(auth.actorId, { status: status || undefined, page });

    return Response.json({ ok: true, ...result });
  } catch (error) {
    log.error('Request failed', { error });
    void captureException(error, { component: 'reach:abuse-reports POST' });
    return Response.json({ ok: false, error: 'Internal server error' }, { status: 500 });
  }
}

/**
 * PATCH /api/reach/abuse-reports — Review an abuse report (admin only).
 *
 * Body: { reportId, status: 'REVIEWED' | 'DISMISSED', reviewNote? }
 *
 * When status is REVIEWED (confirmed abuse), automated consequences fire:
 * - Auto-block: offender is blocked from contacting the reporter
 * - Auto-suspend: if offender exceeds the confirmed-report threshold
 */
export async function PATCH(request: Request) {
  const blocked = reachDisabledResponse();
  if (blocked) return blocked;

  const clientIp = getClientIp(request);
  const ipCheck = reachWriteLimiter.check(clientIp);
  if (!ipCheck.allowed) return rateLimitResponse(ipCheck);

  const auth = await authenticateReachRequest(request);
  if (!auth) return unauthorizedResponse();

  // Admin-only.
  const admin = await isReachAdmin(auth);
  if (!admin) {
    return Response.json(
      { ok: false, error: 'Forbidden: admin access required' },
      { status: 403 },
    );
  }

  try {
    const body = await request.json();
    const result = await reviewAbuseReport(body);
    return Response.json({ ok: true, report: result });
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
    log.error('Request failed', { error });
    void captureException(error, { component: 'reach:abuse-reports POST' });
    return Response.json({ ok: false, error: 'Internal server error' }, { status: 500 });
  }
}
