// @ts-nocheck
import { RequestStatus } from '@prisma/client';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const {
  userFindMany,
  userCount,
  userFindUnique,
  userUpdate,
  doorFindMany,
  doorCount,
  doorUpdate,
  doorUpdateMany,
  requestFindMany,
  requestCount,
  requestFindUnique,
  requestDelete,
  requestDeleteMany,
  abuseReportFindMany,
  abuseReportCount,
  transaction,
} = vi.hoisted(() => {
  const userFindMany = vi.fn();
  const userCount = vi.fn();
  const userFindUnique = vi.fn();
  const userUpdate = vi.fn();
  const doorFindMany = vi.fn();
  const doorCount = vi.fn();
  const doorUpdate = vi.fn();
  const doorUpdateMany = vi.fn();
  const requestFindMany = vi.fn();
  const requestCount = vi.fn();
  const requestFindUnique = vi.fn();
  const requestDelete = vi.fn();
  const requestDeleteMany = vi.fn();
  const abuseReportFindMany = vi.fn();
  const abuseReportCount = vi.fn();
  const transaction = vi.fn(async (callback) =>
    callback({
      door: { updateMany: doorUpdateMany },
      user: { update: userUpdate },
    })
  );

  return {
    userFindMany,
    userCount,
    userFindUnique,
    userUpdate,
    doorFindMany,
    doorCount,
    doorUpdate,
    doorUpdateMany,
    requestFindMany,
    requestCount,
    requestFindUnique,
    requestDelete,
    requestDeleteMany,
    abuseReportFindMany,
    abuseReportCount,
    transaction,
  };
});

vi.mock('../../../lib/db', () => ({
  db: {
    user: {
      findMany: userFindMany,
      count: userCount,
      findUnique: userFindUnique,
      update: userUpdate,
    },
    door: {
      findMany: doorFindMany,
      count: doorCount,
      update: doorUpdate,
      updateMany: doorUpdateMany,
    },
    request: {
      findMany: requestFindMany,
      count: requestCount,
      findUnique: requestFindUnique,
      delete: requestDelete,
      deleteMany: requestDeleteMany,
    },
    abuseReport: {
      findMany: abuseReportFindMany,
      count: abuseReportCount,
    },
    $transaction: transaction,
  },
}));

import {
  deleteRequests,
  disableUser,
  enableUser,
  getDashboardStats,
  listAbuseReports,
  listRequests,
  listUsers,
  suspendDoor,
  unsuspendDoor,
} from './admin';

