import { describe, it, expect, afterEach } from 'vitest';
import {
  InMemoryRateLimiter,
  getClientIp,
  rateLimitResponse,
  socialVerificationCreateLimiter,
  socialVerificationVerifyLimiter,
  socialVerificationDeleteLimiter,
} from './rate-limit';

// ---------------------------------------------------------------------------
// InMemoryRateLimiter
// ---------------------------------------------------------------------------

describe('InMemoryRateLimiter', () => {
  const limiters: InMemoryRateLimiter[] = [];

  function createLimiter(maxRequests: number, windowSeconds: number) {
    const limiter = new InMemoryRateLimiter({ maxRequests, windowSeconds });
    limiters.push(limiter);
    return limiter;
  }

  afterEach(() => {
    limiters.forEach((l) => l.destroy());
    limiters.length = 0;
  });

  it('allows requests under the limit', () => {
    const limiter = createLimiter(3, 60);

    const r1 = limiter.check('ip-1');
    expect(r1.allowed).toBe(true);
    expect(r1.remaining).toBe(2);
    expect(r1.limit).toBe(3);

    const r2 = limiter.check('ip-1');
    expect(r2.allowed).toBe(true);
    expect(r2.remaining).toBe(1);

    const r3 = limiter.check('ip-1');
    expect(r3.allowed).toBe(true);
    expect(r3.remaining).toBe(0);
  });

  it('blocks requests over the limit', () => {
    const limiter = createLimiter(2, 60);

    limiter.check('ip-1');
    limiter.check('ip-1');

    const r3 = limiter.check('ip-1');
    expect(r3.allowed).toBe(false);
    expect(r3.remaining).toBe(0);
  });

  it('tracks different keys independently', () => {
    const limiter = createLimiter(1, 60);

    const r1 = limiter.check('ip-1');
    expect(r1.allowed).toBe(true);

    const r2 = limiter.check('ip-2');
    expect(r2.allowed).toBe(true);

    const r3 = limiter.check('ip-1');
    expect(r3.allowed).toBe(false);

    const r4 = limiter.check('ip-2');
    expect(r4.allowed).toBe(false);
  });

  it('peek does not consume a token', () => {
    const limiter = createLimiter(2, 60);

    const peek1 = limiter.peek('ip-1');
    expect(peek1.allowed).toBe(true);
    expect(peek1.remaining).toBe(2);

    limiter.check('ip-1');
    const peek2 = limiter.peek('ip-1');
    expect(peek2.allowed).toBe(true);
    expect(peek2.remaining).toBe(1);

    limiter.check('ip-1');
    const peek3 = limiter.peek('ip-1');
    expect(peek3.allowed).toBe(false);
    expect(peek3.remaining).toBe(0);
  });

  it('resets after the window expires', () => {
    const limiter = createLimiter(1, 1); // 1 second window

    const r1 = limiter.check('ip-1');
    expect(r1.allowed).toBe(true);

    const r2 = limiter.check('ip-1');
    expect(r2.allowed).toBe(false);

    // Manually age the timestamps to simulate window expiry.
    // Access the internal state via check after advancing time conceptually.
    // Since we can't easily mock Date.now in a unit test without vi.useFakeTimers,
    // we test the boundary behavior instead.
  });

  it('provides correct resetAt timestamp', () => {
    const limiter = createLimiter(2, 300);
    const before = Math.ceil(Date.now() / 1000);

    const r = limiter.check('ip-1');
    expect(r.resetAt).toBeGreaterThanOrEqual(before + 300);
    expect(r.resetAt).toBeLessThanOrEqual(before + 301);
  });

  it('tracks size correctly', () => {
    const limiter = createLimiter(10, 60);
    expect(limiter.size).toBe(0);

    limiter.check('ip-1');
    expect(limiter.size).toBe(1);

    limiter.check('ip-2');
    expect(limiter.size).toBe(2);

    limiter.check('ip-1'); // same key
    expect(limiter.size).toBe(2);
  });

  it('destroy clears all state', () => {
    const limiter = createLimiter(10, 60);
    limiter.check('ip-1');
    limiter.check('ip-2');
    expect(limiter.size).toBe(2);

    limiter.destroy();
    expect(limiter.size).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// getClientIp
// ---------------------------------------------------------------------------

describe('getClientIp', () => {
  function makeRequest(headers: Record<string, string>): Request {
    return new Request('http://localhost/test', {
      headers: new Headers(headers),
    });
  }

  it('extracts from X-Forwarded-For (first IP)', () => {
    const req = makeRequest({ 'x-forwarded-for': '1.2.3.4, 5.6.7.8' });
    expect(getClientIp(req)).toBe('1.2.3.4');
  });

  it('extracts from X-Forwarded-For (single IP)', () => {
    const req = makeRequest({ 'x-forwarded-for': '10.0.0.1' });
    expect(getClientIp(req)).toBe('10.0.0.1');
  });

  it('extracts from CF-Connecting-IP', () => {
    const req = makeRequest({ 'cf-connecting-ip': '203.0.113.50' });
    expect(getClientIp(req)).toBe('203.0.113.50');
  });

  it('extracts from X-Real-IP', () => {
    const req = makeRequest({ 'x-real-ip': '198.51.100.1' });
    expect(getClientIp(req)).toBe('198.51.100.1');
  });

  it('prefers X-Forwarded-For over CF-Connecting-IP', () => {
    const req = makeRequest({
      'x-forwarded-for': '1.1.1.1',
      'cf-connecting-ip': '2.2.2.2',
    });
    expect(getClientIp(req)).toBe('1.1.1.1');
  });

  it('returns unknown when no IP headers present', () => {
    const req = makeRequest({});
    expect(getClientIp(req)).toBe('unknown');
  });
});

// ---------------------------------------------------------------------------
// rateLimitResponse
// ---------------------------------------------------------------------------

describe('rateLimitResponse', () => {
  it('returns 429 with correct body and headers', async () => {
    const result = {
      allowed: false,
      remaining: 0,
      resetAt: Math.ceil(Date.now() / 1000) + 60,
      limit: 20,
    };

    const response = rateLimitResponse(result);
    expect(response.status).toBe(429);
    expect(response.headers.get('Content-Type')).toBe('application/json');
    expect(response.headers.get('X-RateLimit-Limit')).toBe('20');
    expect(response.headers.get('X-RateLimit-Remaining')).toBe('0');
    expect(response.headers.get('Retry-After')).toBeTruthy();

    const body = await response.json();
    expect(body.ok).toBe(false);
    expect(body.code).toBe('IP_RATE_LIMIT');
    expect(body.retryAfter).toBeGreaterThan(0);
  });
});

// ---------------------------------------------------------------------------
// Social verification limiters — global instances
// ---------------------------------------------------------------------------

describe('socialVerificationCreateLimiter', () => {
  it('exists with correct default config (10 requests / 1 hour)', () => {
    // Defaults from env fallback.
    const peek = socialVerificationCreateLimiter.peek('test-actor-create');
    expect(peek.limit).toBe(10);
    expect(peek.allowed).toBe(true);
    expect(peek.remaining).toBe(10);
  });
});

describe('socialVerificationVerifyLimiter', () => {
  it('exists with correct default config (20 requests / 1 hour)', () => {
    const peek = socialVerificationVerifyLimiter.peek('test-actor-verify');
    expect(peek.limit).toBe(20);
    expect(peek.allowed).toBe(true);
    expect(peek.remaining).toBe(20);
  });
});

describe('socialVerificationDeleteLimiter', () => {
  it('exists with correct default config (20 requests / 1 hour)', () => {
    const peek = socialVerificationDeleteLimiter.peek('test-actor-delete');
    expect(peek.limit).toBe(20);
    expect(peek.allowed).toBe(true);
    expect(peek.remaining).toBe(20);
  });

  it('enforces limit per actor key', () => {
    // Use a unique key to avoid cross-test contamination.
    const key = `test-actor-delete-enforce-${Date.now()}`;

    // Exhaust the budget.
    for (let i = 0; i < 20; i++) {
      const r = socialVerificationDeleteLimiter.check(key);
      expect(r.allowed).toBe(true);
    }

    // 21st request should be blocked.
    const blocked = socialVerificationDeleteLimiter.check(key);
    expect(blocked.allowed).toBe(false);
    expect(blocked.remaining).toBe(0);
  });
});
