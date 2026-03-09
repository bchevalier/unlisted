import { describe, it, expect, vi } from 'vitest';
import {
  logAdminAction,
  getRecentAuditEntries,
  isValidUuid,
  isValidCuid,
  isValidEntityId,
} from './admin-audit';

describe('admin-audit', () => {
  describe('logAdminAction', () => {
    it('records an action and returns it via getRecentAuditEntries', () => {
      const spy = vi.spyOn(console, 'log').mockImplementation(() => {});

      logAdminAction({
        adminEmail: 'admin@test.com',
        action: 'door_suspend',
        targetType: 'door',
        targetId: 'door-123',
        ip: '127.0.0.1',
      });

      const entries = getRecentAuditEntries(1);
      expect(entries).toHaveLength(1);
      expect(entries[0].adminEmail).toBe('admin@test.com');
      expect(entries[0].action).toBe('door_suspend');
      expect(entries[0].targetType).toBe('door');
      expect(entries[0].targetId).toBe('door-123');
      expect(entries[0].timestamp).toBeDefined();

      // Verify structured log was emitted
      expect(spy).toHaveBeenCalledWith(
        expect.stringContaining('"level":"audit"')
      );
      spy.mockRestore();
    });

    it('returns most recent entries first', () => {
      const spy = vi.spyOn(console, 'log').mockImplementation(() => {});

      logAdminAction({
        adminEmail: 'a@test.com',
        action: 'first',
        targetType: 'user',
        targetId: '1',
      });

      logAdminAction({
        adminEmail: 'a@test.com',
        action: 'second',
        targetType: 'user',
        targetId: '2',
      });

      const entries = getRecentAuditEntries(2);
      expect(entries[0].action).toBe('second');
      expect(entries[1].action).toBe('first');

      spy.mockRestore();
    });
  });

  describe('isValidUuid', () => {
    it('accepts valid UUID v4', () => {
      expect(isValidUuid('550e8400-e29b-41d4-a716-446655440000')).toBe(true);
    });

    it('rejects invalid strings', () => {
      expect(isValidUuid('not-a-uuid')).toBe(false);
      expect(isValidUuid('')).toBe(false);
      expect(isValidUuid('550e8400-e29b-41d4-a716')).toBe(false);
    });
  });

  describe('isValidCuid', () => {
    it('accepts valid CUID', () => {
      expect(isValidCuid('cjld2cyuq0000t3rmniod1foy')).toBe(true);
    });

    it('rejects invalid strings', () => {
      expect(isValidCuid('not-a-cuid')).toBe(false);
      expect(isValidCuid('')).toBe(false);
      expect(isValidCuid('xjld2cyuq0000t3rmniod1foy')).toBe(false); // wrong prefix
    });
  });

  describe('isValidEntityId', () => {
    it('accepts UUID', () => {
      expect(isValidEntityId('550e8400-e29b-41d4-a716-446655440000')).toBe(true);
    });

    it('accepts CUID', () => {
      expect(isValidEntityId('cjld2cyuq0000t3rmniod1foy')).toBe(true);
    });

    it('rejects garbage', () => {
      expect(isValidEntityId('')).toBe(false);
      expect(isValidEntityId('DROP TABLE users')).toBe(false);
      expect(isValidEntityId('../../../etc/passwd')).toBe(false);
    });
  });
});
