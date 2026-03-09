import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import dns from 'node:dns/promises';
import { checkDeliverability, type DeliverabilityReport } from './email-deliverability';

// Mock dns module
vi.mock('node:dns/promises', () => ({
  default: {
    resolveMx: vi.fn(),
    resolveTxt: vi.fn(),
    resolveCname: vi.fn(),
  },
}));

const mockDns = dns as unknown as {
  resolveMx: ReturnType<typeof vi.fn>;
  resolveTxt: ReturnType<typeof vi.fn>;
  resolveCname: ReturnType<typeof vi.fn>;
};

describe('email-deliverability', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('reports pass when all records are properly configured', async () => {
    mockDns.resolveMx.mockResolvedValue([
      { priority: 10, exchange: 'mx1.example.com' },
    ]);
    mockDns.resolveTxt.mockImplementation(async (domain: string) => {
      if (domain === 'example.com') {
        return [['v=spf1 include:_spf.resend.com ~all']];
      }
      if (domain === '_dmarc.example.com') {
        return [['v=DMARC1; p=reject; rua=mailto:dmarc@example.com']];
      }
      // DKIM selectors
      if (domain.includes('._domainkey.')) {
        if (domain.startsWith('resend._domainkey.')) {
          return [['v=DKIM1; k=rsa; p=MIGfMA0GCS...']];
        }
        throw Object.assign(new Error('ENODATA'), { code: 'ENODATA' });
      }
      return [];
    });
    mockDns.resolveCname.mockResolvedValue(['bounces.resend.com']);

    const report: DeliverabilityReport = await checkDeliverability('example.com');

    expect(report.domain).toBe('example.com');
    expect(report.overall).toBe('pass');
    expect(report.checks).toHaveLength(5);

    const mx = report.checks.find((c) => c.name === 'MX');
    expect(mx?.status).toBe('pass');

    const spf = report.checks.find((c) => c.name === 'SPF');
    expect(spf?.status).toBe('pass');

    const dkim = report.checks.find((c) => c.name === 'DKIM');
    expect(dkim?.status).toBe('pass');

    const dmarc = report.checks.find((c) => c.name === 'DMARC');
    expect(dmarc?.status).toBe('pass');
  });

  it('reports fail when MX records are missing', async () => {
    mockDns.resolveMx.mockRejectedValue(Object.assign(new Error('ENODATA'), { code: 'ENODATA' }));
    mockDns.resolveTxt.mockImplementation(async () => {
      throw Object.assign(new Error('ENODATA'), { code: 'ENODATA' });
    });
    mockDns.resolveCname.mockRejectedValue(Object.assign(new Error('ENODATA'), { code: 'ENODATA' }));

    const report = await checkDeliverability('missing.example.com');

    expect(report.overall).toBe('fail');
    const mx = report.checks.find((c) => c.name === 'MX');
    expect(mx?.status).toBe('fail');
  });

  it('warns about SPF +all', async () => {
    mockDns.resolveMx.mockResolvedValue([{ priority: 10, exchange: 'mx.example.com' }]);
    mockDns.resolveTxt.mockImplementation(async (domain: string) => {
      if (domain === 'test.com') return [['v=spf1 +all']];
      if (domain === '_dmarc.test.com') return [['v=DMARC1; p=quarantine']];
      throw Object.assign(new Error('ENODATA'), { code: 'ENODATA' });
    });
    mockDns.resolveCname.mockRejectedValue(Object.assign(new Error('ENODATA'), { code: 'ENODATA' }));

    const report = await checkDeliverability('test.com');

    const spf = report.checks.find((c) => c.name === 'SPF');
    expect(spf?.status).toBe('warn');
    expect(spf?.detail).toContain('+all');
  });

  it('warns about DMARC p=none', async () => {
    mockDns.resolveMx.mockResolvedValue([{ priority: 10, exchange: 'mx.example.com' }]);
    mockDns.resolveTxt.mockImplementation(async (domain: string) => {
      if (domain === 'test2.com') return [['v=spf1 ~all']];
      if (domain === '_dmarc.test2.com') return [['v=DMARC1; p=none']];
      throw Object.assign(new Error('ENODATA'), { code: 'ENODATA' });
    });
    mockDns.resolveCname.mockRejectedValue(Object.assign(new Error('ENODATA'), { code: 'ENODATA' }));

    const report = await checkDeliverability('test2.com');

    const dmarc = report.checks.find((c) => c.name === 'DMARC');
    expect(dmarc?.status).toBe('warn');
    expect(dmarc?.detail).toContain('none');
  });
});
