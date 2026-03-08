/**
 * Digest notification aggregation and delivery.
 *
 * Queries all doors where the keeper has opted into digest emails,
 * aggregates pending request counts and recent senders, then sends
 * a single summary email per door. Updates `lastDigestSentAt` to
 * prevent duplicate sends.
 *
 * Uses cursor-based pagination to process all eligible doors (not just
 * the first batch). Notification sends are batched with bounded
 * concurrency to avoid overwhelming the email provider.
 */

import { RequestStatus } from '@prisma/client';
import { db } from '../../../lib/db';
import { notifyKeeperDigest, sendBatch } from '../../../lib/notifications';

const DIGEST_SAMPLE_SENDERS = 5;

export async function sendDigestNotifications(options?: { batchSize?: number }) {
  const batchSize = options?.batchSize ?? 100;
  let totalSent = 0;
  let totalSkipped = 0;
  let cursor: string | undefined;

  // Paginate through all eligible doors using cursor-based pagination
  // eslint-disable-next-line no-constant-condition
  while (true) {
    const doors = await db.door.findMany({
      where: {
        isEnabled: true,
        settings: {
          notifyDigest: true
        }
      },
      select: {
        id: true,
        slug: true,
        displayName: true,
        user: {
          select: { email: true }
        },
        settings: {
          select: {
            lastDigestSentAt: true
          }
        }
      },
      take: batchSize,
      ...(cursor
        ? { skip: 1, cursor: { id: cursor } }
        : {}),
      orderBy: { id: 'asc' }
    });

    if (doors.length === 0) break;

    // Update cursor for next page
    cursor = doors[doors.length - 1].id;

    const { sent, skipped } = await processDigestBatch(doors);
    totalSent += sent;
    totalSkipped += skipped;

    // If we got fewer than batchSize, we've reached the end
    if (doors.length < batchSize) break;
  }

  return { sent: totalSent, skipped: totalSkipped };
}

type DigestDoor = {
  id: string;
  slug: string;
  displayName: string;
  user: { email: string } | null;
  settings: { lastDigestSentAt: Date | null } | null;
};

async function processDigestBatch(doors: DigestDoor[]) {
  // Filter to doors with valid keeper emails
  const eligibleDoors = doors.filter((d) => d.user?.email);
  if (eligibleDoors.length === 0) {
    return { sent: 0, skipped: doors.length };
  }

  const doorIds = eligibleDoors.map((d) => d.id);

  // Batch query: pending counts per door (single query instead of N)
  const pendingCounts = await db.request.groupBy({
    by: ['doorId'],
    where: {
      doorId: { in: doorIds },
      status: RequestStatus.PENDING
    },
    _count: { id: true }
  });
  const pendingByDoor = new Map(pendingCounts.map((r) => [r.doorId, r._count.id]));

  // Batch query: new request counts per door since their respective lastDigestSentAt
  // We need per-door cutoff dates, so use a raw query for efficiency
  const oldestSince = eligibleDoors.reduce((oldest, d) => {
    const since = d.settings?.lastDigestSentAt ?? new Date(0);
    return since < oldest ? since : oldest;
  }, new Date());

  // Get all new requests since the oldest digest timestamp, then group in JS
  const recentRequests = await db.request.findMany({
    where: {
      doorId: { in: doorIds },
      createdAt: { gt: oldestSince }
    },
    select: {
      doorId: true,
      createdAt: true,
      senderName: true,
      senderEmail: true
    },
    orderBy: { createdAt: 'desc' }
  });

  // Build per-door new counts and sample senders
  const doorSinceMap = new Map(
    eligibleDoors.map((d) => [d.id, d.settings?.lastDigestSentAt ?? new Date(0)])
  );

  const newCountByDoor = new Map<string, number>();
  const sendersByDoor = new Map<string, string[]>();

  for (const req of recentRequests) {
    const since = doorSinceMap.get(req.doorId);
    if (!since || req.createdAt <= since) continue;

    newCountByDoor.set(req.doorId, (newCountByDoor.get(req.doorId) ?? 0) + 1);

    const senderName = req.senderName ?? req.senderEmail;
    if (senderName) {
      const existing = sendersByDoor.get(req.doorId) ?? [];
      if (existing.length < DIGEST_SAMPLE_SENDERS) {
        existing.push(senderName);
        sendersByDoor.set(req.doorId, existing);
      }
    }
  }

  let skipped = doors.length - eligibleDoors.length;

  // Build send tasks for doors that have new content
  const sendTasks: Array<{ door: DigestDoor; task: () => Promise<void> }> = [];

  for (const door of eligibleDoors) {
    const newCount = newCountByDoor.get(door.id) ?? 0;
    if (newCount === 0) {
      skipped++;
      continue;
    }

    const pendingCount = pendingByDoor.get(door.id) ?? 0;
    if (pendingCount === 0) {
      skipped++;
      continue;
    }

    const sampleSenders = sendersByDoor.get(door.id) ?? [];

    sendTasks.push({
      door,
      task: async () => {
        await notifyKeeperDigest({
          keeperEmail: door.user!.email,
          doorName: door.displayName,
          doorSlug: door.slug,
          pendingCount,
          newSinceLastDigest: newCount,
          sampleSenders
        });

        // Update lastDigestSentAt after successful send
        await db.doorSettings.update({
          where: { doorId: door.id },
          data: { lastDigestSentAt: new Date() }
        });
      }
    });
  }

  if (sendTasks.length === 0) {
    return { sent: 0, skipped };
  }

  // Send with bounded concurrency
  const result = await sendBatch(
    sendTasks.map((t) => t.task),
    5
  );

  // Tasks that failed in sendBatch are counted as skipped
  return {
    sent: result.succeeded,
    skipped: skipped + result.failed
  };
}
