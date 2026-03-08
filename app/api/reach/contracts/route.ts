/**
 * POST /api/reach/contracts — Propose a new contract.
 * GET  /api/reach/contracts — List contracts for the authenticated actor.
 *
 * Auth required.
 */

import { ZodError } from 'zod';
import { proposeContract, listContracts, listEscalatedContracts, ReachError } from '../../../../lib/reach';
import { ReachContractCreateSchema } from '../../../../lib/reach/contracts';
import type { ReachContractStatus } from '../../../../lib/reach/contracts';
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
    const data = ReachContractCreateSchema.parse(body);
    const contract = await proposeContract(auth.actorId, data);

    return Response.json({ ok: true, contract }, { status: 201 });
  } catch (error) {
    if (error instanceof ZodError) {
      return Response.json(
        { ok: false, error: 'Invalid payload', issues: error.issues },
        { status: 400 },
      );
    }
    if (error instanceof ReachError) {
      return Response.json(
        { ok: false, error: error.message, code: error.code },
        { status: error.statusCode },
      );
    }
    console.error('[reach/contracts POST]', error);
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
    const role = (url.searchParams.get('role') as 'initiator' | 'target' | 'both') || 'both';
    const status = url.searchParams.get('status') as ReachContractStatus | null;
    const escalated = url.searchParams.get('escalated') === 'true';
    const limit = Math.min(parseInt(url.searchParams.get('limit') || '50', 10), 100);
    const offset = Math.max(parseInt(url.searchParams.get('offset') || '0', 10), 0);

    // If ?escalated=true, return only contracts pending human review.
    if (escalated) {
      const contracts = await listEscalatedContracts(auth.actorId, limit, offset);
      return Response.json({ ok: true, contracts });
    }

    const contracts = await listContracts(
      auth.actorId,
      role,
      status || undefined,
      limit,
      offset,
    );

    return Response.json({ ok: true, contracts });
  } catch (error) {
    console.error('[reach/contracts GET]', error);
    return Response.json({ ok: false, error: 'Internal server error' }, { status: 500 });
  }
}
