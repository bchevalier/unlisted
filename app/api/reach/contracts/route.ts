/**
 * POST /api/reach/contracts — Propose a new contract.
 * GET  /api/reach/contracts — List contracts for the authenticated actor.
 *
 * Auth required. Supports ?actorId= to list contracts for an org the caller
 * is a member of (requires CONTRACT_READ on that org).
 *
 * GET query params:
 *   - role:          initiator | target | both (default: both)
 *   - status:        contract status filter
 *   - type:          contract type filter (HUMAN_HUMAN, AI_HUMAN, etc.)
 *   - createdAfter:  ISO date — only contracts created after this time
 *   - createdBefore: ISO date — only contracts created before this time
 *   - search:        keyword search on purpose field (case-insensitive)
 *   - sortBy:        createdAt | updatedAt (default: createdAt)
 *   - sortOrder:     asc | desc (default: desc)
 *   - escalated:     true — list only escalated contracts pending review
 *   - actorId:       list contracts for this actor (org delegation)
 *   - limit:         max results (1–100, default 50)
 *   - offset:        pagination offset (default 0)
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
import { resolveAuthz, requirePermission } from '../../../../lib/reach/permissions';
import type { ListContractsOptions } from '../../../../lib/reach/service';

export async function POST(request: Request) {
  const blocked = reachDisabledResponse();
  if (blocked) return blocked;

  const auth = await authenticateReachRequest(request);
  if (!auth) return unauthorizedResponse();

  try {
    const body = await request.json();
    const data = ReachContractCreateSchema.parse(body);

    // If ?actorId is provided, propose on behalf of that actor (org delegation).
    const url = new URL(request.url);
    const onBehalfOf = url.searchParams.get('actorId');
    let proposerId = auth.actorId;

    if (onBehalfOf && onBehalfOf !== auth.actorId) {
      const authz = await resolveAuthz(auth, onBehalfOf);
      const denied = requirePermission(authz, 'CONTRACT_PROPOSE');
      if (denied) return denied;
      proposerId = onBehalfOf;
    }

    const contract = await proposeContract(proposerId, data);

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
    const escalated = url.searchParams.get('escalated') === 'true';
    const limit = Math.min(Math.max(parseInt(url.searchParams.get('limit') || '50', 10) || 50, 1), 100);
    const offset = Math.max(parseInt(url.searchParams.get('offset') || '0', 10) || 0, 0);

    // If ?actorId is provided, list contracts for that actor (org delegation).
    const forActorId = url.searchParams.get('actorId') || auth.actorId;

    if (forActorId !== auth.actorId) {
      const authz = await resolveAuthz(auth, forActorId);
      const denied = requirePermission(authz, 'CONTRACT_READ');
      if (denied) return denied;
    }

    // If ?escalated=true, return only contracts pending human review.
    if (escalated) {
      const { contracts, totalCount } = await listEscalatedContracts(forActorId, limit, offset);
      return Response.json({
        ok: true,
        contracts,
        pagination: { totalCount, limit, offset },
      });
    }

    // Build query options from URL params.
    const opts: ListContractsOptions = {
      role: (url.searchParams.get('role') as 'initiator' | 'target' | 'both') || 'both',
      limit,
      offset,
    };

    const status = url.searchParams.get('status');
    if (status) opts.status = status as ReachContractStatus;

    const type = url.searchParams.get('type');
    if (type) opts.type = type;

    const createdAfter = url.searchParams.get('createdAfter');
    if (createdAfter) {
      const d = new Date(createdAfter);
      if (!isNaN(d.getTime())) opts.createdAfter = d;
    }

    const createdBefore = url.searchParams.get('createdBefore');
    if (createdBefore) {
      const d = new Date(createdBefore);
      if (!isNaN(d.getTime())) opts.createdBefore = d;
    }

    const search = url.searchParams.get('search');
    if (search) opts.search = search;

    const sortBy = url.searchParams.get('sortBy');
    if (sortBy === 'createdAt' || sortBy === 'updatedAt') opts.sortBy = sortBy;

    const sortOrder = url.searchParams.get('sortOrder');
    if (sortOrder === 'asc' || sortOrder === 'desc') opts.sortOrder = sortOrder;

    const { contracts, totalCount } = await listContracts(forActorId, opts);

    return Response.json({
      ok: true,
      contracts,
      pagination: { totalCount, limit, offset },
    });
  } catch (error) {
    console.error('[reach/contracts GET]', error);
    return Response.json({ ok: false, error: 'Internal server error' }, { status: 500 });
  }
}
