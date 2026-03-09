/**
 * In-memory sliding-window rate limiter for admin login attempts.
 *
 * Limits by IP address to prevent brute-force attacks.
 * Uses a simple in-memory store — resets on server restart, which is
 * acceptable for an internal admin panel. For production scale, swap
 * to Redis or a database-backed store.
 */

type WindowEntry = {
  timestamps: number[];
};

const store = new Map<string, WindowEntry>();

const MAX_ATTEMPTS = 5;          // max login attempts per window
const WINDOW_MS = 15 * 60_000;   // 15-minute window
const CLEANUP_INTERVAL = 60_000; // clean up stale entries every 60s

// Periodic cleanup to avoid memory leaks
let cleanupTimer: ReturnType<typeof setInterval> | null = null;

function ensureCleanup() {
  if (cleanupTimer) return;
  cleanupTimer = setInterval(() => {
    const now = Date.now();
    for (const [key, entry] of store) {
      entry.timestamps = entry.timestamps.filter((t) => now - t < WINDOW_MS);
      if (entry.timestamps.length === 0) {
        store.delete(key);
      }
    }
    if (store.size === 0 && cleanupTimer) {
      clearInterval(cleanupTimer);
      cleanupTimer = null;
    }
  }, CLEANUP_INTERVAL);

  // Don't prevent process exit
  if (cleanupTimer && typeof cleanupTimer === 'object' && 'unref' in cleanupTimer) {
    cleanupTimer.unref();
  }
}

/**
 * Extract client IP from request headers (handles proxies).
 */
export function getClientIp(request: Request): string {
  const forwarded = request.headers.get('x-forwarded-for');
  if (forwarded) {
    return forwarded.split(',')[0].trim();
  }
  const realIp = request.headers.get('x-real-ip');
  if (realIp) return realIp.trim();
  return 'unknown';
}

/**
 * Check if a login attempt is allowed for the given IP.
 * Returns { allowed: true } or { allowed: false, retryAfterSeconds }.
 */
export function checkLoginRateLimit(ip: string): { allowed: true } | { allowed: false; retryAfterSeconds: number } {
  const now = Date.now();
  let entry = store.get(ip);

  if (!entry) {
    entry = { timestamps: [] };
    store.set(ip, entry);
    ensureCleanup();
  }

  // Prune expired timestamps
  entry.timestamps = entry.timestamps.filter((t) => now - t < WINDOW_MS);

  if (entry.timestamps.length >= MAX_ATTEMPTS) {
    const oldestInWindow = entry.timestamps[0];
    const retryAfterMs = WINDOW_MS - (now - oldestInWindow);
    return { allowed: false, retryAfterSeconds: Math.ceil(retryAfterMs / 1000) };
  }

  return { allowed: true };
}

/**
 * Record a login attempt (call after checking rate limit).
 */
export function recordLoginAttempt(ip: string): void {
  const entry = store.get(ip);
  if (entry) {
    entry.timestamps.push(Date.now());
  } else {
    store.set(ip, { timestamps: [Date.now()] });
    ensureCleanup();
  }
}

/**
 * Clear rate limit for an IP (call on successful login if desired).
 */
export function clearLoginRateLimit(ip: string): void {
  store.delete(ip);
}