describe('admin helpers', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    userFindMany.mockResolvedValue([]);
    userCount.mockResolvedValue(0);
    doorFindMany.mockResolvedValue([]);
    doorCount.mockResolvedValue(0);
    requestFindMany.mockResolvedValue([]);
    requestCount.mockResolvedValue(0);
    abuseReportFindMany.mockResolvedValue([]);
    abuseReportCount.mockResolvedValue(0);
    doorUpdate.mockResolvedValue({ id: 'door_1', slug: 'john', isEnabled: false });
    userUpdate.mockResolvedValue({ id: 'user_1', email: 'john@example.com' });
    requestDeleteMany.mockResolvedValue({ count: 2 });
  });

  it('lists users with bounded pagination and search filters', async () => {
    userFindMany.mockResolvedValue([{ id: 'user_1', email: 'john@example.com' }]);
    userCount.mockResolvedValue(2);

    const result = await listUsers({ page: 0, pageSize: 500, search: 'john' });

    expect(result).toEqual({
      users: [{ id: 'user_1', email: 'john@example.com' }],
      pagination: {
        page: 1,
        pageSize: 100,
        totalCount: 2,
        totalPages: 1,
      },
    });
    expect(userFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          OR: [
            { email: { contains: 'john', mode: 'insensitive' } },
            { name: { contains: 'john', mode: 'insensitive' } },
          ],
        },
        orderBy: { createdAt: 'desc' },
        skip: 0,
        take: 100,
      })
    );
    expect(userCount).toHaveBeenCalledWith({
      where: {
        OR: [
          { email: { contains: 'john', mode: 'insensitive' } },
          { name: { contains: 'john', mode: 'insensitive' } },
        ],
      },
    });
  });

  it('lists requests with status, door, and search filters', async () => {
    requestFindMany.mockResolvedValue([{ id: 'req_1', status: RequestStatus.PENDING }]);
    requestCount.mockResolvedValue(3);

    const result = await listRequests({
      page: 2,
      pageSize: 10,
      status: RequestStatus.PENDING,
      doorId: 'door_1',
      search: 'maya',
    });

    expect(result).toEqual({
      requests: [{ id: 'req_1', status: RequestStatus.PENDING }],
      pagination: {
        page: 2,
        pageSize: 10,
        totalCount: 3,
        totalPages: 1,
      },
    });
    expect(requestFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          status: RequestStatus.PENDING,
          doorId: 'door_1',
          OR: [
            { title: { contains: 'maya', mode: 'insensitive' } },
            { message: { contains: 'maya', mode: 'insensitive' } },
            { senderEmail: { contains: 'maya', mode: 'insensitive' } },
            { senderName: { contains: 'maya', mode: 'insensitive' } },
          ],
        },
        orderBy: { createdAt: 'desc' },
        skip: 10,
        take: 10,
      })
    );
    expect(requestCount).toHaveBeenCalledWith({
      where: {
        status: RequestStatus.PENDING,
        doorId: 'door_1',
        OR: [
          { title: { contains: 'maya', mode: 'insensitive' } },
          { message: { contains: 'maya', mode: 'insensitive' } },
          { senderEmail: { contains: 'maya', mode: 'insensitive' } },
          { senderName: { contains: 'maya', mode: 'insensitive' } },
        ],
      },
    });
  });

  it('disables a user by disabling all doors and clearing email verification in one transaction', async () => {
    const result = await disableUser('user_1');

    expect(result).toEqual({ id: 'user_1', email: 'john@example.com' });
    expect(transaction).toHaveBeenCalledOnce();
    expect(doorUpdateMany).toHaveBeenCalledWith({
      where: { userId: 'user_1' },
      data: { isEnabled: false },
    });
    expect(userUpdate).toHaveBeenCalledWith({
      where: { id: 'user_1' },
      data: { emailVerifiedAt: null },
      select: { id: true, email: true },
    });
  });

  it('enables a user by re-enabling all doors and stamping verification in one transaction', async () => {
    const result = await enableUser('user_1');

    expect(result).toEqual({ id: 'user_1', email: 'john@example.com' });
    expect(transaction).toHaveBeenCalledOnce();
    expect(doorUpdateMany).toHaveBeenCalledWith({
      where: { userId: 'user_1' },
      data: { isEnabled: true },
    });
    expect(userUpdate).toHaveBeenCalledWith({
      where: { id: 'user_1' },
      data: { emailVerifiedAt: expect.any(Date) },
      select: { id: true, email: true },
    });
  });

  it('supports suspend/unsuspend and avoids deleteMany when no request ids are provided', async () => {
    doorUpdate
      .mockResolvedValueOnce({ id: 'door_1', slug: 'john', isEnabled: false })
      .mockResolvedValueOnce({ id: 'door_1', slug: 'john', isEnabled: true });

    await expect(suspendDoor('door_1')).resolves.toEqual({ id: 'door_1', slug: 'john', isEnabled: false });
    await expect(unsuspendDoor('door_1')).resolves.toEqual({ id: 'door_1', slug: 'john', isEnabled: true });
    await expect(deleteRequests([])).resolves.toEqual({ count: 0 });

    expect(doorUpdate).toHaveBeenNthCalledWith(1, {
      where: { id: 'door_1' },
      data: { isEnabled: false },
      select: { id: true, slug: true, isEnabled: true },
    });
    expect(doorUpdate).toHaveBeenNthCalledWith(2, {
      where: { id: 'door_1' },
      data: { isEnabled: true },
      select: { id: true, slug: true, isEnabled: true },
    });
    expect(requestDeleteMany).not.toHaveBeenCalled();
  });

  it('lists abuse reports with status filters and aggregates dashboard stats from the main counters', async () => {
    abuseReportFindMany.mockResolvedValue([{ id: 'report_1', status: 'OPEN' }]);
    abuseReportCount.mockResolvedValueOnce(1).mockResolvedValueOnce(4);
    userCount.mockResolvedValueOnce(10);
    doorCount.mockResolvedValueOnce(6);
    requestCount.mockResolvedValueOnce(18).mockResolvedValueOnce(5);

    const reports = await listAbuseReports({ page: 2, pageSize: 10, status: 'OPEN' });
    const stats = await getDashboardStats();

    expect(reports).toEqual({
      reports: [{ id: 'report_1', status: 'OPEN' }],
      pagination: {
        page: 2,
        pageSize: 10,
        totalCount: 1,
        totalPages: 1,
      },
    });
    expect(abuseReportFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { status: 'OPEN' },
        orderBy: { createdAt: 'desc' },
        skip: 10,
        take: 10,
      })
    );
    expect(stats).toEqual({
      totalUsers: 10,
      totalDoors: 6,
      totalRequests: 18,
      pendingRequests: 5,
      openAbuseReports: 4,
    });
    expect(userCount).toHaveBeenCalledWith();
    expect(doorCount).toHaveBeenCalledWith();
    expect(requestCount).toHaveBeenNthCalledWith(1);
    expect(requestCount).toHaveBeenNthCalledWith(2, { where: { status: 'PENDING' } });
    expect(abuseReportCount).toHaveBeenNthCalledWith(2, { where: { status: 'OPEN' } });
  });
});
