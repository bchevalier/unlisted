import { beforeEach, describe, expect, it, vi } from 'vitest';

const { dbMock } = vi.hoisted(() => ({
  dbMock: {
    request: { findUnique: vi.fn() },
    abuseReport: {
      count: vi.fn(),
      findFirst: vi.fn(),
      create: vi.fn(),
      findMany: vi.fn(),
      findUnique: vi.fn(),
      update: vi.fn(),
    },
  },
}));

vi.mock('../../../lib/db', () => ({ db: dbMock }));

import { AbuseReportError, createAbuseReport, listAbuseReports, updateAbuseReportStatus } from './abuse-reports';

describe('abuse-report helpers', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    dbMock.request.findUnique.mockResolvedValue({ id: 'req_1', doorId: 'door_1' });
    dbMock.abuseReport.count.mockResolvedValue(0);
    dbMock.abuseReport.findFirst.mockResolvedValue(null);
    dbMock.abuseReport.create.mockResolvedValue({ id: 'report_1', reason: 'SPAM', status: 'OPEN', createdAt: new Date() });
    dbMock.abuseReport.findMany.mockResolvedValue([]);
    dbMock.abuseReport.findUnique.mockResolvedValue({ id: 'report_1', status: 'OPEN' });
    dbMock.abuseReport.update.mockResolvedValue({ id: 'report_1', status: 'REVIEWED', reviewedAt: new Date(), reviewNote: 'Handled' });
  });

  it('creates an abuse report with rate-limit and dedupe checks for the reporter ip', async () => {
    const report = await createAbuseReport(
      { requestToken: 'req_token_123', reason: 'SPAM' },
      { ipAddress: '198.51.100.2' }
    );

    expect(report).toMatchObject({ id: 'report_1', reason: 'SPAM', status: 'OPEN' });
    expect(dbMock.request.findUnique).toHaveBeenCalledWith({
      where: { requestToken: 'req_token_123' },
      select: { id: true, doorId: true },
    });
    expect(dbMock.abuseReport.create).toHaveBeenCalled();
  });

  it('rejects duplicate abuse reports from the same ip', async () => {
    dbMock.abuseReport.findFirst.mockResolvedValue({ id: 'report_existing' });

    await expect(
      createAbuseReport({ requestToken: 'req_token_123', reason: 'SPAM' }, { ipAddress: '198.51.100.2' })
    ).rejects.toThrow(/already reported/);
  });

  it('lists abuse reports with pagination metadata', async () => {
    dbMock.abuseReport.findMany.mockResolvedValue([{ id: 'report_1' }]);
    dbMock.abuseReport.count.mockResolvedValue(1);

    const result = await listAbuseReports({ status: 'OPEN', page: 2, pageSize: 10 });

    expect(result.pagination).toMatchObject({ page: 2, pageSize: 10, totalCount: 1, totalPages: 1 });
    expect(result.reports).toEqual([{ id: 'report_1' }]);
  });

  it('updates abuse report review status and rejects missing reports', async () => {
    const updated = await updateAbuseReportStatus({ reportId: 'report_1', status: 'REVIEWED', reviewNote: 'Handled' });
    expect(updated).toMatchObject({ id: 'report_1', status: 'REVIEWED' });

    dbMock.abuseReport.findUnique.mockResolvedValueOnce(null);
    await expect(updateAbuseReportStatus({ reportId: 'missing', status: 'DISMISSED' })).rejects.toThrow(AbuseReportError);
  });
});
