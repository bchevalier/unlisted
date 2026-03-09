import { describe, expect, it } from 'vitest';

// ---------------------------------------------------------------------------
// Unit tests for slug generation helpers (exported indirectly via auth module).
// These tests validate the pure-function helpers without touching the DB.
// ---------------------------------------------------------------------------

// We re-implement the pure helpers here to test them in isolation.
// The production versions live in auth.ts — keep them in sync.

const RESERVED_SLUGS = new Set([
  'admin', 'api', 'direct', 'reach', 'u', 'r', 'complete',
  'app', 'auth', 'login', 'signup', 'logout', 'register',
  'settings', 'inbox', 'dashboard', 'billing', 'account',
  'knokio', 'door', 'doors', 'keeper', 'keepers', 'knocker', 'knockers',
  'request', 'requests', 'category', 'categories',
  'www', 'mail', 'email', 'smtp', 'imap', 'pop', 'ftp', 'ssh',
  'cdn', 'assets', 'static', 'public', 'private',
  'help', 'support', 'status', 'health', 'healthz',
  'webhook', 'webhooks', 'cron', 'internal',
  'test', 'demo', 'example', 'root', 'system', 'null', 'undefined',
  'info', 'contact', 'abuse', 'postmaster', 'webmaster', 'noreply', 'no-reply',
]);

function isReservedSlug(slug: string): boolean {
  return RESERVED_SLUGS.has(slug);
}

function sanitizeSlugCandidate(raw: string): string {
  return raw
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 40);
}

function fallbackSlug(seed: string): string {
  const localPart = seed.split('@')[0] ?? 'keeper';
  return sanitizeSlugCandidate(localPart);
}

describe('slug generation', () => {
  describe('sanitizeSlugCandidate', () => {
    it('lowercases input', () => {
      expect(sanitizeSlugCandidate('JohnDoe')).toBe('johndoe');
    });

    it('replaces special chars with dashes', () => {
      expect(sanitizeSlugCandidate('john.doe_123')).toBe('john-doe-123');
    });

    it('collapses multiple dashes', () => {
      expect(sanitizeSlugCandidate('john---doe')).toBe('john-doe');
    });

    it('strips leading and trailing dashes', () => {
      expect(sanitizeSlugCandidate('-john-doe-')).toBe('john-doe');
    });

    it('truncates to 40 chars', () => {
      const long = 'a'.repeat(60);
      expect(sanitizeSlugCandidate(long).length).toBe(40);
    });

    it('handles unicode gracefully', () => {
      expect(sanitizeSlugCandidate('café-über')).toBe('caf-ber');
    });

    it('handles empty string', () => {
      expect(sanitizeSlugCandidate('')).toBe('');
    });
  });

  describe('fallbackSlug', () => {
    it('extracts local part from email', () => {
      expect(fallbackSlug('john@example.com')).toBe('john');
    });

    it('sanitizes email local part', () => {
      expect(fallbackSlug('John.Doe+test@example.com')).toBe('john-doe-test');
    });

    it('handles bare string without @', () => {
      expect(fallbackSlug('keeper')).toBe('keeper');
    });
  });

  describe('isReservedSlug', () => {
    it('blocks app route slugs', () => {
      expect(isReservedSlug('admin')).toBe(true);
      expect(isReservedSlug('api')).toBe(true);
      expect(isReservedSlug('direct')).toBe(true);
      expect(isReservedSlug('reach')).toBe(true);
      expect(isReservedSlug('u')).toBe(true);
      expect(isReservedSlug('r')).toBe(true);
    });

    it('blocks product term slugs', () => {
      expect(isReservedSlug('knokio')).toBe(true);
      expect(isReservedSlug('door')).toBe(true);
      expect(isReservedSlug('keeper')).toBe(true);
      expect(isReservedSlug('knocker')).toBe(true);
    });

    it('blocks infrastructure slugs', () => {
      expect(isReservedSlug('www')).toBe(true);
      expect(isReservedSlug('mail')).toBe(true);
      expect(isReservedSlug('postmaster')).toBe(true);
    });

    it('blocks abuse-vector slugs', () => {
      expect(isReservedSlug('test')).toBe(true);
      expect(isReservedSlug('root')).toBe(true);
      expect(isReservedSlug('null')).toBe(true);
    });

    it('allows normal user slugs', () => {
      expect(isReservedSlug('john')).toBe(false);
      expect(isReservedSlug('jane-doe')).toBe(false);
      expect(isReservedSlug('company42')).toBe(false);
    });
  });
});
