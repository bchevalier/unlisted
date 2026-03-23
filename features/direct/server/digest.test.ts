import { beforeEach, describe, expect, it, vi } from 'vitest';

const { dbMock, notifyKeeperDigestMock, sendBatchMock } = vi.hoisted(() => ({
  dbMock: {
    door: { findMany: vi.fn() },
    request: { groupBy: vi.fn(), findMany: vi.fn() },
    doorSettings: { update: vi.fn() },
  },
  notifyKeeperDigestMock: vi.fn(),
  sendBatchMock: vi.fn(),
}));

vi.mock('../../../lib/db', () => ({ db: dbMock }));
vi.mock('../../../lib/notifications', () => ({
  notifyKeeperDigest: notifyKeeperDigestMock,
  sendBatch: sendBatchMock,
}));

import { sendDigestNotifications } from './digest';

describe('digest helpers', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    dbMock.door.findMany.mockResolvedValue([]);
    dbMock.request.groupBy.mockResolvedValue([]);
    dbMock.request.findMany.mockResolvedValue([]);
    dbMock.doorSettings.update.mockResolvedValue(undefined);
    sendBatchMock.mockImplementation(async (tasks: Array<() => Promise<void>>) => {
      for (const task of tasks) await task();
      return { succeeded: tasks.length, failed: 0 };
    });
  });

  it('returns zero sent/skipped when no digest-enabled doors exist', async () => {
    const result = await sendDigestNotifications();

    expect(result).toEqual({ sent: 0, skipped: 0 });
    expect(dbMock.request.groupBy).not.toHaveBeenCalled();
  });

  it('sends digest notifications for eligible doors with new pending requests', async () => {
    dbMock.door.findMany
      .mockResolvedValueOnce([
        {
          id: 'door_1',
          slug: 'john',
          displayName: 'John',
          user: { email: 'john@example.com' },
          settings: { lastDigestSentAt: new Date('2026-03-23T00:00:00.000Z') },
        },
      ])
      .mockResolvedValueOnce([]);
    dbMock.request.groupBy.mockResolvedValue([{ doorId: 'door_1', _count: { id: 2 } }]);
    dbMock.request.findMany.mockResolvedValue([
      {
        doorId: 'door_1',
        createdAt: new Date('2026-03-23T01:00:00.000Z'),
        senderName: 'Maya Chen',
        senderEmail: 'maya@example.com',
      },
    ]);

    const result = await sendDigestNotifications({ batchSize: 10 });

    expect(result).toEqual({ sent: 1, skipped: 0 });
    expect(notifyKeeperDigestMock).toHaveBeenCalledWith({
      keeperEmail: 'john@example.com',
      doorName: 'John',
      doorSlug: 'john',
      pendingCount: 2,
      newSinceLastDigest: 1,
      sampleSenders: ['Maya Chen'],
    });
    expect(dbMock.doorSettings.update).toHaveBeenCalledWith({
      where: { doorId: 'door_1' },
      data: { lastDigestSentAt: expect.any(Date) },
    });
  });
});
