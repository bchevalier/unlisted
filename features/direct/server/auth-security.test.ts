import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const { dbMock } = vi.hoisted(() => ({
  dbMock: {
    authAttempt: {
      create: vi.fn(),
      count: vi.fn(),
    },
  },
}));

vi.mock('../../../lib/db', () => ({ db: dbMock }));

import {
  decryptSecret,
  encryptSecret,
  enforceAuthRateLimit,
  extractClientIP,
  generateRecoveryCodes,
  hashIPAddress,
  hashRecoveryCode,
  recordAuthAttempt,
} from './auth-security';

const originalSecret = process.env.AUTH_ENCRYPTION_SECRET;

describe('auth-security helpers', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.AUTH_ENCRYPTION_SECRET = '12345678901234567890123456789012';
    dbMock.authAttempt.count.mockResolvedValue(0);
    dbMock.authAttempt.create.mockResolvedValue(undefined);
  });

  afterEach(() => {
    if (originalSecret === undefined) {
      delete process.env.AUTH_ENCRYPTION_SECRET;
    } else {
      process.env.AUTH_ENCRYPTION_SECRET = originalSecret;
    }
  });

  it('encrypts and decrypts secrets symmetrically', () => {
    const ciphertext = encryptSecret('super-secret-value');

    expect(ciphertext).toContain('.');
    expect(decryptSecret(ciphertext)).toBe('super-secret-value');
  });

  it('extracts the client ip from forwarded and real-ip headers', () => {
    const forwarded = new Request('http://localhost', {
      headers: { 'x-forwarded-for': '203.0.113.10, 10.0.0.1' },
    });
    const realIp = new Request('http://localhost', {
      headers: { 'x-real-ip': '198.51.100.2' },
    });

    expect(extractClientIP(forwarded)).toBe('203.0.113.10');
    expect(extractClientIP(realIp)).toBe('198.51.100.2');
    expect(hashIPAddress('198.51.100.2')).toHaveLength(64);
  });

  it('records auth attempts with lowercased emails and hashed ip addresses', async () => {
    await recordAuthAttempt({
      action: 'LOGIN',
      ipAddress: '198.51.100.2',
      email: 'John@Example.com',
      success: false,
    });

    expect(dbMock.authAttempt.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        action: 'LOGIN',
        email: 'john@example.com',
        success: false,
        ipHash: hashIPAddress('198.51.100.2'),
      }),
    });
  });

  it('enforces both ip and email auth rate limits', async () => {
    dbMock.authAttempt.count.mockImplementation(async ({ where }: { where: { ipHash?: string; email?: string } }) => {
      if (where.ipHash) {
        return 5;
      }
      return 0;
    });

    await expect(
      enforceAuthRateLimit({
        action: 'LOGIN',
        ipAddress: '198.51.100.2',
        maxByIp: 5,
        ipWindowMinutes: 15,
      })
    ).rejects.toThrow(/Too many attempts from this IP/);

    dbMock.authAttempt.count.mockImplementation(async ({ where }: any) => {
      if (where.email) {
        return 3;
      }
      return 0;
    });

    await expect(
      enforceAuthRateLimit({
        action: 'LOGIN',
        ipAddress: '198.51.100.2',
        maxByIp: 10,
        ipWindowMinutes: 15,
        email: 'john@example.com',
        maxByEmail: 3,
        emailWindowMinutes: 15,
      })
    ).rejects.toThrow(/Too many attempts for this email/);
  });

  it('generates recovery codes and hashes them case-insensitively', () => {
    const recovery = generateRecoveryCodes(3);

    expect(recovery.plain).toHaveLength(3);
    expect(recovery.hashes).toHaveLength(3);
    expect(recovery.plain[0]).toMatch(/^[A-F0-9]{10}$/);
    expect(hashRecoveryCode(recovery.plain[0].toLowerCase())).toBe(recovery.hashes[0]);
  });
});
