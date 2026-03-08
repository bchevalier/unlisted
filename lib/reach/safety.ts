/**
 * Reach safety & abuse controls.
 *
 * Provides:
 *   - Actor-level blocklist (block/unblock/check)
 *   - Per-actor contract creation rate limiting
 *   - Initiator→target cooldown to prevent harassment
 *   - Abuse report CRUD
 *
 * All DB-backed. Called from proposeContract() and API routes.
 */

import { z } from 'zod';
import { db } from '../db';
import type { ReachAbuseReportReason, ReachAbuseReportStatus } from '@prisma/client';

// ---------------------------------------------------------------------------
// Configuration (overridable via env)
// ---------------------------------------------------------------------------

/** Max contracts an actor can create per rolling window. */
const ACTOR_RATE_LIMIT_MAX = Number(process.env.REACH_ACTOR_RATE_LIMIT_MAX ?? 30);
/** Rolling window for actor rate limit in minutes. */
const ACTOR_RATE_LIMIT_WINDOW_MINUTES = Number(
  process.env.REACH_ACTOR_RATE_LIMIT_WINDOW_MINUTES ?? 60,
);

/** Min minutes between contracts from same initiator to same target. */
const PAIR_COOLDOWN_MINUTES = Number(process.env.REACH_PAIR_COOLDOWN_MINUTES ?? 60);

/** Max abuse reports an actor can submit per rolling window. */
const ABUSE_REPORT_RATE_LIMIT_MAX = Number(
  process.env.REACH_ABUSE_REPORT_RATE_LIMIT_MAX ?? 10,
);
/** Rolling window for abuse report rate limit in minutes. */
const ABUSE_REPORT_RATE_LIMIT_WINDOW_MINUTES = Number(
  process.env.REACH_ABUSE_REPORT_RATE_LIMIT_WINDOW_MINUTES ?? 60,
);

// ---------------------------------------------------------------------------
// Errors
// ---------------------------------------------------------------------------

export class ReachSafetyError extends Error {
  constructor(
    message: string,
    public code: string,
    public statusCode: number = 400,
  ) {
    super(message);
    this.name = 'ReachSafetyError';
  }
}

// ---------------------------------------------------------------------------
// Blocklist
// ---------------------------------------------------------------------------

export const ReachBlockCreateSchema = z.object({
  blockedHandle: z.string().min(2).max(64),
  reason: z.string().max(500).optional(),
});

export type ReachBlockCreate = z.infer<typeof ReachBlockCreateSchema>;

/**
 * Block another actor from sending contracts to the blocker.
 */
export async function blockActor(blockerId: string, input: ReachBlockCreate) {
  const data = ReachBlockCreateSchema.parse(input);

  const blocked = await db.reachActor.findUnique({
    where: { handle: data.blockedHandle },
    select: { id: true },
  });
  if (!blocked) {
    throw new ReachSafetyError('Actor not found', 'ACTOR_NOT_FOUND', 404);
  }
  if (blocked.id === blockerId) {
    throw new ReachSafetyError('Cannot block yourself', 'SELF_BLOCK', 400);
  }

  // Upsert — if already blocked, update reason.
  const entry = await db.reachBlockedActor.upsert({
    where: {
      blockerId_blockedId: { blockerId, blockedId: blocked.id },
    },
    update: { reason: data.reason ?? null },
    create: {
      blockerId,
      blockedId: blocked.id,
      reason: data.reason ?? null,
    },
  });

  return entry;
}

/**
 * Unblock a previously blocked actor.
 */
export async function unblockActor(blockerId: string, blockedHandle: string) {
  const blocked = await db.reachActor.findUnique({
    where: { handle: blockedHandle },
    select: { id: true },
  });
  if (!blocked) {
    throw new ReachSafetyError('Actor not found', 'ACTOR_NOT_FOUND', 404);
  }

  const existing = await db.reachBlockedActor.findUnique({
    where: { blockerId_blockedId: { blockerId, blockedId: blocked.id } },
  });
  if (!existing) {
    throw new ReachSafetyError('Not blocked', 'NOT_BLOCKED', 404);
  }

  await db.reachBlockedActor.delete({
    where: { id: existing.id },
  });

  return { unblocked: true };
}

/**
 * Check if a target has blocked an initiator.
 * Used in proposeContract() to reject at the gate.
 */
export async function isBlocked(targetId: string, initiatorId: string): Promise<boolean> {
  const block = await db.reachBlockedActor.findUnique({
    where: { blockerId_blockedId: { blockerId: targetId, blockedId: initiatorId } },
    select: { id: true },
  });
  return !!block;
}

/**
 * List actors blocked by the given actor.
 */
