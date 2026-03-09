/**
 * Admin service layer — read/write operations for the admin dashboard.
 *
 * All functions assume the caller has already been authenticated as an admin.
 */

import { RequestStatus } from '@prisma/client';
import { db } from '../../../lib/db';

// ---------------------------------------------------------------------------
// Users
// ---------------------------------------------------------------------------

type ListUsersOptions = {
  page?: number;
  pageSize?: number;
  search?: string;
};

export async function listUsers(opts: ListUsersOptions = {}) {
  const page = Math.max(1, opts.page ?? 1);
  const pageSize = Math.min(100, Math.max(1, opts.pageSize ?? 25));
  const skip = (page - 1) * pageSize;

  const where = opts.search
    ? {
        OR: [
          { email: { contains: opts.search, mode: 'insensitive' as const } },
          { name: { contains: opts.search, mode: 'insensitive' as const } },
        ],
      }
    : {};

  const [users, totalCount] = await Promise.all([
    db.user.findMany({
      where,
      select: {
        id: true,
        email: true,
        name: true,
        emailVerifiedAt: true,
        twoFactorEnabled: true,
        createdAt: true,
        door: {
          select: {
            id: true,
            slug: true,
            displayName: true,
            plan: true,
            isEnabled: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      skip,
      take: pageSize,
    }),
    db.user.count({ where }),
  ]);

  return {
    users,
    pagination: {
      page,
      pageSize,
      totalCount,
      totalPages: Math.ceil(totalCount / pageSize),
    },
  };
}

export async function getUserDetail(userId: string) {
  return db.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      email: true,
      name: true,
      emailVerifiedAt: true,
      twoFactorEnabled: true,
      stripeCustomerId: true,
      createdAt: true,
      updatedAt: true,
      door: {
        select: {
          id: true,
          slug: true,
          displayName: true,
          plan: true,
          isEnabled: true,
          createdAt: true,
          settings: {
            select: {
              weeklyRequestCap: true,
              revealMethod: true,
              autoReplyEnabled: true,
              notifyNewRequest: true,
              notifyDigest: true,
            },
          },
          _count: {
            select: {
              requests: true,
              categories: true,
              blockedSenders: true,
            },
          },
        },
      },
      identities: {
        select: {
          provider: true,
          providerEmail: true,
          createdAt: true,
        },
      },
    },
  });
}

// ---------------------------------------------------------------------------
// Doors
// ---------------------------------------------------------------------------

type ListDoorsOptions = {
  page?: number;
  pageSize?: number;
  search?: string;
};

export async function listDoors(opts: ListDoorsOptions = {}) {
  const page = Math.max(1, opts.page ?? 1);
  const pageSize = Math.min(100, Math.max(1, opts.pageSize ?? 25));
  const skip = (page - 1) * pageSize;

  const where = opts.search
    ? {
        OR: [
          { slug: { contains: opts.search, mode: 'insensitive' as const } },
          { displayName: { contains: opts.search, mode: 'insensitive' as const } },
          { user: { email: { contains: opts.search, mode: 'insensitive' as const } } },
        ],
      }
    : {};

  const [doors, totalCount] = await Promise.all([
    db.door.findMany({
      where,
      select: {
        id: true,
        slug: true,
        displayName: true,
        plan: true,
        isEnabled: true,
        createdAt: true,
        user: {
          select: { id: true, email: true, name: true },
        },
        _count: {
          select: { requests: true },
        },
      },
      orderBy: { createdAt: 'desc' },
      skip,
      take: pageSize,
    }),
    db.door.count({ where }),
  ]);

  return {
    doors,
    pagination: {
      page,
      pageSize,
      totalCount,
      totalPages: Math.ceil(totalCount / pageSize),
    },
  };
}

// ---------------------------------------------------------------------------
// Requests
// ---------------------------------------------------------------------------

type ListRequestsOptions = {
  page?: number;
  pageSize?: number;
  status?: RequestStatus;
  doorId?: string;
  search?: string;
};

export async function listRequests(opts: ListRequestsOptions = {}) {
  const page = Math.max(1, opts.page ?? 1);
  const pageSize = Math.min(100, Math.max(1, opts.pageSize ?? 25));
  const skip = (page - 1) * pageSize;

  const where: Record<string, unknown> = {};
  if (opts.status) where.status = opts.status;
  if (opts.doorId) where.doorId = opts.doorId;
  if (opts.search) {
    where.OR = [
      { title: { contains: opts.search, mode: 'insensitive' } },
      { message: { contains: opts.search, mode: 'insensitive' } },
      { senderEmail: { contains: opts.search, mode: 'insensitive' } },
      { senderName: { contains: opts.search, mode: 'insensitive' } },
    ];
  }

  const [requests, totalCount] = await Promise.all([
    db.request.findMany({
      where,
      select: {
        id: true,
        title: true,
        message: true,
        status: true,
        source: true,
        senderName: true,
        senderEmail: true,
        ipHash: true,
        createdAt: true,
        door: {
          select: { slug: true, displayName: true },
        },
        category: {
          select: { key: true, label: true },
        },
      },
      orderBy: { createdAt: 'desc' },
      skip,
      take: pageSize,
    }),
    db.request.count({ where }),
  ]);

  return {
    requests,
    pagination: {
      page,
      pageSize,
      totalCount,
      totalPages: Math.ceil(totalCount / pageSize),
    },
  };
}

