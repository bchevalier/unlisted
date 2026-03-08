/**
 * Digest notification aggregation and delivery.
 *
 * Queries all doors where the keeper has opted into digest emails,
 * aggregates pending request counts and recent senders, then sends
 * a single summary email per door. Updates `lastDigestSentAt` to
 * prevent duplicate sends.
 */

import { RequestStatus } from '@prisma/client';
import { db } from '../../../lib/db';
import { notifyKeeperDigest } from '../../../lib/notifications';

const DIGEST_SAMPLE_SENDERS = 5;

export async function sendDigestNotifications(options?: { batchSize?: number }) {
  const batchSize = options?.batchSize ?? 100;

  // Find all doors with digest enabled
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
    take: batchSize
  });

  if (doors.length === 0) {
    return { sent: 0, skipped: 0 };
  }

  let sent = 0;
  let skipped = 0;

  for (const door of doors) {
    if (!door.user?.email) {
      skipped++;
      continue;
    }

    const since = door.settings?.lastDigestSentAt ?? new Date(0);

    // Count new requests since last digest
    const newCount = await db.request.count({
      where: {
        doorId: door.id,
        createdAt: { gt: since }
      }
    });

    // Skip if nothing new
    if (newCount === 0) {
      skipped++;
      continue;
    }

    // Total pending count
    const pendingCount = await db.request.count({
      where: {
        doorId: door.id,
        status: RequestStatus.PENDING
      }
    });

    // Skip if no pending requests (all may have been handled already)
    if (pendingCount === 0) {
      skipped++;
      continue;
    }

    // Sample recent senders for context
    const recentRequests = await db.request.findMany({
      where: {
        doorId: door.id,
        createdAt: { gt: since },
        senderName: { not: null }
      },
      orderBy: { createdAt: 'desc' },
      take: DIGEST_SAMPLE_SENDERS,
      select: {
        senderName: true,
        senderEmail: true
      }
    });

    const sampleSenders = recentRequests
      .map((r) => r.senderName ?? r.senderEmail)
      .filter((name): name is string => name !== null);

    try {
      await notifyKeeperDigest({
        keeperEmail: door.user.email,
        doorName: door.displayName,
        doorSlug: door.slug,
        pendingCount,
        newSinceLastDigest: newCount,
        sampleSenders
      });

      // Update lastDigestSentAt
      await db.doorSettings.update({
        where: { doorId: door.id },
        data: { lastDigestSentAt: new Date() }
      });

      sent++;
    } catch (error) {
      console.error(`[digest:send-failed] door=${door.slug}`, error);
      skipped++;
    }
  }

  return { sent, skipped };
}