export async function listBlockedActors(blockerId: string) {
  return db.reachBlockedActor.findMany({
    where: { blockerId },
    include: {
      blocked: {
        select: { id: true, handle: true, displayName: true, type: true },
      },
    },
    orderBy: { createdAt: 'desc' },
  });
}

// ---------------------------------------------------------------------------
// Per-actor rate limiting (contract creation)
// ---------------------------------------------------------------------------

/**
 * Enforce a rolling-window rate limit on contracts created by an actor.
 * Throws ReachSafetyError if limit exceeded.
 */
export async function enforceActorRateLimit(initiatorId: string): Promise<void> {
  if (ACTOR_RATE_LIMIT_MAX <= 0 || ACTOR_RATE_LIMIT_WINDOW_MINUTES <= 0) return;

  const since = new Date(Date.now() - ACTOR_RATE_LIMIT_WINDOW_MINUTES * 60 * 1000);
  const count = await db.reachContract.count({
    where: {
      initiatorId,
      createdAt: { gte: since },
    },
  });

  if (count >= ACTOR_RATE_LIMIT_MAX) {
    throw new ReachSafetyError(
      `Rate limit exceeded: max ${ACTOR_RATE_LIMIT_MAX} contracts per ${ACTOR_RATE_LIMIT_WINDOW_MINUTES} minutes`,
      'ACTOR_RATE_LIMIT',
      429,
    );
  }
}

// ---------------------------------------------------------------------------
// Initiator→target cooldown (anti-harassment)
// ---------------------------------------------------------------------------

/**
 * Enforce a cooldown between contracts from the same initiator to the same target.
 * Throws ReachSafetyError if the last contract was too recent.
 */
export async function enforcePairCooldown(
  initiatorId: string,
  targetId: string,
): Promise<void> {
  if (PAIR_COOLDOWN_MINUTES <= 0) return;

  const since = new Date(Date.now() - PAIR_COOLDOWN_MINUTES * 60 * 1000);
  const recent = await db.reachContract.findFirst({
    where: {
      initiatorId,
      targetId,
      createdAt: { gte: since },
    },
    select: { id: true, createdAt: true },
    orderBy: { createdAt: 'desc' },
  });

  if (recent) {
    const waitMinutes = Math.ceil(
      (PAIR_COOLDOWN_MINUTES * 60 * 1000 - (Date.now() - recent.createdAt.getTime())) / 60000,
    );
    throw new ReachSafetyError(
      `Please wait ${waitMinutes} minute${waitMinutes === 1 ? '' : 's'} before sending another contract to this actor`,
      'PAIR_COOLDOWN',
      429,
    );
  }
}

// ---------------------------------------------------------------------------
// Abuse reports
// ---------------------------------------------------------------------------

const REACH_ABUSE_REPORT_REASONS = [
  'SPAM',
  'HARASSMENT',
  'IMPERSONATION',
  'PHISHING',
  'OTHER',
] as const;

export const ReachAbuseReportCreateSchema = z.object({
  contractId: z.string().min(1),
  reason: z.enum(REACH_ABUSE_REPORT_REASONS),
  description: z.string().max(1000).optional(),
});

export type ReachAbuseReportCreate = z.infer<typeof ReachAbuseReportCreateSchema>;

/**
 * Submit an abuse report for a Reach contract.
 * The reporter must be either the initiator or target of the contract.
 */
export async function createReachAbuseReport(
  reporterId: string,
  input: ReachAbuseReportCreate,
) {
  const data = ReachAbuseReportCreateSchema.parse(input);

  // Verify contract exists and reporter is a party to it.
  const contract = await db.reachContract.findUnique({
    where: { id: data.contractId },
    select: { id: true, initiatorId: true, targetId: true },
  });

  if (!contract) {
    throw new ReachSafetyError('Contract not found', 'CONTRACT_NOT_FOUND', 404);
  }

  if (contract.initiatorId !== reporterId && contract.targetId !== reporterId) {
    throw new ReachSafetyError(
      'Only contract participants can submit abuse reports',
      'NOT_PARTICIPANT',
      403,
    );
  }

  // Rate limit abuse report submissions.
  await enforceAbuseReportRateLimit(reporterId);

  // Deduplicate: one report per actor per contract.
  const existing = await db.reachAbuseReport.findUnique({
    where: {
      contractId_reporterId: { contractId: data.contractId, reporterId },
    },
    select: { id: true },
  });

  if (existing) {
    throw new ReachSafetyError(
      'You have already reported this contract',
      'ALREADY_REPORTED',
      409,
    );
  }

  return db.reachAbuseReport.create({
    data: {
      contractId: data.contractId,
      reporterId,
      reason: data.reason as ReachAbuseReportReason,
      description: data.description?.trim() || null,
    },
    select: {
      id: true,
      reason: true,
      status: true,
      createdAt: true,
    },
  });
}

