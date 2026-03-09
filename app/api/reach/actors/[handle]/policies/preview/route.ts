import { logger } from '../../../../../../../lib/logger';
import { captureException } from '../../../../../../../lib/error-tracking';

const log = logger('reach:policies:preview POST');

/**
 * POST /api/reach/actors/:handle/policies/preview — Dry-run policy evaluation.
 *
 * Lets operators test their policy configuration against a sample proposal
 * without creating a real contract. Returns the full evaluation trace so
 * operators can see which policies matched, which were skipped, and why.
 *
 * Auth required: caller must own the actor or have POLICY_READ permission.
 */

import { z, ZodError } from 'zod';
import { db } from '../../../../../../../lib/db';
import {
  REACH_CONTRACT_TYPES,
  REACH_ACTOR_TYPES,
  evaluatePoliciesWithTrace,
} from '../../../../../../../lib/reach';
import type { PolicyRecord, ContractProposal } from '../../../../../../../lib/reach';
import { getActorByHandle } from '../../../../../../../lib/reach';
import {
  authenticateReachRequest,
  reachDisabledResponse,
  unauthorizedResponse,
} from '../../../../../../../lib/reach/auth';
import { resolveAuthz, requirePermission } from '../../../../../../../lib/reach/permissions';

// ---------------------------------------------------------------------------
// Request schema
// ---------------------------------------------------------------------------

const PolicyPreviewSchema = z.object({
  /** Contract type to simulate. */
  type: z.enum(REACH_CONTRACT_TYPES),
  /** Initiator actor type (for filter matching). */
  initiatorType: z.enum(REACH_ACTOR_TYPES).default('HUMAN'),
  /** Whether the simulated initiator is verified. */
  initiatorVerified: z.boolean().default(false),
  /** Purpose text for keyword filter matching. */
  purpose: z.string().min(1).max(1000),
  /** Optional tags for tag-based filter matching. */
  tags: z.array(z.string()).optional(),
  /** Simulated weekly inbound count for cap evaluation. */
  weeklyCount: z.number().int().min(0).default(0),
});

// ---------------------------------------------------------------------------
// Handler
// ---------------------------------------------------------------------------

export async function POST(
  request: Request,
  { params }: { params: Promise<{ handle: string }> },
) {
  const blocked = reachDisabledResponse();
  if (blocked) return blocked;

  const auth = await authenticateReachRequest(request);
  if (!auth) return unauthorizedResponse();

  const { handle } = await params;
  const actor = await getActorByHandle(handle);
  if (!actor) {
    return Response.json({ ok: false, error: 'Actor not found' }, { status: 404 });
  }

  // RBAC check: policy preview needs at least POLICY_READ.
  const authz = await resolveAuthz(auth, actor.id);
  const denied = requirePermission(authz, 'POLICY_READ');
  if (denied) return denied;

  try {
    const body = await request.json();
    const data = PolicyPreviewSchema.parse(body);

    // Load actor's policies.
    const policies = await db.reachPolicy.findMany({
      where: { actorId: actor.id },
      orderBy: { priority: 'desc' },
    });

    const policyRecords: PolicyRecord[] = policies.map((p) => ({
      id: p.id,
      isActive: p.isActive,
      contractTypes: p.contractTypes,
      action: p.action,
      maxWeeklyInbound: p.maxWeeklyInbound,
      requireVerifiedSender: p.requireVerifiedSender,
      autoAcceptMatching: p.autoAcceptMatching,
      escalateToHuman: p.escalateToHuman,
      filters: p.filters as Record<string, unknown> | null,
      priority: p.priority,
    }));

    const proposal: ContractProposal = {
      type: data.type,
      initiatorType: data.initiatorType,
      initiatorVerified: data.initiatorVerified,
      purpose: data.purpose,
      tags: data.tags,
    };

    const evaluation = evaluatePoliciesWithTrace(
      policyRecords,
      proposal,
      data.weeklyCount,
    );

    return Response.json({
      ok: true,
      preview: {
        result: evaluation.result,
        trace: evaluation.trace,
        activePoliciesCount: evaluation.activePoliciesCount,
        evaluationTimeUs: evaluation.evaluationTimeUs,
        proposal: {
          type: data.type,
          initiatorType: data.initiatorType,
          initiatorVerified: data.initiatorVerified,
          purpose: data.purpose,
          tags: data.tags ?? [],
          weeklyCount: data.weeklyCount,
        },
      },
    });
  } catch (error) {
    if (error instanceof ZodError) {
      return Response.json(
        { ok: false, error: 'Invalid payload', issues: error.issues },
        { status: 400 },
      );
    }
    log.error('Request failed', { error });
    void captureException(error, { component: 'reach:policies:preview POST' });
    return Response.json({ ok: false, error: 'Internal server error' }, { status: 500 });
  }
}
