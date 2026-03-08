import crypto from 'node:crypto';
import { AbuseReportReason, AbuseReportStatus } from '@prisma/client';
import { z } from 'zod';
import { db } from '../../../lib/db';

// ---------------------------------------------------------------------------
// Validation schemas
// ---------------------------------------------------------------------------

const createAbuseReportSchema = z.object({
  requestToken: z.string().trim().min(1),
  reason: z.enum([
    AbuseReportReason.SPAM,
    AbuseReportReason.HARASSMENT,
    AbuseReportReason.IMPERSONATION,
    AbuseReportReason.PHISHING,
    AbuseReportReason.OTHER
  ]),
  description: z.string().trim().max(1000).optional()
});

// ---------------------------------------------------------------------------
// Rate limiting — prevent report spam from one IP
// ---------------------------------------------------------------------------

const REPORT_IP_RATE_LIMIT_WINDOW_MINUTES = 60;
const REPORT_IP_RATE_LIMIT_MAX = 5;

function hashForRateLimit(value: string): string {
  return crypto.createHash('sha256').update(value).digest('hex');
}

async function enforceReportIPRateLimit(ipHash: string) {
  const windowMinutes = Number(
    process.env.REPORT_IP_RATE_LIMIT_WINDOW_MINUTES ?? REPORT_IP_RATE_LIMIT_WINDOW_MINUTES
  );
  const maxReports = Number(
    process.env.REPORT_IP_RATE_LIMIT_MAX ?? REPORT_IP_RATE_LIMIT_MAX
  );

  if (Number.isNaN(windowMinutes) || Number.isNaN(maxReports) || windowMinutes <= 0 || maxReports <= 0) {
    return;
  }

  const since = new Date(Date.now() - windowMinutes * 60 * 1000);
  const count = await db.abuseReport.count({
    where: {
      ipHash,
      createdAt: { gte: since }
    }
  });

  if (count >= maxReports) {
    throw new AbuseReportError('Too many reports submitted. Try again later.', 429);
  }
}

// Prevent duplicate reports on the same request from the same IP
async function enforceNoDuplicateReport(requestId: string, ipHash: string) {
  const existing = await db.abuseReport.findFirst({
    where: {
      requestId,
      ipHash
    },
    select: { id: true }
  });

  if (existing) {
    throw new AbuseReportError('You have already reported this request.', 409);
  }
}

// ---------------------------------------------------------------------------
// Error type
// ---------------------------------------------------------------------------

export class AbuseReportError extends Error {
  readonly statusCode: number;

  constructor(message: string, statusCode = 400) {
    super(message);
    this.statusCode = statusCode;
  }
}

// ---------------------------------------------------------------------------
// Public: create an abuse report from a knocker/viewer
// ---------------------------------------------------------------------------

export async function createAbuseReport(
  input: unknown,
  options?: { ipAddress?: string | null }
) {
  const payload = createAbuseReportSchema.parse(input);

  // Look up the request by its public token
  const request = await db.request.findUnique({
    where: { requestToken: payload.requestToken },
    select: {
      id: true,
      doorId: true
    }
  });

  if (!request) {
    throw new AbuseReportError('Request not found');
  }

  const ipHash = options?.ipAddress ? hashForRateLimit(options.ipAddress) : null;

  // Rate limit + dedup
  if (ipHash) {
    await enforceReportIPRateLimit(ipHash);
    await enforceNoDuplicateReport(request.id, ipHash);
  }

  const report = await db.abuseReport.create({
    data: {
      requestId: request.id,
      doorId: request.doorId,
      reason: payload.reason,
      description: payload.description?.trim() || null,
      ipHash,
      status: AbuseReportStatus.OPEN
    },
    select: {
      id: true,
      reason: true,
      status: true,
      createdAt: true
    }
  });

  return report;
}

// ---------------------------------------------------------------------------
// Admin: list abuse reports (for future admin tools)
// ---------------------------------------------------------------------------

export async function listAbuseReports(options?: {
  status?: AbuseReportStatus;
  page?: number;
  pageSize?: number;
}) {
  const page = Math.max(1, options?.page ?? 1);
  const pageSize = Math.min(100, Math.max(1, options?.pageSize ?? 20));
  const skip = (page - 1) * pageSize;

  const statusFilter = options?.status ? { status: options.status } : {};

  const [reports, totalCount] = await Promise.all([
    db.abuseReport.findMany({
      where: statusFilter,
      orderBy: { createdAt: 'desc' },
      skip,
      take: pageSize,
      select: {
        id: true,
        reason: true,
        description: true,
        status: true,
        createdAt: true,
        reviewedAt: true,
        reviewNote: true,
        request: {
          select: {
            id: true,
            requestToken: true,
            senderEmail: true,
            title: true,
            status: true
          }
        },
        door: {
          select: {
            slug: true,
            displayName: true
          }
        }
      }
    }),
    db.abuseReport.count({ where: statusFilter })
  ]);

  return {
    reports,
    pagination: {
      page,
      pageSize,
      totalCount,
      totalPages: Math.max(1, Math.ceil(totalCount / pageSize))
    }
  };
}

// ---------------------------------------------------------------------------
// Admin: update report status (review/dismiss)
// ---------------------------------------------------------------------------

const updateReportStatusSchema = z.object({
  reportId: z.string().trim().min(1),
  status: z.enum([AbuseReportStatus.REVIEWED, AbuseReportStatus.DISMISSED]),
  reviewNote: z.string().trim().max(500).optional()
});

export async function updateAbuseReportStatus(input: unknown) {
  const payload = updateReportStatusSchema.parse(input);

  const existing = await db.abuseReport.findUnique({
    where: { id: payload.reportId },
    select: { id: true, status: true }
  });

  if (!existing) {
    throw new AbuseReportError('Report not found');
  }

  return db.abuseReport.update({
    where: { id: payload.reportId },
    data: {
      status: payload.status,
      reviewedAt: new Date(),
      reviewNote: payload.reviewNote?.trim() || null
    },
    select: {
      id: true,
      status: true,
      reviewedAt: true,
      reviewNote: true
    }
  });
}