/**
 * List abuse reports (for admin review).
 */
export async function listReachAbuseReports(opts?: {
  status?: ReachAbuseReportStatus;
  page?: number;
  pageSize?: number;
}) {
  const page = Math.max(1, opts?.page ?? 1);
  const pageSize = Math.min(100, Math.max(1, opts?.pageSize ?? 20));
  const skip = (page - 1) * pageSize;

  const where = opts?.status ? { status: opts.status } : {};

  const [reports, totalCount] = await Promise.all([
    db.reachAbuseReport.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip,
      take: pageSize,
      include: {
        contract: {
          select: {
            id: true,
            type: true,
            status: true,
            purpose: true,
            initiatorId: true,
            targetId: true,
          },
        },
        reporter: {
          select: { id: true, handle: true, displayName: true, type: true },
        },
      },
    }),
    db.reachAbuseReport.count({ where }),
  ]);

  return {
    reports,
    pagination: {
      page,
      pageSize,
      totalCount,
      totalPages: Math.max(1, Math.ceil(totalCount / pageSize)),
    },
  };
}

/**
 * Update an abuse report's status (admin review).
 */
export const ReachAbuseReportUpdateSchema = z.object({
  reportId: z.string().min(1),
  status: z.enum(['REVIEWED', 'DISMISSED'] as const),
  reviewNote: z.string().max(500).optional(),
});

export async function updateReachAbuseReportStatus(input: z.infer<typeof ReachAbuseReportUpdateSchema>) {
  const data = ReachAbuseReportUpdateSchema.parse(input);

  const existing = await db.reachAbuseReport.findUnique({
    where: { id: data.reportId },
    select: { id: true },
  });

  if (!existing) {
    throw new ReachSafetyError('Report not found', 'REPORT_NOT_FOUND', 404);
  }

  return db.reachAbuseReport.update({
    where: { id: data.reportId },
    data: {
      status: data.status as ReachAbuseReportStatus,
      reviewedAt: new Date(),
      reviewNote: data.reviewNote?.trim() || null,
    },
    select: {
      id: true,
      status: true,
      reviewedAt: true,
      reviewNote: true,
    },
  });
}

// ---------------------------------------------------------------------------
// Repeated-offender detection & automated consequences
// ---------------------------------------------------------------------------

/**
 * Threshold of confirmed (REVIEWED) abuse reports before an actor is
 * auto-suspended. Configurable via env.
 */
const AUTO_SUSPEND_THRESHOLD = Number(process.env.REACH_AUTO_SUSPEND_THRESHOLD ?? 3);

/**
 * Compute an actor's abuse score: count of REVIEWED abuse reports where the
 * actor is the *reported party* (i.e., the other participant who was reported).
 *
 * This is useful for admin dashboards and automated suspension decisions.
 */
export async function getActorAbuseScore(actorId: string): Promise<{
  confirmedReports: number;
  isSuspended: boolean;
  threshold: number;
}> {
  // Find all contracts where this actor is initiator or target,
  // and a confirmed (REVIEWED) abuse report exists filed by the OTHER party.
  const confirmedReports = await db.reachAbuseReport.count({
    where: {
      status: 'REVIEWED',
      // The reporter is NOT this actor — meaning this actor was the offender.
      reporterId: { not: actorId },
      contract: {
        OR: [{ initiatorId: actorId }, { targetId: actorId }],
      },
    },
  });

  const actor = await db.reachActor.findUnique({
    where: { id: actorId },
    select: { isActive: true },
  });

  return {
    confirmedReports,
    isSuspended: !(actor?.isActive ?? true),
    threshold: AUTO_SUSPEND_THRESHOLD,
  };
}

/**
 * Check if an actor should be auto-suspended based on accumulated confirmed
 * abuse reports. If threshold is met, deactivates the actor and cancels
 * in-flight contracts.
 *
 * Called after an abuse report is confirmed (status → REVIEWED).
 *
 * @returns true if the actor was auto-suspended, false otherwise.
 */
export async function checkAndAutoSuspend(offenderActorId: string): Promise<boolean> {
  if (AUTO_SUSPEND_THRESHOLD <= 0) return false;

  const { confirmedReports, isSuspended } = await getActorAbuseScore(offenderActorId);

  if (isSuspended) return false; // already suspended
  if (confirmedReports < AUTO_SUSPEND_THRESHOLD) return false;

  // Import deactivateActorWithCascade lazily to avoid circular dependency.
  const { deactivateActorWithCascade } = await import('./service');

  try {
    await deactivateActorWithCascade(offenderActorId);
    console.warn(
      `[reach:safety] Auto-suspended actor ${offenderActorId} after ${confirmedReports} confirmed abuse reports`,
    );
    return true;
  } catch {
    // Actor may have been deactivated between check and action — not an error.
    return false;
  }
}

