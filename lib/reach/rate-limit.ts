/**
 * In-memory sliding-window IP rate limiter for Reach API endpoints.
 *
 * Provides defense-in-depth alongside the DB-backed actor-level rate limits
 * in safety.ts. This layer catches:
 *   - API key brute-force attempts (unauthenticated flood)
 *   - Authenticated actors hammering endpoints from a single IP
 *   - Fan-out attacks across many actors from one source
 *
 * Uses an in-memory Map with automatic eviction (entries older than the window
 * are pruned on access). Suitable for single-process deployments; for
 * multi-instance use, swap to Redis or a shared store.
 *
 * Each limiter instance is independent — create separate instances for
 * different endpoint groups with tailored limits.
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface RateLimitConfig {
  /** Maximum requests allowed in the rolling window. */
  maxRequests: number;
  /** Rolling window duration in seconds. */
  windowSeconds: number;
}

export interface RateLimitResult {
  allowed: boolean;
  /** Remaining requests in this window. */
  remaining: number;
  /** Epoch timestamp (seconds) when the oldest entry in the window expires. */
  resetAt: number;
  /** Total limit. */
  limit: number;
}

interface BucketEntry {
  timestamps: number[];
}

// ---------------------------------------------------------------------------
// Rate Limiter Class
// ---------------------------------------------------------------------------

export class InMemoryRateLimiter {
  private buckets = new Map<string, BucketEntry>();
  private readonly config: RateLimitConfig;
  private pruneTimer: ReturnType<typeof setInterval> | null = null;

  constructor(config: RateLimitConfig) {
    this.config = config;

    // Periodic pruning every 60s to prevent memory leaks from stale keys.
    this.pruneTimer = setInterval(() => this.pruneStale(), 60_000);
    // Allow Node to exit even if timer is running.
    if (this.pruneTimer && typeof this.pruneTimer === 'object' && 'unref' in this.pruneTimer) {
      this.pruneTimer.unref();
    }
  }

  /**
   * Check + consume a rate limit token for the given key.
   * Returns whether the request is allowed plus metadata for headers.
   */
  check(key: string): RateLimitResult {
    const now = Date.now();
    const windowMs = this.config.windowSeconds * 1000;
    const cutoff = now - windowMs;

    let bucket = this.buckets.get(key);
    if (!bucket) {
      bucket = { timestamps: [] };
      this.buckets.set(key, bucket);
    }

    // Remove timestamps outside the window.
    bucket.timestamps = bucket.timestamps.filter((t) => t > cutoff);

    const count = bucket.timestamps.length;
    const remaining = Math.max(0, this.config.maxRequests - count);
    const resetAt = bucket.timestamps.length > 0
      ? Math.ceil((bucket.timestamps[0] + windowMs) / 1000)
      : Math.ceil((now + windowMs) / 1000);

    if (count >= this.config.maxRequests) {
      return {
        allowed: false,
        remaining: 0,
        resetAt,
        limit: this.config.maxRequests,
      };
    }

    // Consume a token.
    bucket.timestamps.push(now);

    return {
      allowed: true,
      remaining: remaining - 1,
      resetAt,
      limit: this.config.maxRequests,
    };
  }

  /**
   * Peek at current usage without consuming a token.
   */
  peek(key: string): RateLimitResult {
    const now = Date.now();
    const windowMs = this.config.windowSeconds * 1000;
    const cutoff = now - windowMs;

    const bucket = this.buckets.get(key);
    if (!bucket) {
      return {
        allowed: true,
        remaining: this.config.maxRequests,
        resetAt: Math.ceil((now + windowMs) / 1000),
        limit: this.config.maxRequests,
      };
    }

    const active = bucket.timestamps.filter((t) => t > cutoff);
    const remaining = Math.max(0, this.config.maxRequests - active.length);

    return {
      allowed: active.length < this.config.maxRequests,
      remaining,
      resetAt: active.length > 0
        ? Math.ceil((active[0] + windowMs) / 1000)
        : Math.ceil((now + windowMs) / 1000),
      limit: this.config.maxRequests,
    };
  }

  /**
   * Remove all stale entries (nothing in the window).
   */
  private pruneStale(): void {
    const cutoff = Date.now() - this.config.windowSeconds * 1000;
    for (const [key, bucket] of this.buckets) {
      const active = bucket.timestamps.filter((t) => t > cutoff);
      if (active.length === 0) {
        this.buckets.delete(key);
      } else {
        bucket.timestamps = active;
      }
    }
  }

  /** Current number of tracked keys (for diagnostics). */
  get size(): number {
    return this.buckets.size;
  }

  /** Stop periodic pruning (for tests / shutdown). */
  destroy(): void {
    if (this.pruneTimer) {
      clearInterval(this.pruneTimer);
      this.pruneTimer = null;
    }
    this.buckets.clear();
  }
}

// ---------------------------------------------------------------------------
// Global limiter instances for Reach API
// ---------------------------------------------------------------------------

