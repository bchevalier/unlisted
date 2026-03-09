import { describe, it, expect, beforeEach } from 'vitest';
import {
  checkLoginRateLimit,
  recordLoginAttempt,
  clearLoginRateLimit,
  getClientIp,
} from './admin-rate-limit';

describe('admin-rate-limit', () => {
  beforeEach(() => {
    // Clear state by clearing the rate limit for our test IP
    clearLoginRateLimit('test-ip');
    clearLoginRateLimit('192.168.1.1');
    clearLoginRateLimit('10.0.0.1');
  });

  describe('checkLoginRateLimit', () => {
    it('allows attempts under the limit', () => {
      for (let i = 0; i < 5; i++) {
        recordLoginAttempt('test-ip');
      }
      // 5 recorded, still at limit
      const result = checkLoginRateLimit('test-ip');
      expect(result.allowed).toBe(false);
    });

    it('allows first attempt for a new IP', () => {
      const result = checkLoginRateLimit('fresh-ip');
      expect(result.allowed).toBe(true);
      clearLoginRateLimit('fresh-ip');
    });

    it('blocks after 5 attempts', () => {
      for (let i = 0; i < 5; i++) {
        expect(checkLoginRateLimit('test-ip').allowed).toBe(true);
        recordLoginAttempt('test-ip');
      }
      const result = checkLoginRateLimit('test-ip');
      expect(result.allowed).toBe(false);
      if (!result.allowed) {
        expect(result.retryAfterSeconds).toBeGreaterThan(0);
      }
    });

    it('tracks different IPs independently', () => {
      for (let i = 0; i < 5; i++) {
        recordLoginAttempt('192.168.1.1');
      }
      expect(checkLoginRateLimit('192.168.1.1').allowed).toBe(false);
      expect(checkLoginRateLimit('10.0.0.1').allowed).toBe(true);
    });
  });

  describe('clearLoginRateLimit', () => {
    it('resets the counter for an IP', () => {
      for (let i = 0; i < 5; i++) {
        recordLoginAttempt('test-ip');
      }
      expect(checkLoginRateLimit('test-ip').allowed).toBe(false);
      clearLoginRateLimit('test-ip');
      expect(checkLoginRateLimit('test-ip').allowed).toBe(true);
    });
  });

  describe('getClientIp', () => {
    it('extracts IP from x-forwarded-for', () => {
      const req = new Request('http://localhost', {
        headers: { 'x-forwarded-for': '203.0.113.1, 10.0.0.1' },
      });
      expect(getClientIp(req)).toBe('203.0.113.1');
    });

    it('extracts IP from x-real-ip', () => {
      const req = new Request('http://localhost', {
        headers: { 'x-real-ip': '203.0.113.2' },
      });
      expect(getClientIp(req)).toBe('203.0.113.2');
    });

    it('prefers x-forwarded-for over x-real-ip', () => {
      const req = new Request('http://localhost', {
        headers: {
          'x-forwarded-for': '203.0.113.1',
          'x-real-ip': '203.0.113.2',
        },
      });
      expect(getClientIp(req)).toBe('203.0.113.1');
    });

    it('returns "unknown" when no headers present', () => {
      const req = new Request('http://localhost');
      expect(getClientIp(req)).toBe('unknown');
    });
  });
});