/**
 * After confirming an abuse report (status → REVIEWED), auto-block the offending
 * actor so they can't send further contracts to the reporter.
 *
 * The "offender" is the contract participant who is NOT the reporter.
 */
export async function autoBlockOnConfirmedAbuse(
  contractId: string,
  reporterId: string,
): Promise<{ blocked: boolean; offenderId: string | null }> {
  const contract = await db.reachContract.findUnique({
    where: { id: contractId },
    select: { initiatorId: true, targetId: true },
  });

  if (!contract) return { blocked: false, offenderId: null };

  // The offender is whichever participant is NOT the reporter.
  const offenderId =
    contract.initiatorId === reporterId ? contract.targetId : contract.initiatorId;

  // Check if already blocked.
  const alreadyBlocked = await isBlocked(reporterId, offenderId);
  if (alreadyBlocked) return { blocked: false, offenderId };

  // Auto-block.
  await db.reachBlockedActor.upsert({
    where: {
      blockerId_blockedId: { blockerId: reporterId, blockedId: offenderId },
    },
    update: { reason: 'Auto-blocked after confirmed abuse report' },
    create: {
      blockerId: reporterId,
      blockedId: offenderId,
      reason: 'Auto-blocked after confirmed abuse report',
    },
  });

  return { blocked: true, offenderId };
}

/**
 * Enhanced abuse report review: updates status AND triggers automated
 * consequences (auto-block, repeated offender check).
 *
 * This should be used by the admin review API route instead of the bare
 * updateReachAbuseReportStatus.
 */
export async function reviewAbuseReport(input: z.infer<typeof ReachAbuseReportUpdateSchema>) {
  const report = await updateReachAbuseReportStatus(input);

  // Only trigger consequences for confirmed abuse (REVIEWED), not DISMISSED.
  if (input.status === 'REVIEWED') {
    const fullReport = await db.reachAbuseReport.findUnique({
      where: { id: input.reportId },
      select: { contractId: true, reporterId: true },
    });

    if (fullReport) {
      // Auto-block offender from contacting reporter.
      const blockResult = await autoBlockOnConfirmedAbuse(
        fullReport.contractId,
        fullReport.reporterId,
      );

      // Check if offender should be auto-suspended.
      let autoSuspended = false;
      if (blockResult.offenderId) {
        autoSuspended = await checkAndAutoSuspend(blockResult.offenderId);
      }

      return {
        ...report,
        consequences: {
          autoBlocked: blockResult.blocked,
          offenderId: blockResult.offenderId,
          autoSuspended,
        },
      };
    }
  }

  return { ...report, consequences: null };
}

/**
 * List abuse reports scoped to the caller's own contracts.
 * Regular actors can only see reports on contracts they participated in.
 */
export async function listOwnAbuseReports(
  actorId: string,
  opts?: { status?: ReachAbuseReportStatus; page?: number; pageSize?: number },
) {
  const page = Math.max(1, opts?.page ?? 1);
  const pageSize = Math.min(100, Math.max(1, opts?.pageSize ?? 20));
  const skip = (page - 1) * pageSize;

  const where: Record<string, unknown> = {
    contract: {
      OR: [{ initiatorId: actorId }, { targetId: actorId }],
    },
  };
  if (opts?.status) {
    (where as { status?: ReachAbuseReportStatus }).status = opts.status;
  }

  const [reports, totalCount] = await Promise.all([
    db.reachAbuseReport.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip,
      take: pageSize,
      include: {
        contract: {
          select: {
            id: true,
            type: true,
            status: true,
            purpose: true,
            initiatorId: true,
            targetId: true,
          },
        },
        reporter: {
          select: { id: true, handle: true, displayName: true, type: true },
        },
      },
    }),
    db.reachAbuseReport.count({ where }),
  ]);

  return {
    reports,
    pagination: {
      page,
      pageSize,
      totalCount,
      totalPages: Math.max(1, Math.ceil(totalCount / pageSize)),
    },
  };
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

async function enforceAbuseReportRateLimit(reporterId: string): Promise<void> {
  if (ABUSE_REPORT_RATE_LIMIT_MAX <= 0 || ABUSE_REPORT_RATE_LIMIT_WINDOW_MINUTES <= 0) return;

  const since = new Date(
    Date.now() - ABUSE_REPORT_RATE_LIMIT_WINDOW_MINUTES * 60 * 1000,
  );
  const count = await db.reachAbuseReport.count({
    where: {
      reporterId,
      createdAt: { gte: since },
    },
  });

  if (count >= ABUSE_REPORT_RATE_LIMIT_MAX) {
    throw new ReachSafetyError(
      'Too many abuse reports submitted. Try again later.',
      'REPORT_RATE_LIMIT',
      429,
    );
  }
}