/**
 * Contract creation — most sensitive endpoint.
 * 20 requests per 15 minutes per IP.
 */
export const contractCreateLimiter = new InMemoryRateLimiter({
  maxRequests: Number(process.env.REACH_IP_CONTRACT_CREATE_LIMIT ?? 20),
  windowSeconds: Number(process.env.REACH_IP_CONTRACT_CREATE_WINDOW_SECONDS ?? 900),
});

/**
 * General Reach API reads (listings, GET requests).
 * 120 requests per 15 minutes per IP.
 */
export const reachReadLimiter = new InMemoryRateLimiter({
  maxRequests: Number(process.env.REACH_IP_READ_LIMIT ?? 120),
  windowSeconds: Number(process.env.REACH_IP_READ_WINDOW_SECONDS ?? 900),
});

/**
 * Reach API writes (mutations other than contract creation).
 * 40 requests per 15 minutes per IP.
 */
export const reachWriteLimiter = new InMemoryRateLimiter({
  maxRequests: Number(process.env.REACH_IP_WRITE_LIMIT ?? 40),
  windowSeconds: Number(process.env.REACH_IP_WRITE_WINDOW_SECONDS ?? 900),
});

/**
 * Auth attempts (invalid API key probes).
 * 15 attempts per 15 minutes per IP.
 */
export const reachAuthLimiter = new InMemoryRateLimiter({
  maxRequests: Number(process.env.REACH_IP_AUTH_LIMIT ?? 15),
  windowSeconds: Number(process.env.REACH_IP_AUTH_WINDOW_SECONDS ?? 900),
});

/**
 * Social verification challenge creation — per actor.
 * 10 requests per hour per actor.
 */
export const socialVerificationCreateLimiter = new InMemoryRateLimiter({
  maxRequests: Number(process.env.REACH_SOCIAL_CREATE_LIMIT ?? 10),
  windowSeconds: Number(process.env.REACH_SOCIAL_CREATE_WINDOW_SECONDS ?? 3600),
});

/**
 * Social verification verify attempts — per actor.
 * 20 requests per hour per actor.
 */
export const socialVerificationVerifyLimiter = new InMemoryRateLimiter({
  maxRequests: Number(process.env.REACH_SOCIAL_VERIFY_LIMIT ?? 20),
  windowSeconds: Number(process.env.REACH_SOCIAL_VERIFY_WINDOW_SECONDS ?? 3600),
});

/**
 * Social verification deletes — per actor.
 * 20 requests per hour per actor.
 */
export const socialVerificationDeleteLimiter = new InMemoryRateLimiter({
  maxRequests: Number(process.env.REACH_SOCIAL_DELETE_LIMIT ?? 20),
  windowSeconds: Number(process.env.REACH_SOCIAL_DELETE_WINDOW_SECONDS ?? 3600),
});

// ---------------------------------------------------------------------------
// IP extraction
// ---------------------------------------------------------------------------

/**
 * Extract the client IP address from a request.
 * Checks common proxy headers, falls back to 'unknown'.
 */
export function getClientIp(request: Request): string {
  // X-Forwarded-For is the most common proxy header.
  const xff = request.headers.get('x-forwarded-for');
  if (xff) {
    // First IP in the chain is the original client.
    const first = xff.split(',')[0]?.trim();
    if (first) return first;
  }

  // Cloudflare.
  const cfIp = request.headers.get('cf-connecting-ip');
  if (cfIp) return cfIp;

  // Render, Fly.io, etc.
  const realIp = request.headers.get('x-real-ip');
  if (realIp) return realIp;

  return 'unknown';
}

// ---------------------------------------------------------------------------
// Response helpers
// ---------------------------------------------------------------------------

/**
 * Build a 429 Too Many Requests JSON response with rate-limit headers.
 */
export function rateLimitResponse(result: RateLimitResult): Response {
  return new Response(
    JSON.stringify({
      ok: false,
      error: 'Too many requests. Please try again later.',
      code: 'IP_RATE_LIMIT',
      retryAfter: result.resetAt - Math.ceil(Date.now() / 1000),
    }),
    {
      status: 429,
      headers: {
        'Content-Type': 'application/json',
        'Retry-After': String(Math.max(1, result.resetAt - Math.ceil(Date.now() / 1000))),
        'X-RateLimit-Limit': String(result.limit),
        'X-RateLimit-Remaining': '0',
        'X-RateLimit-Reset': String(result.resetAt),
      },
    },
  );
}

/**
 * Add rate-limit info headers to an existing response object.
 * (Useful when the request was allowed but we want to surface remaining quota.)
 */
export function addRateLimitHeaders(
  response: Response,
  result: RateLimitResult,
): Response {
  const headers = new Headers(response.headers);
  headers.set('X-RateLimit-Limit', String(result.limit));
  headers.set('X-RateLimit-Remaining', String(result.remaining));
  headers.set('X-RateLimit-Reset', String(result.resetAt));

  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}