export async function getRequestDetail(requestId: string) {
  return db.request.findUnique({
    where: { id: requestId },
    select: {
      id: true,
      title: true,
      message: true,
      status: true,
      source: true,
      senderName: true,
      senderEmail: true,
      ipHash: true,
      structuredData: true,
      requestToken: true,
      completionToken: true,
      completionExpiresAt: true,
      createdAt: true,
      updatedAt: true,
      door: {
        select: {
          id: true,
          slug: true,
          displayName: true,
          user: { select: { id: true, email: true } },
        },
      },
      category: {
        select: { key: true, label: true },
      },
      events: {
        select: {
          id: true,
          type: true,
          actor: true,
          note: true,
          metadata: true,
          createdAt: true,
        },
        orderBy: { createdAt: 'asc' },
      },
      abuseReports: {
        select: {
          id: true,
          reason: true,
          description: true,
          status: true,
          reporterEmail: true,
          createdAt: true,
        },
        orderBy: { createdAt: 'desc' },
      },
    },
  });
}

// ---------------------------------------------------------------------------
// Admin actions
// ---------------------------------------------------------------------------

export async function suspendDoor(doorId: string) {
  return db.door.update({
    where: { id: doorId },
    data: { isEnabled: false },
    select: { id: true, slug: true, isEnabled: true },
  });
}

export async function unsuspendDoor(doorId: string) {
  return db.door.update({
    where: { id: doorId },
    data: { isEnabled: true },
    select: { id: true, slug: true, isEnabled: true },
  });
}

export async function disableUser(userId: string) {
  // Disable the user's door and remove their session secret (force logout).
  // For MVP, "disabling" means disabling the door + setting emailVerifiedAt to null
  // so they cannot log in again (login requires verified email).
  return db.$transaction(async (tx) => {
    await tx.door.updateMany({
      where: { userId },
      data: { isEnabled: false },
    });

    const user = await tx.user.update({
      where: { id: userId },
      data: { emailVerifiedAt: null },
      select: { id: true, email: true },
    });

    return user;
  });
}

export async function enableUser(userId: string) {
  return db.$transaction(async (tx) => {
    await tx.door.updateMany({
      where: { userId },
      data: { isEnabled: true },
    });

    const user = await tx.user.update({
      where: { id: userId },
      data: { emailVerifiedAt: new Date() },
      select: { id: true, email: true },
    });

    return user;
  });
}

export async function deleteRequest(requestId: string) {
  // Hard-delete the request and all associated events/reports
  return db.request.delete({
    where: { id: requestId },
    select: { id: true },
  });
}

export async function deleteRequests(requestIds: string[]) {
  if (requestIds.length === 0) return { count: 0 };
  return db.request.deleteMany({
    where: { id: { in: requestIds } },
  });
}

// ---------------------------------------------------------------------------
// Abuse reports (admin review)
// ---------------------------------------------------------------------------

export async function listAbuseReports(opts: { page?: number; pageSize?: number; status?: string } = {}) {
  const page = Math.max(1, opts.page ?? 1);
  const pageSize = Math.min(100, Math.max(1, opts.pageSize ?? 25));
  const skip = (page - 1) * pageSize;

  const where = opts.status ? { status: opts.status as 'OPEN' | 'REVIEWED' | 'DISMISSED' } : {};

  const [reports, totalCount] = await Promise.all([
    db.abuseReport.findMany({
      where,
      select: {
        id: true,
        reason: true,
        description: true,
        status: true,
        reporterEmail: true,
        reviewNote: true,
        createdAt: true,
        reviewedAt: true,
        request: {
          select: { id: true, title: true, status: true },
        },
        door: {
          select: { id: true, slug: true },
        },
      },
      orderBy: { createdAt: 'desc' },
      skip,
      take: pageSize,
    }),
    db.abuseReport.count({ where }),
  ]);

  return {
    reports,
    pagination: {
      page,
      pageSize,
      totalCount,
      totalPages: Math.ceil(totalCount / pageSize),
    },
  };
}

// ---------------------------------------------------------------------------
// Dashboard stats
// ---------------------------------------------------------------------------

export async function getDashboardStats() {
  const [
    totalUsers,
    totalDoors,
    totalRequests,
    pendingRequests,
    openAbuseReports,
  ] = await Promise.all([
    db.user.count(),
    db.door.count(),
    db.request.count(),
    db.request.count({ where: { status: 'PENDING' } }),
    db.abuseReport.count({ where: { status: 'OPEN' } }),
  ]);

  return {
    totalUsers,
    totalDoors,
    totalRequests,
    pendingRequests,
    openAbuseReports,
  };
}
