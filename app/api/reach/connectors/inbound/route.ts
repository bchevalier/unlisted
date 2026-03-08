/**
 * POST /api/reach/connectors/inbound — Inbound connector endpoint.
 *
 * Allows external systems (CRMs, ticketing, AI pipelines) to POST
 * contract lifecycle actions back to Knokio Reach. This is the
 * counterpart to outbound webhook delivery.
 *
 * Supported actions:
 *   - acknowledge: mark that the contract was received/seen
 *   - accept: transition contract to ACTIVE (target actor only)
 *   - reject: transition contract to REJECTED (target actor only)
 *   - fulfill: fulfill the contract with optional responseData
 *
 * Auth: API key (Bearer token) of the target actor.
 */

import { z } from 'zod';
import {
  authenticateReachRequest,
  reachDisabledResponse,
  unauthorizedResponse,
} from '../../../../../lib/reach/auth';
import {
  getContract,
  transitionContract,
  fulfillContract,
  ReachError,
} from '../../../../../lib/reach/service';
import {
  reachWriteLimiter,
  reachAuthLimiter,
  getClientIp,
  rateLimitResponse,
} from '../../../../../lib/reach/rate-limit';

const InboundActionSchema = z.object({
  contractId: z.string().min(1),
  action: z.enum(['acknowledge', 'accept', 'reject', 'fulfill']),
  note: z.string().max(1000).optional(),
  responseData: z.record(z.unknown()).optional(),
});

export async function POST(request: Request) {
  const blocked = reachDisabledResponse();
  if (blocked) return blocked;

  // IP-based rate limiting for inbound connector actions.
  const clientIp = getClientIp(request);
  const ipCheck = reachWriteLimiter.check(clientIp);
  if (!ipCheck.allowed) return rateLimitResponse(ipCheck);

  const auth = await authenticateReachRequest(request);
  if (!auth) {
    reachAuthLimiter.check(clientIp);
    return unauthorizedResponse();
  }

  try {
    const body = await request.json();
    const data = InboundActionSchema.parse(body);

    // Load contract and verify the caller is the target.
    const contract = await getContract(data.contractId);
    if (!contract) {
      return Response.json({ ok: false, error: 'Contract not found' }, { status: 404 });
    }

    if (contract.targetId !== auth.actorId) {
      return Response.json(
        { ok: false, error: 'Only the target actor can perform this action' },
        { status: 403 },
      );
    }

    switch (data.action) {
      case 'acknowledge': {
        // Record an acknowledgment event. Does not change status.
        // Import db inline to avoid circular dependency issues.
        const { db } = await import('../../../../../lib/db');
        await db.reachContractEvent.create({
          data: {
            contractId: data.contractId,
            type: 'ROUTED',
            actor: 'TARGET',
            note: data.note ?? 'Acknowledged via inbound connector',
            metadata: {
              connectorAction: 'acknowledge',
              actorHandle: auth.actorId,
            } as Parameters<typeof db.reachContractEvent.create>[0]['data']['metadata'],
          },
        });
        return Response.json({ ok: true, action: 'acknowledged', contractId: data.contractId });
      }

      case 'accept': {
        const updated = await transitionContract(
          data.contractId,
          'ACTIVE',
          'TARGET',
          data.note ?? 'Accepted via inbound connector',
        );
        return Response.json({ ok: true, action: 'accepted', contract: { id: updated.id, status: updated.status } });
      }

      case 'reject': {
        const updated = await transitionContract(
          data.contractId,
          'REJECTED',
          'TARGET',
          data.note ?? 'Rejected via inbound connector',
        );
        return Response.json({ ok: true, action: 'rejected', contract: { id: updated.id, status: updated.status } });
      }

      case 'fulfill': {
        const updated = await fulfillContract(
          data.contractId,
          auth.actorId,
          data.responseData,
          data.note ?? 'Fulfilled via inbound connector',
        );
        return Response.json({ ok: true, action: 'fulfilled', contract: { id: updated.id, status: updated.status } });
      }

      default:
        return Response.json({ ok: false, error: 'Unknown action' }, { status: 400 });
    }
  } catch (error) {
    if (error instanceof z.ZodError) {
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
    console.error('[reach/connectors/inbound POST]', error);
    return Response.json({ ok: false, error: 'Internal server error' }, { status: 500 });
  }
}
